import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveExternalTraining,
  createExternalTraining,
  deleteExternalTraining,
  downloadExternalTrainingCertificate,
  listExternalTrainingUserOptions,
  listExternalTrainings,
  rejectExternalTraining,
  updateExternalTraining,
  uploadExternalTrainingCertificate
} from "../api/externalTrainings";
import { useAuthStore } from "../store/authStore";
import {
  ApprovalStatus,
  ExternalTrainingFormPayload,
  ExternalTrainingRecord,
  ExternalTrainingUserOption,
  TrainingType
} from "../types/externalTraining";

const PAGE_LIMIT = 10;
// Vercel 서버리스 함수의 request body 한도(4.5MB) 아래로 여유를 두어 설정
const MAX_CERTIFICATE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

type FormMode = "create" | "edit";

type FormState = {
  user_id: string;
  training_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: string;
  cost: string;
  institution: string;
  credits: string;
  approval_status: string;
  certificate_status: string;
};

const initialFormState: FormState = {
  user_id: "",
  training_name: "",
  type: "OFFLINE",
  start_date: "",
  end_date: "",
  hours: "",
  cost: "",
  institution: "",
  credits: "",
  approval_status: "PENDING",
  certificate_status: "NOT_SUBMITTED"
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    const message = maybeResponse.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "사외교육 처리 중 오류가 발생했습니다.";
}

function formatKrw(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function validateCertificateFile(file: File) {
  if (file.size > MAX_CERTIFICATE_BYTES) {
    throw new Error(`수료증 파일 크기는 4MB 이하여야 합니다. (현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return;
  }

  if (hasAllowedExtension(file.name)) {
    return;
  }

  throw new Error("수료증 파일은 PDF/JPG/PNG만 업로드할 수 있습니다.");
}

// JPEG/PNG 이미지를 Canvas로 압축한다. PDF는 그대로 반환.
// 최대 2000px 리사이즈 + JPEG 품질 0.82 적용.
async function compressImage(file: File): Promise<File> {
  if (file.type === "application/pdf") {
    return file;
  }

  const MAX_SIDE = 2000;
  const QUALITY = 0.82;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // 이미 충분히 작으면 그대로 사용
      if (width <= MAX_SIDE && height <= MAX_SIDE && file.size <= MAX_CERTIFICATE_BYTES) {
        resolve(file);
        return;
      }

      // 비율 유지 리사이즈
      if (width >= height && width > MAX_SIDE) {
        height = Math.round((height * MAX_SIDE) / width);
        width = MAX_SIDE;
      } else if (height > MAX_SIDE) {
        width = Math.round((width * MAX_SIDE) / height);
        height = MAX_SIDE;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("이미지 압축 중 오류가 발생했습니다."));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 압축 중 오류가 발생했습니다."));
            return;
          }
          const compressedName = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], compressedName, { type: "image/jpeg", lastModified: Date.now() }));
        },
        "image/jpeg",
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };

    img.src = url;
  });
}

function buildFormPayload(form: FormState, admin: boolean, isEdit = false): ExternalTrainingFormPayload {
  const trainingName = form.training_name.trim();
  const institution = form.institution.trim();
  const startDate = form.start_date.trim();
  const endDate = form.end_date.trim();

  if (!trainingName) {
    throw new Error("교육명은 필수입니다.");
  }

  if (!institution) {
    throw new Error("주관기관은 필수입니다.");
  }

  if (!startDate || !endDate) {
    throw new Error("시작일/종료일은 필수입니다.");
  }

  if (endDate < startDate) {
    throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
  }

  const hours = Number(form.hours);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error("교육시간은 0 이상 숫자여야 합니다.");
  }

  let cost: number | null = null;
  if (form.cost.trim()) {
    const parsedCost = Number(form.cost);
    if (!Number.isInteger(parsedCost) || parsedCost < 0) {
      throw new Error("비용은 0 이상 정수여야 합니다.");
    }
    cost = parsedCost;
  }

  let credits: number | null = null;
  if (form.credits.trim()) {
    const parsedCredits = Number(form.credits);
    if (!Number.isFinite(parsedCredits) || parsedCredits < 0) {
      throw new Error("학점은 0 이상 숫자여야 합니다.");
    }
    credits = parsedCredits;
  }

  const payload: ExternalTrainingFormPayload = {
    training_name: trainingName,
    type: form.type,
    start_date: startDate,
    end_date: endDate,
    hours,
    cost,
    institution,
    credits: admin ? credits : null
  };

  if (admin) {
    const userId = form.user_id.trim();
    if (!userId) {
      throw new Error("ADMIN은 이름(사용자)을 선택해야 합니다.");
    }
    payload.user_id = userId;
    if (isEdit) {
      payload.approval_status = form.approval_status;
      payload.certificate_status = form.certificate_status;
    }
  }

  return payload;
}

function pageNumbers(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

function approvalBadgeClass(status: ApprovalStatus) {
  if (status === "APPROVED") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "REJECTED") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function ExternalTraining() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMIN";

  const [items, setItems] = useState<ExternalTrainingRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingRecord, setEditingRecord] = useState<ExternalTrainingRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [userOptions, setUserOptions] = useState<ExternalTrainingUserOption[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<ExternalTrainingRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewContentType, setPreviewContentType] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  const refreshList = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await listExternalTrainings({
          page,
          limit: PAGE_LIMIT,
          search: search || undefined
        });

        if (canceled) {
          return;
        }

        setItems(response.items);
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.total);

        if (page > response.pagination.totalPages) {
          setPage(response.pagination.totalPages);
        }
      } catch (loadError) {
        if (!canceled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      canceled = true;
    };
  }, [page, search, reloadToken]);

  useEffect(() => {
    let canceled = false;

    async function loadUsers() {
      if (!isAdmin) {
        setUserOptions([]);
        return;
      }

      try {
        const options = await listExternalTrainingUserOptions();
        if (!canceled) {
          setUserOptions(options);
        }
      } catch {
        if (!canceled) {
          setUserOptions([]);
        }
      }
    }

    void loadUsers();

    return () => {
      canceled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const currentPages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages]);

  function openCreateModal() {
    setFormMode("create");
    setEditingRecord(null);
    setFormFile(null);
    setFormError(null);
    setFormState({
      ...initialFormState,
      user_id: isAdmin ? userOptions[0]?.id || "" : ""
    });
    setFormOpen(true);
  }

  function openEditModal(record: ExternalTrainingRecord) {
    setFormMode("edit");
    setEditingRecord(record);
    setFormFile(null);
    setFormError(null);
    setFormState({
      user_id: record.user_id,
      training_name: record.training_name,
      type: record.type,
      start_date: record.start_date,
      end_date: record.end_date,
      hours: String(record.hours),
      cost: record.cost === null ? "" : String(record.cost),
      institution: record.institution,
      credits: record.credits === null ? "" : String(record.credits),
      approval_status: record.approval_status,
      certificate_status: record.certificate_status
    });
    setFormOpen(true);
  }

  function closeFormModal() {
    if (formSubmitting) {
      return;
    }

    setFormOpen(false);
  }

  async function onSubmitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = buildFormPayload(formState, isAdmin, formMode === "edit");

      const isEdit = formMode === "edit" && editingRecord;
      let targetId: string;

      if (isEdit) {
        const updated = await updateExternalTraining(editingRecord.id, payload);
        targetId = updated.id;
      } else {
        const created = await createExternalTraining(payload);
        targetId = created.id;
      }

      if (formFile) {
        validateCertificateFile(formFile);
        const fileToUpload = await compressImage(formFile);
        await uploadExternalTrainingCertificate(targetId, fileToUpload);
      }

      setFormOpen(false);
      refreshList();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function onDelete(record: ExternalTrainingRecord) {
    const confirmed = window.confirm(`\"${record.training_name}\" 교육 이력을 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setRowActionLoadingId(record.id);

    try {
      await deleteExternalTraining(record.id);
      refreshList();
    } catch (deleteError) {
      window.alert(getErrorMessage(deleteError));
    } finally {
      setRowActionLoadingId(null);
    }
  }

  async function onDownload(record: ExternalTrainingRecord) {
    if (!record.certificate_file) {
      return;
    }

    setRowActionLoadingId(record.id);

    try {
      const file = await downloadExternalTrainingCertificate(record.id);
      const objectUrl = URL.createObjectURL(file.blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      anchor.click();

      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      window.alert(getErrorMessage(downloadError));
    } finally {
      setRowActionLoadingId(null);
    }
  }

  function onClickUpload(record: ExternalTrainingRecord) {
    setUploadTargetId(record.id);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function onFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !uploadTargetId) {
      return;
    }

    setRowActionLoadingId(uploadTargetId);

    try {
      validateCertificateFile(file);
      const fileToUpload = await compressImage(file);
      await uploadExternalTrainingCertificate(uploadTargetId, fileToUpload);
      refreshList();
    } catch (uploadError) {
      window.alert(getErrorMessage(uploadError));
    } finally {
      setRowActionLoadingId(null);
      setUploadTargetId(null);
      event.target.value = "";
    }
  }

  async function openPreview(record: ExternalTrainingRecord) {
    if (!isAdmin || !record.certificate_file) {
      return;
    }

    setPreviewOpen(true);
    setPreviewRecord(record);
    setPreviewError(null);
    setPreviewLoading(true);
    setRejectComment("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    try {
      const file = await downloadExternalTrainingCertificate(record.id);
      const objectUrl = URL.createObjectURL(file.blob);
      setPreviewUrl(objectUrl);
      setPreviewContentType(file.contentType || file.blob.type);
    } catch (previewLoadError) {
      setPreviewError(getErrorMessage(previewLoadError));
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview(force = false) {
    if (approvalLoading && !force) {
      return;
    }

    setPreviewOpen(false);
    setPreviewRecord(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setRejectComment("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setPreviewContentType("");
  }

  async function onApproveFromPreview() {
    if (!previewRecord) {
      return;
    }

    setApprovalLoading(true);
    setPreviewError(null);

    try {
      await approveExternalTraining(previewRecord.id);
      closePreview(true);
      refreshList();
    } catch (approveError) {
      setPreviewError(getErrorMessage(approveError));
    } finally {
      setApprovalLoading(false);
    }
  }

  async function onRejectFromPreview() {
    if (!previewRecord) {
      return;
    }

    const comment = rejectComment.trim();
    if (!comment) {
      setPreviewError("반려 사유는 필수입니다.");
      return;
    }

    setApprovalLoading(true);
    setPreviewError(null);

    try {
      await rejectExternalTraining(previewRecord.id, comment);
      closePreview(true);
      refreshList();
    } catch (rejectError) {
      setPreviewError(getErrorMessage(rejectError));
    } finally {
      setApprovalLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">사외교육</h2>
        <div className="flex gap-2">
          {!isAdmin && (
            <button onClick={openCreateModal} className="rounded bg-blue-700 px-3 py-2 text-sm text-white">
              + 사외교육 신청
            </button>
          )}
          {isAdmin && (
            <button onClick={openCreateModal} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
              + 사외교육 등록
            </button>
          )}
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          placeholder="교육명/이름 검색"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onFileInputChange} />

      {loading ? (
        <article className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">로딩 중...</article>
      ) : error ? (
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-6 space-y-3">
          <p className="text-rose-700">{error}</p>
          <button onClick={refreshList} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            다시 시도
          </button>
        </article>
      ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-4 overflow-auto">
          <table className="w-full min-w-[1420px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">교육명</th>
                <th className="py-2 pr-3">구분</th>
                <th className="py-2 pr-3">시작일</th>
                <th className="py-2 pr-3">종료일</th>
                <th className="py-2 pr-3">교육시간</th>
                <th className="py-2 pr-3">비용</th>
                <th className="py-2 pr-3">주관기관</th>
                <th className="py-2 pr-3">수료증</th>
                <th className="py-2 pr-3">승인상태</th>
                <th className="py-2 pr-3">학점</th>
                <th className="py-2 pr-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
                    조회된 사외교육 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3">{item.employee_name}</td>
                    <td className="py-2 pr-3">{item.training_name}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{item.type}</span>
                    </td>
                    <td className="py-2 pr-3">{item.start_date}</td>
                    <td className="py-2 pr-3">{item.end_date}</td>
                    <td className="py-2 pr-3">{formatNumber(item.hours)}</td>
                    <td className="py-2 pr-3">{formatKrw(item.cost)}</td>
                    <td className="py-2 pr-3">{item.institution}</td>
                    <td className="py-2 pr-3">
                      <div className="space-y-1">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                            item.certificate_status === "SUBMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {item.certificate_status}
                        </span>
                        {isAdmin && item.certificate_file ? (
                          <div>
                            <button className="text-xs text-blue-700 underline" onClick={() => void openPreview(item)}>
                              수료증 보기
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="space-y-1">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${approvalBadgeClass(item.approval_status)}`}>
                          {item.approval_status}
                        </span>
                        {item.approval_status === "REJECTED" && item.approval_comment ? (
                          <p className="text-xs text-rose-700">반려 사유: {item.approval_comment}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{formatNumber(item.credits)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          title="수료증 업로드"
                          disabled={rowActionLoadingId === item.id}
                          onClick={() => onClickUpload(item)}
                        >
                          📎 수료증 업로드
                        </button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                          title="수료증 다운로드"
                          disabled={rowActionLoadingId === item.id || !item.certificate_file}
                          onClick={() => void onDownload(item)}
                        >
                          ⬇ 수료증 다운로드
                        </button>
                        {isAdmin && (
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            title="수정"
                            disabled={rowActionLoadingId === item.id}
                            onClick={() => openEditModal(item)}
                          >
                            ✏ 수정
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                            title="삭제"
                            disabled={rowActionLoadingId === item.id}
                            onClick={() => void onDelete(item)}
                          >
                            🗑 삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      )}

      <footer className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600">총 {new Intl.NumberFormat("ko-KR").format(totalCount)}건</p>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
              disabled={page <= 1}
            >
              이전
            </button>
            {currentPages.map((pageNumber) => (
              <button
                key={pageNumber}
                className={`rounded border px-3 py-1 text-sm ${
                  pageNumber === page ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"
                }`}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
              disabled={page >= totalPages}
            >
              다음
            </button>
          </div>
        </div>
      </footer>

      {formOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5">
            <h3 className="text-lg font-semibold mb-4">{formMode === "create" ? (isAdmin ? "사외교육 등록" : "사외교육 신청") : "사외교육 수정"}</h3>
            <form className="space-y-3" onSubmit={onSubmitForm}>
              {isAdmin ? (
                <label className="block space-y-1">
                  <span className="text-sm text-slate-700">이름</span>
                  <select
                    value={formState.user_id}
                    onChange={(event) => setFormState((prev) => ({ ...prev, user_id: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">사용자 선택</option>
                    {userOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} ({option.employee_id})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div>
                  <p className="text-sm text-slate-700">이름</p>
                  <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{user?.name || "-"}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">교육명</span>
                  <input
                    value={formState.training_name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, training_name: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">구분</span>
                  <select
                    value={formState.type}
                    onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value as TrainingType }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="OFFLINE">OFFLINE</option>
                    <option value="ONLINE">ONLINE</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">시작일</span>
                  <input
                    type="date"
                    value={formState.start_date}
                    onChange={(event) => setFormState((prev) => ({ ...prev, start_date: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">종료일</span>
                  <input
                    type="date"
                    value={formState.end_date}
                    onChange={(event) => setFormState((prev) => ({ ...prev, end_date: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">교육시간</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formState.hours}
                    onChange={(event) => setFormState((prev) => ({ ...prev, hours: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">비용</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formState.cost}
                    onChange={(event) => setFormState((prev) => ({ ...prev, cost: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">주관기관</span>
                  <input
                    value={formState.institution}
                    onChange={(event) => setFormState((prev) => ({ ...prev, institution: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                {isAdmin && (
                  <label className="space-y-1">
                    <span className="text-sm text-slate-700">학점</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formState.credits}
                      onChange={(event) => setFormState((prev) => ({ ...prev, credits: event.target.value }))}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                )}
                {isAdmin && formMode === "edit" && (
                  <label className="space-y-1">
                    <span className="text-sm text-slate-700">승인상태</span>
                    <select
                      value={formState.approval_status}
                      onChange={(event) => setFormState((prev) => ({ ...prev, approval_status: event.target.value }))}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </label>
                )}
                {isAdmin && formMode === "edit" && (
                  <label className="space-y-1">
                    <span className="text-sm text-slate-700">수료증상태</span>
                    <select
                      value={formState.certificate_status}
                      onChange={(event) => setFormState((prev) => ({ ...prev, certificate_status: event.target.value }))}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="NOT_SUBMITTED">NOT_SUBMITTED</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                    </select>
                  </label>
                )}
              </div>

              <label className="space-y-1 block">
                <span className="text-sm text-slate-700">수료증 파일 (.pdf, .jpg, .png)</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setFormFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              {formError ? <p className="text-sm text-rose-700">{formError}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={formSubmitting}
                >
                  취소
                </button>
                <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={formSubmitting}>
                  {formSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl rounded-xl bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">수료증 미리보기</h3>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm"
                onClick={() => closePreview()}
                disabled={approvalLoading}
              >
                닫기
              </button>
            </div>

            {previewRecord ? (
              <p className="text-sm text-slate-600">
                {previewRecord.employee_name} / {previewRecord.training_name}
              </p>
            ) : null}

            {previewLoading ? (
              <div className="rounded border border-slate-200 p-8 text-center text-slate-500">파일 불러오는 중...</div>
            ) : previewError ? (
              <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-700">{previewError}</div>
            ) : previewUrl ? (
              <div className="rounded border border-slate-200 p-2">
                {previewContentType.includes("pdf") ? (
                  <iframe src={previewUrl} title="certificate-preview" className="h-[420px] w-full rounded" />
                ) : previewContentType.includes("image/") ? (
                  <img src={previewUrl} alt="certificate preview" className="mx-auto max-h-[420px]" />
                ) : (
                  <p className="p-6 text-center text-sm text-slate-600">미리보기를 지원하지 않는 파일 형식입니다.</p>
                )}
              </div>
            ) : null}

            {previewRecord?.approval_status === "PENDING" ? (
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <label className="block space-y-1">
                  <span className="text-sm text-slate-700">반려 사유</span>
                  <textarea
                    value={rejectComment}
                    onChange={(event) => setRejectComment(event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    rows={3}
                    placeholder="반려 시 사유를 입력하세요."
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    onClick={() => void onApproveFromPreview()}
                    disabled={approvalLoading}
                  >
                    승인
                  </button>
                  <button
                    className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    onClick={() => void onRejectFromPreview()}
                    disabled={approvalLoading}
                  >
                    반려
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

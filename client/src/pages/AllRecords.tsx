import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportAllRecords, listAllRecords } from "../api/allRecords";
import { deleteCertification } from "../api/certifications";
import {
  deleteExternalTraining,
  downloadExternalTrainingCertificate,
  uploadExternalTrainingCertificate
} from "../api/externalTrainings";
import { deleteInternalLecture } from "../api/internalLectures";
import {
  deleteInternalTraining,
  downloadInternalTrainingCertificate,
  uploadInternalTrainingCertificate
} from "../api/internalTrainings";
import { AllRecordsCategoryFilter, AllRecordsItem, AllRecordsSortField, AllRecordsSortOrder } from "../types/allRecords";

const PAGE_LIMIT = 20;
const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

const categoryOptions: Array<{ value: AllRecordsCategoryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "external-training", label: "사외" },
  { value: "internal-training", label: "사내" },
  { value: "internal-lecture", label: "강의" },
  { value: "certification", label: "자격증" }
];

const sortableColumns: Array<{ key: AllRecordsSortField; label: string }> = [
  { key: "employee_name", label: "이름" },
  { key: "department", label: "부서" },
  { key: "team", label: "팀" },
  { key: "category", label: "카테고리" },
  { key: "title", label: "교육명" },
  { key: "type", label: "구분" },
  { key: "start_date", label: "시작일" },
  { key: "end_date", label: "종료일" },
  { key: "hours", label: "시간" },
  { key: "cost", label: "비용" },
  { key: "certificate_status", label: "수료증" },
  { key: "credits", label: "학점" }
];

function getErrorMessage(error: unknown) {
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

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "전체 이력 처리 중 오류가 발생했습니다.";
}

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function validateCertificateFile(file: File) {
  if (file.size > MAX_CERTIFICATE_BYTES) {
    throw new Error(`수료증 파일 크기는 ${MAX_CERTIFICATE_BYTES} bytes 이하여야 합니다.`);
  }

  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return;
  }

  if (hasAllowedExtension(file.name)) {
    return;
  }

  throw new Error("수료증 파일은 PDF/JPG/PNG만 업로드할 수 있습니다.");
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function formatKrw(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function mapCertificateStatus(value: AllRecordsItem["certificate_status"]) {
  if (value === "SUBMITTED") {
    return "제출";
  }

  if (value === "NOT_SUBMITTED") {
    return "미제출";
  }

  return "해당없음";
}

function certificateBadgeClass(value: AllRecordsItem["certificate_status"]) {
  if (value === "SUBMITTED") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (value === "NOT_SUBMITTED") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-slate-100 text-slate-600";
}

function categoryBadgeClass(category: AllRecordsItem["category"]) {
  if (category === "EXTERNAL_TRAINING") {
    return "bg-blue-100 text-blue-700";
  }

  if (category === "INTERNAL_TRAINING") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (category === "INTERNAL_LECTURE") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-violet-100 text-violet-700";
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

function supportsCertificateActions(
  item: AllRecordsItem
): item is AllRecordsItem & { category: "EXTERNAL_TRAINING" | "INTERNAL_TRAINING" } {
  return item.category === "EXTERNAL_TRAINING" || item.category === "INTERNAL_TRAINING";
}

type UploadTarget = {
  sourceId: string;
  category: "EXTERNAL_TRAINING" | "INTERNAL_TRAINING";
};

export default function AllRecords() {
  const [items, setItems] = useState<AllRecordsItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AllRecordsCategoryFilter>("all");
  const [sort, setSort] = useState<AllRecordsSortField>("start_date");
  const [order, setOrder] = useState<AllRecordsSortOrder>("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const response = await listAllRecords({
          search,
          category,
          sort,
          order,
          page,
          limit: PAGE_LIMIT
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
  }, [search, category, sort, order, page, reloadToken]);

  const currentPages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages]);

  function onChangeCategory(nextCategory: AllRecordsCategoryFilter) {
    setCategory(nextCategory);
    setPage(1);
  }

  function onToggleSort(field: AllRecordsSortField) {
    setPage(1);
    if (sort === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSort(field);
    setOrder("asc");
  }

  function sortIndicator(field: AllRecordsSortField) {
    if (sort !== field) {
      return "↕";
    }

    return order === "asc" ? "▲" : "▼";
  }

  async function onExport() {
    setExporting(true);

    try {
      const file = await exportAllRecords({ search, category, sort, order });
      const objectUrl = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      window.alert(getErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }

  function onClickUpload(item: AllRecordsItem) {
    if (!supportsCertificateActions(item)) {
      return;
    }

    setUploadTarget({
      sourceId: item.source_id,
      category: item.category
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function onFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !uploadTarget) {
      return;
    }

    const actionKey = `${uploadTarget.sourceId}:${uploadTarget.category}:upload`;
    setRowActionLoadingId(actionKey);

    try {
      validateCertificateFile(file);

      if (uploadTarget.category === "EXTERNAL_TRAINING") {
        await uploadExternalTrainingCertificate(uploadTarget.sourceId, file);
      } else {
        await uploadInternalTrainingCertificate(uploadTarget.sourceId, file);
      }

      refreshList();
    } catch (uploadError) {
      window.alert(getErrorMessage(uploadError));
    } finally {
      setRowActionLoadingId(null);
      setUploadTarget(null);
      event.target.value = "";
    }
  }

  async function onDownload(item: AllRecordsItem) {
    if (!supportsCertificateActions(item)) {
      return;
    }

    const actionKey = `${item.id}:download`;
    setRowActionLoadingId(actionKey);

    try {
      const file =
        item.category === "EXTERNAL_TRAINING"
          ? await downloadExternalTrainingCertificate(item.source_id)
          : await downloadInternalTrainingCertificate(item.source_id);

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

  async function onDelete(item: AllRecordsItem) {
    const confirmed = window.confirm(`\"${item.title}\" 이력을 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    const actionKey = `${item.id}:delete`;
    setRowActionLoadingId(actionKey);

    try {
      if (item.category === "EXTERNAL_TRAINING") {
        await deleteExternalTraining(item.source_id);
      } else if (item.category === "INTERNAL_TRAINING") {
        await deleteInternalTraining(item.source_id);
      } else if (item.category === "INTERNAL_LECTURE") {
        await deleteInternalLecture(item.source_id);
      } else {
        await deleteCertification(item.source_id);
      }

      refreshList();
    } catch (deleteError) {
      window.alert(getErrorMessage(deleteError));
    } finally {
      setRowActionLoadingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">전체 이력 관리</h2>
        <button
          onClick={() => void onExport()}
          disabled={exporting}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {exporting ? "내보내는 중..." : "엑셀 다운로드"}
        </button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <input
          type="search"
          placeholder="교육명/강의명/자격증명/이름 검색"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onChangeCategory(option.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                category === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
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
          <table className="w-full min-w-[1640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                {sortableColumns.map((column) => (
                  <th key={column.key} className="py-2 pr-3">
                    <button className="inline-flex items-center gap-1 hover:text-slate-900" onClick={() => onToggleSort(column.key)}>
                      <span>{column.label}</span>
                      <span className="text-xs text-slate-500">{sortIndicator(column.key)}</span>
                    </button>
                  </th>
                ))}
                <th className="py-2 pr-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500">
                    조회된 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const supportsCert = supportsCertificateActions(item);
                  const uploadKey = `${item.source_id}:${item.category}:upload`;
                  const downloadKey = `${item.id}:download`;
                  const deleteKey = `${item.id}:delete`;

                  return (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 pr-3">{item.employee_name}</td>
                      <td className="py-2 pr-3">{item.department}</td>
                      <td className="py-2 pr-3">{item.team}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${categoryBadgeClass(item.category)}`}>
                          {item.category_label}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{item.title}</td>
                      <td className="py-2 pr-3">{item.type ?? "-"}</td>
                      <td className="py-2 pr-3">{item.start_date ?? "-"}</td>
                      <td className="py-2 pr-3">{item.end_date ?? "-"}</td>
                      <td className="py-2 pr-3">{formatNumber(item.hours)}</td>
                      <td className="py-2 pr-3">{formatKrw(item.cost)}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${certificateBadgeClass(item.certificate_status)}`}>
                          {mapCertificateStatus(item.certificate_status)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{formatNumber(item.credits)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {supportsCert ? (
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                              title="수료증 업로드"
                              disabled={rowActionLoadingId === uploadKey}
                              onClick={() => onClickUpload(item)}
                            >
                              📎
                            </button>
                          ) : null}
                          {supportsCert ? (
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                              title="수료증 다운로드"
                              disabled={rowActionLoadingId === downloadKey || item.certificate_status !== "SUBMITTED"}
                              onClick={() => void onDownload(item)}
                            >
                              ⬇
                            </button>
                          ) : null}
                          <button
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                            title="삭제"
                            disabled={rowActionLoadingId === deleteKey}
                            onClick={() => void onDelete(item)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
    </section>
  );
}

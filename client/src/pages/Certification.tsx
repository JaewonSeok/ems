import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCertification,
  deleteCertification,
  listCertificationUserOptions,
  listCertifications,
  updateCertification
} from "../api/certifications";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { CertificationFormPayload, CertificationRecord, CertificationUserOption } from "../types/certification";

const PAGE_LIMIT = 10;

type FormMode = "create" | "edit";

type FormState = {
  user_id: string;
  cert_name: string;
  grade: string;
  acquired_date: string;
  credits: string;
};

const initialFormState: FormState = {
  user_id: "",
  cert_name: "",
  grade: "",
  acquired_date: "",
  credits: ""
};

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

  return "자격증 처리 중 오류가 발생했습니다.";
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function parseStrictDate(dateText: string) {
  const trimmed = dateText.trim();

  if (!trimmed) {
    throw new Error("취득일은 필수입니다.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("취득일은 YYYY-MM-DD 형식이어야 합니다.");
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error("취득일이 올바르지 않습니다.");
  }

  return trimmed;
}

function parseStrictCredits(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+(\.\d)?$/.test(trimmed)) {
    throw new Error("인정학점은 0 이상의 숫자이며 소수점 첫째 자리까지 입력할 수 있습니다.");
  }

  const numeric = Number(trimmed);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 999.9) {
    throw new Error("인정학점은 0 이상 999.9 이하만 가능합니다.");
  }

  return numeric;
}

function buildFormPayload(form: FormState, admin: boolean): CertificationFormPayload {
  const certName = form.cert_name.trim();
  const grade = form.grade.trim();
  const acquiredDate = parseStrictDate(form.acquired_date);
  const credits = parseStrictCredits(form.credits);

  if (!certName) {
    throw new Error("자격증명은 필수입니다.");
  }

  if (!grade) {
    throw new Error("등급은 필수입니다.");
  }

  const payload: CertificationFormPayload = {
    cert_name: certName,
    grade,
    acquired_date: acquiredDate,
    credits
  };

  if (admin) {
    const userId = form.user_id.trim();
    if (!userId) {
      throw new Error("ADMIN은 이름(사용자)을 선택해야 합니다.");
    }
    payload.user_id = userId;
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

export default function Certification() {
  const { effectiveUser: user, isImpersonating } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  const canEdit = !isImpersonating;

  const [items, setItems] = useState<CertificationRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingRecord, setEditingRecord] = useState<CertificationRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<CertificationUserOption[]>([]);

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
        const response = await listCertifications({
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
        const options = await listCertificationUserOptions();
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

  const currentPages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages]);

  function openCreateModal() {
    setFormMode("create");
    setEditingRecord(null);
    setFormError(null);
    setFormState({
      ...initialFormState,
      user_id: isAdmin ? userOptions[0]?.id || "" : ""
    });
    setFormOpen(true);
  }

  function openEditModal(record: CertificationRecord) {
    setFormMode("edit");
    setEditingRecord(record);
    setFormError(null);
    setFormState({
      user_id: record.user_id,
      cert_name: record.cert_name,
      grade: record.grade,
      acquired_date: record.acquired_date,
      credits: record.credits === null ? "" : String(record.credits)
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
      const payload = buildFormPayload(formState, isAdmin);
      if (formMode === "edit" && editingRecord) {
        await updateCertification(editingRecord.id, payload);
      } else {
        await createCertification(payload);
      }

      setFormOpen(false);
      refreshList();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function onDelete(record: CertificationRecord) {
    const confirmed = window.confirm(`\"${record.cert_name}\" 자격증 이력을 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setRowActionLoadingId(record.id);

    try {
      await deleteCertification(record.id);
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
        <h2 className="text-2xl font-bold">자격증</h2>
        {canEdit && (
          <button onClick={openCreateModal} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            + 자격증 등록
          </button>
        )}
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          placeholder="자격증명/이름 검색"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

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
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">부서</th>
                <th className="py-2 pr-3">팀</th>
                <th className="py-2 pr-3">자격증명</th>
                <th className="py-2 pr-3">등급</th>
                <th className="py-2 pr-3">취득일</th>
                <th className="py-2 pr-3">인정학점</th>
                <th className="py-2 pr-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    조회된 자격증 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3">{item.employee_name}</td>
                    <td className="py-2 pr-3">{item.department}</td>
                    <td className="py-2 pr-3">{item.team}</td>
                    <td className="py-2 pr-3">{item.cert_name}</td>
                    <td className="py-2 pr-3">{item.grade}</td>
                    <td className="py-2 pr-3">{item.acquired_date}</td>
                    <td className="py-2 pr-3">{formatNumber(item.credits)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit && (
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            title="수정"
                            disabled={rowActionLoadingId === item.id}
                            onClick={() => openEditModal(item)}
                          >
                            ✏ 수정
                          </button>
                        )}
                        {canEdit && (
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
            <h3 className="text-lg font-semibold mb-4">{formMode === "create" ? "자격증 등록" : "자격증 수정"}</h3>
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
                  <span className="text-sm text-slate-700">자격증명</span>
                  <input
                    value={formState.cert_name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, cert_name: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">등급</span>
                  <input
                    value={formState.grade}
                    onChange={(event) => setFormState((prev) => ({ ...prev, grade: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">취득일</span>
                  <input
                    type="date"
                    value={formState.acquired_date}
                    onChange={(event) => setFormState((prev) => ({ ...prev, acquired_date: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-slate-700">인정학점</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formState.credits}
                    onChange={(event) => setFormState((prev) => ({ ...prev, credits: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

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
    </section>
  );
}

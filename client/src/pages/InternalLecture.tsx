import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createInternalLecture,
  deleteInternalLecture,
  listInternalLectureUserOptions,
  listInternalLectures,
  updateInternalLecture
} from "../api/internalLectures";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { InternalLectureFormPayload, InternalLectureRecord, InternalLectureUserOption, TrainingType } from "../types/internalLecture";

const PAGE_LIMIT = 10;

type FormMode = "create" | "edit";

type FormState = {
  user_id: string;
  lecture_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: string;
  department_instructor: string;
  credits: string;
};

const initialFormState: FormState = {
  user_id: "",
  lecture_name: "",
  type: "OFFLINE",
  start_date: "",
  end_date: "",
  hours: "",
  department_instructor: "",
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

  return "사내강의 처리 중 오류가 발생했습니다.";
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function buildFormPayload(form: FormState, admin: boolean): InternalLectureFormPayload {
  const lectureName = form.lecture_name.trim();
  const departmentInstructor = form.department_instructor.trim();
  const startDate = form.start_date.trim();
  const endDate = form.end_date.trim();

  if (!lectureName) {
    throw new Error("강의명은 필수입니다.");
  }

  if (!departmentInstructor) {
    throw new Error("주관부서(강사명)은 필수입니다.");
  }

  if (!startDate || !endDate) {
    throw new Error("시작일/종료일은 필수입니다.");
  }

  if (endDate < startDate) {
    throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
  }

  const hours = Number(form.hours);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error("강의시간은 0 이상 숫자여야 합니다.");
  }

  let credits: number | null = null;
  if (form.credits.trim()) {
    const parsedCredits = Number(form.credits);
    if (!Number.isFinite(parsedCredits) || parsedCredits < 0) {
      throw new Error("학점은 0 이상 숫자여야 합니다.");
    }
    credits = parsedCredits;
  }

  const payload: InternalLectureFormPayload = {
    lecture_name: lectureName,
    type: form.type,
    start_date: startDate,
    end_date: endDate,
    hours,
    department_instructor: departmentInstructor,
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

export default function InternalLecture() {
  const { effectiveUser: user } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [items, setItems] = useState<InternalLectureRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingRecord, setEditingRecord] = useState<InternalLectureRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<InternalLectureUserOption[]>([]);

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
        const response = await listInternalLectures({
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
        const options = await listInternalLectureUserOptions();
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

  function openEditModal(record: InternalLectureRecord) {
    setFormMode("edit");
    setEditingRecord(record);
    setFormError(null);
    setFormState({
      user_id: record.user_id,
      lecture_name: record.lecture_name,
      type: record.type,
      start_date: record.start_date,
      end_date: record.end_date,
      hours: String(record.hours),
      department_instructor: record.department_instructor,
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
        await updateInternalLecture(editingRecord.id, payload);
      } else {
        await createInternalLecture(payload);
      }

      setFormOpen(false);
      refreshList();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function onDelete(record: InternalLectureRecord) {
    const confirmed = window.confirm(`\"${record.lecture_name}\" 강의 이력을 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setRowActionLoadingId(record.id);

    try {
      await deleteInternalLecture(record.id);
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
        <h2 className="text-2xl font-bold">사내강의</h2>
        {isAdmin && (
          <button onClick={openCreateModal} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            + 사내강의 등록
          </button>
        )}
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          placeholder="강의명/이름 검색"
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
                <th className="py-2 pr-3">강의명</th>
                <th className="py-2 pr-3">구분</th>
                <th className="py-2 pr-3">시작일</th>
                <th className="py-2 pr-3">종료일</th>
                <th className="py-2 pr-3">강의시간</th>
                <th className="py-2 pr-3">주관부서(강사명)</th>
                <th className="py-2 pr-3">학점</th>
                <th className="py-2 pr-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    조회된 사내강의 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3">{item.employee_name}</td>
                    <td className="py-2 pr-3">{item.lecture_name}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{item.type}</span>
                    </td>
                    <td className="py-2 pr-3">{item.start_date}</td>
                    <td className="py-2 pr-3">{item.end_date}</td>
                    <td className="py-2 pr-3">{formatNumber(item.hours)}</td>
                    <td className="py-2 pr-3">{item.department_instructor}</td>
                    <td className="py-2 pr-3">{formatNumber(item.credits)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
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
            <h3 className="text-lg font-semibold mb-4">{formMode === "create" ? "사내강의 등록" : "사내강의 수정"}</h3>
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
                  <span className="text-sm text-slate-700">강의명</span>
                  <input
                    value={formState.lecture_name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, lecture_name: event.target.value }))}
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
                  <span className="text-sm text-slate-700">강의시간</span>
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
                  <span className="text-sm text-slate-700">주관부서(강사명)</span>
                  <input
                    value={formState.department_instructor}
                    onChange={(event) => setFormState((prev) => ({ ...prev, department_instructor: event.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
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

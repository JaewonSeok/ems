import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bulkUploadUsers,
  createUser,
  deactivateUser,
  downloadUserTemplate,
  listUsers,
  resetUserPassword,
  updateUser
} from "../api/users";
import { ManagedUser, UserBulkUploadResult, UserFormPayload, UserRole, UserStatusFilter } from "../types/userManagement";

const PAGE_LIMIT = 20;

type FormMode = "create" | "edit";

type FormState = {
  name: string;
  email: string;
  employee_id: string;
  department: string;
  team: string;
  role: UserRole;
};

const initialFormState: FormState = {
  name: "",
  email: "",
  employee_id: "",
  department: "",
  team: "",
  role: "USER"
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

  return "사용자 관리 처리 중 오류가 발생했습니다.";
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

function validateForm(state: FormState): UserFormPayload {
  const name = state.name.trim();
  const email = state.email.trim().toLowerCase();
  const employeeId = state.employee_id.trim();
  const department = state.department.trim();
  const team = state.team.trim();

  if (!name) {
    throw new Error("이름은 필수입니다.");
  }

  if (!email) {
    throw new Error("이메일은 필수입니다.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }

  if (!employeeId) {
    throw new Error("사번은 필수입니다.");
  }

  if (!department) {
    throw new Error("부서는 필수입니다.");
  }

  if (!team) {
    throw new Error("팀은 필수입니다.");
  }

  return {
    name,
    email,
    employee_id: employeeId,
    department,
    team,
    role: state.role
  };
}

function statusBadgeClass(isActive: boolean) {
  return isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700";
}

export default function UserManagement() {
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<UserBulkUploadResult | null>(null);

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
        const response = await listUsers({
          page,
          limit: PAGE_LIMIT,
          search: search || undefined,
          role: roleFilter,
          status: statusFilter
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
  }, [page, search, roleFilter, statusFilter, reloadToken]);

  const currentPages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages]);

  function openCreateModal() {
    setFormMode("create");
    setEditingUser(null);
    setFormError(null);
    setFormState(initialFormState);
    setFormOpen(true);
  }

  function openEditModal(user: ManagedUser) {
    setFormMode("edit");
    setEditingUser(user);
    setFormError(null);
    setFormState({
      name: user.name,
      email: user.email,
      employee_id: user.employee_id,
      department: user.department,
      team: user.team,
      role: user.role
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
      const payload = validateForm(formState);

      if (formMode === "edit" && editingUser) {
        await updateUser(editingUser.id, payload);
      } else {
        await createUser(payload);
      }

      setFormOpen(false);
      refreshList();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function onResetPassword(user: ManagedUser) {
    const confirmed = window.confirm(`"${user.name}" 사용자의 비밀번호를 사번으로 초기화하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setRowActionLoadingId(`${user.id}:reset`);

    try {
      await resetUserPassword(user.id);
      window.alert("비밀번호를 사번으로 초기화했습니다. 다음 로그인 시 비밀번호 변경이 필요합니다.");
      refreshList();
    } catch (resetError) {
      window.alert(getErrorMessage(resetError));
    } finally {
      setRowActionLoadingId(null);
    }
  }

  async function onDeactivate(user: ManagedUser) {
    if (!user.is_active) {
      return;
    }

    const confirmed = window.confirm(`"${user.name}" 사용자를 비활성화하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setRowActionLoadingId(`${user.id}:deactivate`);

    try {
      await deactivateUser(user.id);
      refreshList();
    } catch (deactivateError) {
      window.alert(getErrorMessage(deactivateError));
    } finally {
      setRowActionLoadingId(null);
    }
  }

  async function onDownloadTemplate() {
    setTemplateDownloading(true);

    try {
      const file = await downloadUserTemplate();
      const objectUrl = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (templateError) {
      window.alert(getErrorMessage(templateError));
    } finally {
      setTemplateDownloading(false);
    }
  }

  async function onBulkUpload() {
    if (!bulkFile) {
      setBulkError("업로드할 파일을 선택해주세요.");
      return;
    }

    setBulkUploading(true);
    setBulkError(null);
    setBulkResult(null);

    try {
      const result = await bulkUploadUsers(bulkFile);
      setBulkResult(result);
      setBulkFile(null);
      refreshList();
    } catch (uploadError) {
      setBulkError(getErrorMessage(uploadError));
    } finally {
      setBulkUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">사용자 관리</h2>
        <button onClick={openCreateModal} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          + 사용자 추가
        </button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="search"
            placeholder="이름/이메일/사번 검색"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as "all" | UserRole);
              setPage(1);
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">역할 전체</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as UserStatusFilter);
              setPage(1);
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">상태 전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">일괄 등록</h3>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            onClick={() => void onDownloadTemplate()}
            disabled={templateDownloading}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            {templateDownloading ? "템플릿 다운로드 중..." : "📥 템플릿 다운로드"}
          </button>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setBulkFile(file);
            }}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:text-slate-700"
          />

          <button
            onClick={() => void onBulkUpload()}
            disabled={bulkUploading}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {bulkUploading ? "업로드 중..." : "📤 일괄 업로드"}
          </button>
        </div>

        {bulkFile && <p className="text-sm text-slate-600">선택 파일: {bulkFile.name}</p>}
        {bulkError && <p className="text-sm text-rose-700">{bulkError}</p>}

        {bulkResult && (
          <article className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-sm">
              성공 <strong>{bulkResult.createdCount}</strong>건 / 실패 <strong>{bulkResult.failedCount}</strong>건
            </p>

            {bulkResult.failedRows.length > 0 && (
              <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 pr-3">행 번호</th>
                      <th className="py-2 pr-3">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResult.failedRows.map((row) => (
                      <tr key={`${row.row}:${row.message}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-2 pr-3">{row.row}</td>
                        <td className="py-2 pr-3 text-rose-700">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}
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
                <th className="py-2 pr-3">이메일</th>
                <th className="py-2 pr-3">사번</th>
                <th className="py-2 pr-3">부서</th>
                <th className="py-2 pr-3">팀</th>
                <th className="py-2 pr-3">역할</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    등록된 사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3">{item.name}</td>
                    <td className="py-2 pr-3">{item.email}</td>
                    <td className="py-2 pr-3">{item.employee_id}</td>
                    <td className="py-2 pr-3">{item.department}</td>
                    <td className="py-2 pr-3">{item.team}</td>
                    <td className="py-2 pr-3">{item.role}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(item.is_active)}`}>
                        {item.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void onResetPassword(item)}
                          disabled={rowActionLoadingId === `${item.id}:reset`}
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          🔄 비밀번호 초기화
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          disabled={rowActionLoadingId !== null}
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          ✏ 수정
                        </button>
                        <button
                          onClick={() => void onDeactivate(item)}
                          disabled={!item.is_active || rowActionLoadingId === `${item.id}:deactivate`}
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                        >
                          🚫 비활성화
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      )}

      <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-600">총 {totalCount}건</p>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1}
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            이전
          </button>

          {currentPages.map((pageNumber) => (
            <button
              key={pageNumber}
              onClick={() => setPage(pageNumber)}
              className={`rounded px-3 py-1 text-sm border ${
                pageNumber === page ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
              }`}
            >
              {pageNumber}
            </button>
          ))}

          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page >= totalPages}
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </footer>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
            <header className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{formMode === "edit" ? "사용자 수정" : "사용자 추가"}</h3>
              <button onClick={closeFormModal} disabled={formSubmitting} className="text-slate-500">
                닫기
              </button>
            </header>

            <form className="space-y-3" onSubmit={onSubmitForm}>
              <div>
                <label htmlFor="user-name" className="mb-1 block text-sm font-medium">
                  이름
                </label>
                <input
                  id="user-name"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="user-email" className="mb-1 block text-sm font-medium">
                  이메일
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={formState.email}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="user-employee-id" className="mb-1 block text-sm font-medium">
                  사번
                </label>
                <input
                  id="user-employee-id"
                  value={formState.employee_id}
                  onChange={(event) => setFormState((prev) => ({ ...prev, employee_id: event.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="user-department" className="mb-1 block text-sm font-medium">
                  부서
                </label>
                <input
                  id="user-department"
                  value={formState.department}
                  onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="user-team" className="mb-1 block text-sm font-medium">
                  팀
                </label>
                <input
                  id="user-team"
                  value={formState.team}
                  onChange={(event) => setFormState((prev) => ({ ...prev, team: event.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="user-role" className="mb-1 block text-sm font-medium">
                  역할
                </label>
                <select
                  id="user-role"
                  value={formState.role}
                  onChange={(event) => setFormState((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="USER">USER</option>
                </select>
              </div>

              {formError && <p className="text-sm text-rose-700">{formError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={formSubmitting}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {formSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { distributeToLectures } from "../../api/internalTrainings";
import { listInternalTrainingUserOptions } from "../../api/internalTrainings";
import { InternalTrainingUserOption } from "../../types/internalTraining";

type Props = {
  trainingId: string;
  trainingName: string;
  onClose: () => void;
  onComplete: () => void;
};

export default function AttendeeSelectModal({ trainingId, trainingName, onClose, onComplete }: Props) {
  const [allUsers, setAllUsers] = useState<InternalTrainingUserOption[]>([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<InternalTrainingUserOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void (async () => {
      try {
        const users = await listInternalTrainingUserOptions();
        setAllUsers(users);
        setFiltered(users);
      } catch {
        setLoadError("직원 목록을 불러오지 못했습니다.");
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = val.trim().toLowerCase();
      setFiltered(q ? allUsers.filter((u) => u.name.toLowerCase().includes(q)) : allUsers);
    }, 300);
  }

  function toggleUser(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((u) => next.add(u.id));
        return next;
      });
    }
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setResultMessage(null);
    try {
      const result = await distributeToLectures(trainingId, Array.from(selected));
      const parts: string[] = [];
      if (result.created_count > 0) parts.push(`${result.created_count}명 등록 완료`);
      if (result.skipped_duplicate > 0) parts.push(`${result.skipped_duplicate}명 중복 건너뜀`);
      if (result.skipped_invalid > 0) parts.push(`${result.skipped_invalid}명 유효하지 않음`);
      setResultMessage(parts.join(", ") || "처리 완료");
      onComplete();
    } catch {
      setResultMessage("출석 등록에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: "70vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            출석 등록 — {trainingName}
          </h2>
          <button onClick={onClose} disabled={submitting} className="text-xl leading-none text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="border-b px-5 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="이름으로 검색..."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Select all row */}
        {!loadingUsers && !loadError && filtered.length > 0 && (
          <div className="flex items-center gap-2 border-b bg-slate-50 px-5 py-2">
            <input
              type="checkbox"
              id="select-all"
              checked={allFilteredSelected}
              onChange={toggleAll}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600"
            />
            <label htmlFor="select-all" className="cursor-pointer text-xs text-slate-600 select-none">
              전체 선택 / 전체 해제 ({filtered.length}명)
            </label>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingUsers && (
            <p className="px-5 py-4 text-sm text-slate-500">로딩 중...</p>
          )}
          {!loadingUsers && loadError && (
            <p className="px-5 py-4 text-sm text-rose-600">{loadError}</p>
          )}
          {!loadingUsers && !loadError && filtered.length === 0 && (
            <p className="px-5 py-4 text-sm text-slate-500">검색 결과가 없습니다.</p>
          )}
          {!loadingUsers && !loadError && filtered.map((user) => (
            <label
              key={user.id}
              className="flex cursor-pointer items-center gap-3 border-b px-5 py-3 last:border-b-0 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.has(user.id)}
                onChange={() => toggleUser(user.id)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{user.name}</span>
                <span className="ml-2 text-xs text-slate-500">{user.department} / {user.team}</span>
                <span className="ml-2 text-xs text-slate-400">{user.employee_id}</span>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-5 py-3 rounded-b-xl space-y-2">
          {resultMessage && (
            <p className="text-sm text-indigo-700">{resultMessage}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || selected.size === 0}
              className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? "등록 중..." : `선택 ${selected.size}명 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

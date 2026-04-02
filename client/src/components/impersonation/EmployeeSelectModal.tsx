import { useCallback, useEffect, useRef, useState } from "react";
import { ImpersonableUser, searchImpersonableUsers, startImpersonationRequest } from "../../api/impersonation";
import { useImpersonationStore } from "../../store/impersonationStore";
import { AuthUser } from "../../types/auth";

type Props = {
  onClose: () => void;
};

export default function EmployeeSelectModal({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ImpersonableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null); // user id being started
  const { startImpersonation } = useImpersonationStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Load all employees initially
    void fetchUsers("");
  }, []);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchImpersonableUsers(q);
      setResults(data);
    } catch {
      setError("직원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchUsers(val), 300);
  }

  async function handleSelect(user: ImpersonableUser) {
    setStarting(user.id);
    setError(null);
    try {
      const targetUser = await startImpersonationRequest(user.id);
      startImpersonation(targetUser as AuthUser);
      onClose();
    } catch {
      setError("직원 정보를 불러오지 못했습니다.");
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-slate-800">직원 화면 보기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="이름으로 검색..."
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <p className="px-5 py-4 text-sm text-slate-500">로딩 중...</p>
          )}
          {!loading && error && (
            <p className="px-5 py-4 text-sm text-red-500">{error}</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-5 py-4 text-sm text-slate-500">검색 결과가 없습니다.</p>
          )}
          {!loading && results.map((user) => (
            <button
              key={user.id}
              onClick={() => void handleSelect(user)}
              disabled={starting === user.id}
              className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b last:border-b-0 disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-800 text-sm">{user.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{user.department} / {user.team}</span>
                </div>
                <span className="text-xs text-blue-600">
                  {starting === user.id ? "로딩..." : "선택"}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-slate-50 rounded-b-lg">
          <p className="text-xs text-slate-400">선택한 직원의 화면을 읽기 전용으로 봅니다. 데이터 변경은 불가합니다.</p>
        </div>
      </div>
    </div>
  );
}

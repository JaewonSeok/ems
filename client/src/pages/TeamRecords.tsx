import { useCallback, useEffect, useMemo, useState } from "react";
import { getMemberRecords, getTeamSummary, listTeamMembers, MemberRecordsResponse, TeamSummaryMember } from "../api/teamRecords";
import { useAuthStore } from "../store/authStore";

function formatDate(dateStr?: string) {
  if (!dateStr) return "-";
  return dateStr.slice(0, 10);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const e = error as { response?: { data?: { message?: string } } };
    if (typeof e.response?.data?.message === "string") return e.response.data.message;
  }
  return "오류가 발생했습니다.";
}

type ViewMode = "summary" | "list";

export default function TeamRecords() {
  const { user } = useAuthStore();
  const positionTitle = user?.position_title;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<ViewMode>("summary");

  // Summary state
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<{
    summary: { totalMembers: number; membersWithTraining: number; completionRate: number };
    members: TeamSummaryMember[];
    scope: { position_title: string | null; department: string; team: string };
  } | null>(null);

  // Member list state
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [memberItems, setMemberItems] = useState<TeamSummaryMember[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail modal
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<MemberRecordsResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Search debounce
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getTeamSummary(year);
      setSummaryData(data);
    } catch (err) {
      setSummaryError(getErrorMessage(err));
    } finally {
      setSummaryLoading(false);
    }
  }, [year]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await listTeamMembers({ page, limit: 20, search: search || undefined });
      setMemberItems(data.items as TeamSummaryMember[]);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch (err) {
      setListError(getErrorMessage(err));
    } finally {
      setListLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (viewMode === "list") {
      void loadList();
    }
  }, [viewMode, loadList]);

  async function openDetail(memberId: string) {
    setSelectedMemberId(memberId);
    setDetailLoading(true);
    setDetailData(null);
    setDetailError(null);
    try {
      const data = await getMemberRecords(memberId);
      setDetailData(data);
    } catch (err) {
      setDetailError(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedMemberId(null);
    setDetailData(null);
    setDetailError(null);
  }

  const scopeLabel = useMemo(() => {
    if (!summaryData) return "";
    const { position_title, department, team } = summaryData.scope;
    if (position_title === "본부장") return "전체 조직";
    if (position_title === "부문장" || position_title === "실장") return `${department} 부서`;
    if (position_title === "팀장") return `${team} 팀`;
    return "";
  }, [summaryData]);

  if (!positionTitle) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">소속 직원 교육현황</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          직책이 있는 사용자만 소속 직원 교육현황을 조회할 수 있습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">소속 직원 교육현황</h2>
          {summaryData && (
            <p className="text-sm text-slate-500 mt-1">
              {positionTitle} · {scopeLabel}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>

          <div className="flex rounded border border-slate-300 overflow-hidden">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-3 py-2 text-sm ${viewMode === "summary" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
            >
              요약
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
            >
              목록
            </button>
          </div>
        </div>
      </header>

      {/* Summary View */}
      {viewMode === "summary" && (
        <>
          {summaryLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">로딩 중...</div>
          ) : summaryError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
              <p>{summaryError}</p>
              <button onClick={() => void loadSummary()} className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white">
                다시 시도
              </button>
            </div>
          ) : summaryData ? (
            <>
              {/* 통계 카드 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm text-slate-500">총 소속 직원</p>
                  <p className="text-3xl font-bold mt-1">{summaryData.summary.totalMembers}명</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm text-slate-500">교육 이수자</p>
                  <p className="text-3xl font-bold mt-1 text-emerald-600">{summaryData.summary.membersWithTraining}명</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm text-slate-500">{year}년 이수율</p>
                  <p className="text-3xl font-bold mt-1 text-blue-600">{summaryData.summary.completionRate}%</p>
                </div>
              </div>

              {/* 직원별 현황 */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-auto">
                <h3 className="font-semibold mb-3">직원별 교육 현황 ({year}년)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 pr-3">이름</th>
                      <th className="py-2 pr-3">사번</th>
                      <th className="py-2 pr-3">부서</th>
                      <th className="py-2 pr-3">팀</th>
                      <th className="py-2 pr-3">교육 건수</th>
                      <th className="py-2 pr-3">이수 상태</th>
                      <th className="py-2 pr-3">상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.members.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">소속 직원이 없습니다.</td>
                      </tr>
                    ) : (
                      summaryData.members.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-2 pr-3">{m.name}</td>
                          <td className="py-2 pr-3">{m.employee_id}</td>
                          <td className="py-2 pr-3">{m.department}</td>
                          <td className="py-2 pr-3">{m.team}</td>
                          <td className="py-2 pr-3">{m.training_count}건</td>
                          <td className="py-2 pr-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${m.has_training ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {m.has_training ? "이수" : "미이수"}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              onClick={() => void openDetail(m.id)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              상세 보기
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <input
              type="search"
              placeholder="이름/사번 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {listLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">로딩 중...</div>
          ) : listError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{listError}</div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-3">이름</th>
                    <th className="py-2 pr-3">사번</th>
                    <th className="py-2 pr-3">부서</th>
                    <th className="py-2 pr-3">팀</th>
                    <th className="py-2 pr-3">직책</th>
                    <th className="py-2 pr-3">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {memberItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">소속 직원이 없습니다.</td>
                    </tr>
                  ) : (
                    memberItems.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-2 pr-3">{m.name}</td>
                        <td className="py-2 pr-3">{m.employee_id}</td>
                        <td className="py-2 pr-3">{m.department}</td>
                        <td className="py-2 pr-3">{m.team}</td>
                        <td className="py-2 pr-3">{m.position_title ?? "-"}</td>
                        <td className="py-2 pr-3">
                          <button
                            onClick={() => void openDetail(m.id)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            교육내역
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <footer className="flex items-center justify-between mt-3">
                <p className="text-sm text-slate-600">총 {totalCount}명</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1} className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">이전</button>
                  <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages} className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">다음</button>
                </div>
              </footer>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-lg max-h-[85vh] flex flex-col">
            <header className="mb-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold">
                {detailData ? `${detailData.member.name} 교육 이수 내역` : "교육 내역 로딩 중..."}
              </h3>
              <button onClick={closeDetail} className="text-slate-500">닫기</button>
            </header>

            {detailLoading ? (
              <p className="text-center text-slate-500 py-8">로딩 중...</p>
            ) : detailError ? (
              <p className="text-rose-700">{detailError}</p>
            ) : detailData ? (
              <div className="overflow-auto space-y-4">
                {/* External Trainings */}
                <section>
                  <h4 className="font-medium text-slate-700 mb-2">외부 교육 ({detailData.records.externalTrainings.length}건)</h4>
                  {detailData.records.externalTrainings.length === 0 ? (
                    <p className="text-sm text-slate-400">내역 없음</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 text-left"><th className="py-1 pr-2">교육명</th><th className="py-1 pr-2">기간</th><th className="py-1 pr-2">시간</th><th className="py-1">기관</th></tr></thead>
                      <tbody>
                        {detailData.records.externalTrainings.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="py-1 pr-2">{r.training_name}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{formatDate(r.start_date)} ~ {formatDate(r.end_date)}</td>
                            <td className="py-1 pr-2">{r.hours}h</td>
                            <td className="py-1">{r.institution}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                {/* Internal Trainings */}
                <section>
                  <h4 className="font-medium text-slate-700 mb-2">내부 교육 ({detailData.records.internalTrainings.length}건)</h4>
                  {detailData.records.internalTrainings.length === 0 ? (
                    <p className="text-sm text-slate-400">내역 없음</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 text-left"><th className="py-1 pr-2">교육명</th><th className="py-1 pr-2">기간</th><th className="py-1 pr-2">시간</th><th className="py-1">기관</th></tr></thead>
                      <tbody>
                        {detailData.records.internalTrainings.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="py-1 pr-2">{r.training_name}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{formatDate(r.start_date)} ~ {formatDate(r.end_date)}</td>
                            <td className="py-1 pr-2">{r.hours}h</td>
                            <td className="py-1">{r.institution}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                {/* Internal Lectures */}
                <section>
                  <h4 className="font-medium text-slate-700 mb-2">사내 강의 ({detailData.records.internalLectures.length}건)</h4>
                  {detailData.records.internalLectures.length === 0 ? (
                    <p className="text-sm text-slate-400">내역 없음</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 text-left"><th className="py-1 pr-2">강의명</th><th className="py-1 pr-2">기간</th><th className="py-1 pr-2">시간</th></tr></thead>
                      <tbody>
                        {detailData.records.internalLectures.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="py-1 pr-2">{r.lecture_name}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{formatDate(r.start_date)} ~ {formatDate(r.end_date)}</td>
                            <td className="py-1 pr-2">{r.hours}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                {/* Certifications */}
                <section>
                  <h4 className="font-medium text-slate-700 mb-2">자격증 ({detailData.records.certifications.length}건)</h4>
                  {detailData.records.certifications.length === 0 ? (
                    <p className="text-sm text-slate-400">내역 없음</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 text-left"><th className="py-1 pr-2">자격증명</th><th className="py-1 pr-2">등급</th><th className="py-1">취득일</th></tr></thead>
                      <tbody>
                        {detailData.records.certifications.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="py-1 pr-2">{r.cert_name}</td>
                            <td className="py-1 pr-2">{r.grade}</td>
                            <td className="py-1">{formatDate(r.acquired_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

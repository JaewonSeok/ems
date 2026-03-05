import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getDashboardCategoryCount,
  getDashboardDepartmentSummary,
  getDashboardMonthlyHours,
  getDashboardSummary,
  seedDashboardDemo
} from "../api/dashboard";
import {
  DashboardCategory,
  DashboardCategoryCountResponse,
  DashboardDepartmentSummaryResponse,
  DashboardMonthlyHoursResponse,
  DashboardSummary
} from "../types/dashboard";

type DashboardData = {
  summary: DashboardSummary;
  monthly: DashboardMonthlyHoursResponse;
  category: DashboardCategoryCountResponse;
  department: DashboardDepartmentSummaryResponse;
};

const categoryColor: Record<DashboardCategory, string> = {
  EXTERNAL: "#3b82f6",
  INTERNAL: "#22c55e",
  LECTURE: "#f97316"
};

const categoryLabel: Record<DashboardCategory, string> = {
  EXTERNAL: "사외교육",
  INTERNAL: "사내교육",
  LECTURE: "사내강의"
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function monthLabel(month: number) {
  return `${month}월`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    const responseMessage = maybeResponse.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
  }

  return "대시보드 데이터를 불러오지 못했습니다.";
}

export default function Dashboard() {
  const [yearInput, setYearInput] = useState("2026");
  const [year, setYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadDashboard = useCallback(async (targetYear: number) => {
    setLoading(true);
    setError(null);

    try {
      const [summary, monthly, category, department] = await Promise.all([
        getDashboardSummary(),
        getDashboardMonthlyHours(targetYear),
        getDashboardCategoryCount(),
        getDashboardDepartmentSummary()
      ]);

      setData({ summary, monthly, category, department });
    } catch (loadError) {
      setData(null);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(year);
  }, [loadDashboard, year]);

  const hasNoData = useMemo(() => {
    if (!data) {
      return false;
    }
    return data.summary.totalRecords === 0;
  }, [data]);

  function onApplyYear() {
    const parsedYear = Number(yearInput.trim());

    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      setError("연도는 2000~2100 범위의 정수여야 합니다.");
      return;
    }

    setYear(parsedYear);
  }

  async function onSeedDemo() {
    setSeedLoading(true);
    setError(null);

    try {
      const result = await seedDashboardDemo();
      if (!result.inserted) {
        setError(result.message);
      }
      await loadDashboard(year);
    } catch (seedError) {
      setError(getErrorMessage(seedError));
    } finally {
      setSeedLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="dashboard-year">
            연도
          </label>
          <input
            id="dashboard-year"
            type="number"
            min={2000}
            max={2100}
            value={yearInput}
            onChange={(event) => setYearInput(event.target.value)}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button onClick={onApplyYear} className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
            적용
          </button>
        </div>
      </header>

      {loading ? (
        <article className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">로딩 중...</article>
      ) : error ? (
        <article className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-3">
          <p className="text-red-700">{error}</p>
          <button onClick={() => void loadDashboard(year)} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            다시 시도
          </button>
        </article>
      ) : !data ? null : hasNoData ? (
        <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <h3 className="text-lg font-semibold">데이터 없음</h3>
          <p className="text-sm text-slate-600">표시할 대시보드 데이터가 없습니다.</p>
          <p className="text-xs text-slate-500">
            로컬에서만 `POST /api/dashboard/demo-seed`를 사용할 수 있습니다.
            (`ENABLE_DASHBOARD_DEMO_SEED=true`, production에서는 비활성)
          </p>
          <button
            onClick={() => void onSeedDemo()}
            disabled={seedLoading}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {seedLoading ? "시드 생성 중..." : "로컬 데모 시드 생성"}
          </button>
        </article>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-slate-600">총 교육 건수</p>
              <p className="text-2xl font-bold">{formatNumber(data.summary.totalRecords)}</p>
            </article>
            <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm text-slate-600">총 교육 시간</p>
              <p className="text-2xl font-bold">{formatNumber(data.summary.totalHours)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">총 인정 학점</p>
              <p className="text-2xl font-bold">{formatNumber(data.summary.totalCredits)}</p>
            </article>
            <article className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm text-slate-600">수료증 미제출</p>
              <p className="text-2xl font-bold">{formatNumber(data.summary.notSubmittedCount)}</p>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="h-80 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-semibold">월별 교육 시간</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly.items.map((item) => ({ ...item, label: monthLabel(item.month) }))}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => `${formatNumber(value)}시간`} />
                  <Bar dataKey="hours" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="h-80 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-semibold">카테고리별 교육 건수</h3>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={data.category.items} dataKey="count" nameKey="category" innerRadius={55} outerRadius={95}>
                    {data.category.items.map((item) => (
                      <Cell key={item.category} fill={categoryColor[item.category]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${formatNumber(value)}건`} />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap gap-3 text-sm">
                {data.category.items.map((item) => (
                  <div key={item.category} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: categoryColor[item.category] }} />
                    <span>{categoryLabel[item.category]}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <article className="rounded-xl border border-slate-200 bg-white p-4 overflow-auto">
            <h3 className="mb-3 font-semibold">부서별 현황</h3>
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-2">부서</th>
                  <th className="py-2 pr-2">교육 건수</th>
                  <th className="py-2 pr-2">교육 시간</th>
                  <th className="py-2 pr-2">인정 학점</th>
                </tr>
              </thead>
              <tbody>
                {data.department.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      집계 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  data.department.items.map((item) => (
                    <tr key={item.department} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 pr-2">{item.department}</td>
                      <td className="py-2 pr-2">{formatNumber(item.recordCount)}</td>
                      <td className="py-2 pr-2">{formatNumber(item.hours)}</td>
                      <td className="py-2 pr-2">{formatNumber(item.credits)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>
        </>
      )}
    </section>
  );
}

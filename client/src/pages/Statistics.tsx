import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getStatisticsCompletionRate,
  getStatisticsCostTrend,
  getStatisticsOverview,
  getStatisticsTopEmployees,
  getStatisticsYearComparison
} from "../api/statistics";
import {
  StatisticsCategory,
  StatisticsCategoryFilter,
  StatisticsCompletionRateResponse,
  StatisticsCostTrendResponse,
  StatisticsOverviewResponse,
  StatisticsTopEmployeesResponse,
  StatisticsYearComparisonResponse
} from "../types/statistics";

type StatisticsData = {
  overview: StatisticsOverviewResponse;
  costTrend: StatisticsCostTrendResponse;
  completionRate: StatisticsCompletionRateResponse;
  topEmployees: StatisticsTopEmployeesResponse;
  yearComparison: StatisticsYearComparisonResponse;
};

const CATEGORY_FILTER_OPTIONS: Array<{ value: StatisticsCategoryFilter; label: string }> = [
  { value: "external-training", label: "사외교육" },
  { value: "internal-training", label: "사내교육" },
  { value: "internal-lecture", label: "사내강의" },
  { value: "certification", label: "자격증" }
];

const CHART_CATEGORY_LABEL: Record<StatisticsCategory, string> = {
  "external-training": "사외교육",
  "internal-training": "사내교육",
  "internal-lecture": "사내강의",
  certification: "자격증"
};

const CHART_CATEGORY_COLOR: Record<StatisticsCategory, string> = {
  "external-training": "#2563eb",
  "internal-training": "#16a34a",
  "internal-lecture": "#f97316",
  certification: "#8b5cf6"
};

const TYPE_LABEL: Record<"OFFLINE" | "ONLINE", string> = {
  OFFLINE: "오프라인",
  ONLINE: "온라인"
};

const TYPE_COLOR: Record<"OFFLINE" | "ONLINE", string> = {
  OFFLINE: "#0f766e",
  ONLINE: "#a16207"
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

  return "통계 데이터를 불러오지 못했습니다.";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function monthLabel(month: number) {
  return `${month}월`;
}

function toCategoryParam(selected: StatisticsCategoryFilter[]) {
  if (selected.length === CATEGORY_FILTER_OPTIONS.length) {
    return "all";
  }

  return selected.join(",");
}

function hasAnyValue(values: number[]) {
  return values.some((value) => value > 0);
}

function StatisticsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </article>
  );
}

function EmptyChartMessage({ text = "표시할 데이터가 없습니다." }: { text?: string }) {
  return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{text}</div>;
}

export default function Statistics() {
  const [year, setYear] = useState(2026);
  const [department, setDepartment] = useState("all");
  const [categories, setCategories] = useState<StatisticsCategoryFilter[]>([
    "external-training",
    "internal-training",
    "internal-lecture",
    "certification"
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatisticsData | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const categoryParam = useMemo(() => toCategoryParam(categories), [categories]);
  const isAllCategorySelected = categories.length === CATEGORY_FILTER_OPTIONS.length;

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        year,
        department: department === "all" ? undefined : department,
        category: categoryParam
      };

      const [overview, costTrend, completionRate, topEmployees, yearComparison] = await Promise.all([
        getStatisticsOverview(params),
        getStatisticsCostTrend(params),
        getStatisticsCompletionRate(params),
        getStatisticsTopEmployees(params),
        getStatisticsYearComparison(params)
      ]);

      setData({ overview, costTrend, completionRate, topEmployees, yearComparison });
    } catch (loadError) {
      setData(null);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [categoryParam, department, year]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics, reloadToken]);

  const departmentOptions = data?.overview.meta.departments || [];

  useEffect(() => {
    if (department === "all") {
      return;
    }

    if (!departmentOptions.includes(department)) {
      setDepartment("all");
    }
  }, [department, departmentOptions]);

  const monthlyHoursData = useMemo(
    () => (data ? data.overview.monthlyHours.map((item) => ({ ...item, label: monthLabel(item.month) })) : []),
    [data]
  );

  const categoryCountData = useMemo(
    () =>
      data
        ? data.overview.categoryCounts.map((item) => ({
            ...item,
            label: CHART_CATEGORY_LABEL[item.category]
          }))
        : [],
    [data]
  );

  const typeRatioData = useMemo(
    () =>
      data
        ? data.overview.typeRatios.map((item) => ({
            ...item,
            label: TYPE_LABEL[item.type]
          }))
        : [],
    [data]
  );

  const departmentComparisonData = data?.overview.departmentComparison || [];
  const costTrendData = useMemo(() => (data ? data.costTrend.items.map((item) => ({ ...item, label: monthLabel(item.month) })) : []), [data]);
  const completionRateData = useMemo(
    () =>
      data
        ? data.completionRate.items.map((item) => ({
            ...item,
            label: item.category === "external-training" ? "사외교육" : "사내교육"
          }))
        : [],
    [data]
  );
  const topEmployeeData = useMemo(
    () =>
      data
        ? data.topEmployees.items.map((item) => ({
            ...item,
            label: `${item.name} (${item.employeeId})`
          }))
        : [],
    [data]
  );

  const yearComparisonData = useMemo(
    () =>
      data
        ? data.yearComparison.items.map((item) => ({ ...item, label: monthLabel(item.month) }))
        : [],
    [data]
  );

  const hasAnyData = useMemo(() => {
    if (!data) {
      return false;
    }

    return (
      hasAnyValue(data.overview.monthlyHours.map((item) => item.hours)) ||
      hasAnyValue(data.overview.categoryCounts.map((item) => item.count)) ||
      hasAnyValue(data.overview.typeRatios.map((item) => item.count)) ||
      hasAnyValue(data.overview.departmentComparison.map((item) => item.recordCount + item.hours + item.credits)) ||
      hasAnyValue(data.costTrend.items.map((item) => item.cost)) ||
      hasAnyValue(
        data.completionRate.items.map((item) => item.submitted + item.notSubmitted + item.approved + item.rejected)
      ) ||
      data.topEmployees.items.length > 0 ||
      hasAnyValue(data.yearComparison.items.map((item) => item.currentHours + item.previousHours))
    );
  }, [data]);

  function onToggleAllCategories(checked: boolean) {
    if (checked) {
      setCategories(CATEGORY_FILTER_OPTIONS.map((option) => option.value));
      return;
    }

    setCategories(["external-training"]);
  }

  function onToggleCategory(value: StatisticsCategoryFilter, checked: boolean) {
    if (checked) {
      setCategories((prev) => Array.from(new Set([...prev, value])));
      return;
    }

    setCategories((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((item) => item !== value);
    });
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">통계</h2>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="statistics-year" className="mb-1 block text-sm font-medium text-slate-700">
              연도
            </label>
            <select
              id="statistics-year"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {[2026, 2025, 2024, 2023, 2022].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="statistics-department" className="mb-1 block text-sm font-medium text-slate-700">
              부서
            </label>
            <select
              id="statistics-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">전체</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 block text-sm font-medium text-slate-700">카테고리</p>
            <div className="flex flex-wrap items-center gap-3 rounded border border-slate-300 px-3 py-2 text-sm">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={isAllCategorySelected}
                  onChange={(event) => onToggleAllCategories(event.target.checked)}
                />
                <span>전체</span>
              </label>

              {CATEGORY_FILTER_OPTIONS.map((option) => (
                <label key={option.value} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={categories.includes(option.value)}
                    onChange={(event) => onToggleCategory(option.value, event.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setReloadToken((value) => value + 1)}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            조회
          </button>
        </div>
      </article>

      {loading ? (
        <article className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">로딩 중...</article>
      ) : error ? (
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-6 space-y-3">
          <p className="text-rose-700">{error}</p>
          <button onClick={() => setReloadToken((value) => value + 1)} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            다시 시도
          </button>
        </article>
      ) : !data ? null : (
        <>
          {!hasAnyData && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              등록된 통계 데이터가 없습니다.
            </article>
          )}

          <StatisticsCard title="월별 교육 시간 추이">
            {hasAnyValue(monthlyHoursData.map((item) => item.hours)) ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyHoursData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${formatNumber(Number(value))}시간`} />
                    <Bar dataKey="hours" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartMessage />
            )}
          </StatisticsCard>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatisticsCard title="카테고리별 교육 건수">
              {hasAnyValue(categoryCountData.map((item) => item.count)) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie data={categoryCountData} dataKey="count" nameKey="label" innerRadius={55} outerRadius={95}>
                        {categoryCountData.map((item) => (
                          <Cell key={item.category} fill={CHART_CATEGORY_COLOR[item.category]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${formatNumber(Number(value))}건`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {categoryCountData.map((item) => (
                      <div key={item.category} className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: CHART_CATEGORY_COLOR[item.category] }}
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyChartMessage />
              )}
            </StatisticsCard>

            <StatisticsCard title="구분별 비율 온/오프">
              {hasAnyValue(typeRatioData.map((item) => item.count)) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie data={typeRatioData} dataKey="count" nameKey="label" innerRadius={45} outerRadius={95}>
                        {typeRatioData.map((item) => (
                          <Cell key={item.type} fill={TYPE_COLOR[item.type]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${formatNumber(Number(value))}건`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {typeRatioData.map((item) => (
                      <div key={item.type} className="inline-flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: TYPE_COLOR[item.type] }} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyChartMessage />
              )}
            </StatisticsCard>
          </section>

          <StatisticsCard title="부서별 교육 참여 비교">
            {departmentComparisonData.length > 0 ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentComparisonData} layout="vertical" margin={{ left: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="department" width={130} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "recordCount") {
                          return `${formatNumber(Number(value))}건`;
                        }
                        if (name === "hours") {
                          return `${formatNumber(Number(value))}시간`;
                        }
                        if (name === "credits") {
                          return `${formatNumber(Number(value))}학점`;
                        }
                        return formatNumber(Number(value));
                      }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "recordCount" ? "교육 건수" : value === "hours" ? "교육 시간" : "인정 학점"
                      }
                    />
                    <Bar dataKey="recordCount" fill="#0284c7" name="recordCount" />
                    <Bar dataKey="hours" fill="#16a34a" name="hours" />
                    <Bar dataKey="credits" fill="#9333ea" name="credits" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartMessage />
            )}
          </StatisticsCard>

          <StatisticsCard title="월별 교육 비용 추이">
            {hasAnyValue(costTrendData.map((item) => item.cost)) ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={costTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                    <Line type="monotone" dataKey="cost" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartMessage />
            )}
          </StatisticsCard>

          <StatisticsCard title={`연도별 교육 시간 비교 (${data.yearComparison.previousYear}년 vs ${data.yearComparison.currentYear}년)`}>
            {hasAnyValue(yearComparisonData.map((item) => item.currentHours + item.previousHours)) ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${formatNumber(Number(value))}시간`} />
                    <Legend
                      formatter={(value) =>
                        value === "previousHours"
                          ? `${data.yearComparison.previousYear}년`
                          : `${data.yearComparison.currentYear}년`
                      }
                    />
                    <Bar dataKey="previousHours" fill="#94a3b8" name="previousHours" />
                    <Bar dataKey="currentHours" fill="#2563eb" name="currentHours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartMessage />
            )}
          </StatisticsCard>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatisticsCard title="수료증 제출 현황">
              {hasAnyValue(
                completionRateData.map((item) => item.submitted + item.notSubmitted + item.approved + item.rejected)
              ) ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completionRateData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `${formatNumber(Number(value))}건`} />
                      <Legend />
                      <Bar dataKey="submitted" stackId="cert" fill="#22c55e" name="제출" />
                      <Bar dataKey="notSubmitted" stackId="cert" fill="#f97316" name="미제출" />
                      <Bar dataKey="approved" stackId="cert" fill="#2563eb" name="승인" />
                      <Bar dataKey="rejected" stackId="cert" fill="#ef4444" name="반려" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChartMessage />
              )}
            </StatisticsCard>

            <StatisticsCard title="직원별 교육 시간 TOP 10">
              {topEmployeeData.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topEmployeeData} layout="vertical" margin={{ left: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="label" width={180} />
                      <Tooltip formatter={(value: number) => `${formatNumber(Number(value))}시간`} />
                      <Bar dataKey="totalHours" fill="#334155" name="교육 시간" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChartMessage />
              )}
            </StatisticsCard>
          </section>
        </>
      )}
    </section>
  );
}

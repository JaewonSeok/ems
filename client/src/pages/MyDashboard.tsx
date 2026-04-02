import { useCallback, useEffect, useState } from "react";
import http from "../api/http";

type RecentRecord = {
  category: "external-training" | "internal-training" | "internal-lecture" | "certification";
  name: string;
  date: string;
  hours: number | null;
  credits: number | null;
};

type MySummaryResponse = {
  totalHours: number;
  totalCredits: number;
  notSubmittedCount: number;
  recentRecords: RecentRecord[];
};

const CATEGORY_LABEL: Record<RecentRecord["category"], string> = {
  "external-training": "사외교육",
  "internal-training": "사내교육",
  "internal-lecture": "사내강의",
  certification: "자격증"
};

const CATEGORY_COLOR: Record<RecentRecord["category"], string> = {
  "external-training": "bg-blue-100 text-blue-700",
  "internal-training": "bg-emerald-100 text-emerald-700",
  "internal-lecture": "bg-orange-100 text-orange-700",
  certification: "bg-violet-100 text-violet-700"
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

function KpiCard({
  label,
  value,
  unit,
  accent
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <article className={`rounded-xl border p-5 ${accent}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-bold">
        {value}
        <span className="ml-1 text-base font-normal text-slate-500">{unit}</span>
      </p>
    </article>
  );
}

export default function MyDashboard() {
  const [data, setData] = useState<MySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await http.get<MySummaryResponse>("/dashboard/my-summary");
      setData(res.data);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">내 교육 현황</h2>
      </header>

      {loading ? (
        <article className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          로딩 중...
        </article>
      ) : error ? (
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-6 space-y-3">
          <p className="text-rose-700">{error}</p>
          <button onClick={load} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            다시 시도
          </button>
        </article>
      ) : !data ? null : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="총 교육 시간"
              value={formatNumber(data.totalHours)}
              unit="시간"
              accent="border-blue-200 bg-blue-50"
            />
            <KpiCard
              label="총 인정 학점"
              value={formatNumber(data.totalCredits)}
              unit="점"
              accent="border-emerald-200 bg-emerald-50"
            />
            <KpiCard
              label="수료증 미제출"
              value={String(data.notSubmittedCount)}
              unit="건"
              accent={data.notSubmittedCount > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}
            />
          </section>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold text-slate-800">최근 등록 교육</h3>
            {data.recentRecords.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">등록된 교육 이력이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentRecords.map((record, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[record.category]}`}
                      >
                        {CATEGORY_LABEL[record.category]}
                      </span>
                      <span className="truncate text-sm font-medium text-slate-800">{record.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-sm text-slate-500">
                      {record.hours !== null && (
                        <span>{formatNumber(record.hours)}시간</span>
                      )}
                      {record.credits !== null && (
                        <span>{formatNumber(record.credits)}점</span>
                      )}
                      <span>{record.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  );
}

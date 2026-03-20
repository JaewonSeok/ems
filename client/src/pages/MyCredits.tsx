import { useCallback, useEffect, useState } from "react";
import http from "../api/http";

type CreditItem = {
  id: string;
  training_name?: string;
  lecture_name?: string;
  cert_name?: string;
  start_date?: string;
  end_date?: string;
  acquired_date?: string;
  credits: number | null;
  type?: string;
  grade?: string;
};

type MyCreditsResponse = {
  user: { id: string; name: string; employee_id: string; department: string; team: string } | null;
  year: number | null;
  summary: {
    externalTrainings: number;
    internalTrainings: number;
    internalLectures: number;
    certifications: number;
    total: number;
  };
  items: {
    externalTrainings: CreditItem[];
    internalTrainings: CreditItem[];
    internalLectures: CreditItem[];
    certifications: CreditItem[];
  };
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatCredits(n: number) {
  return n % 1 === 0 ? `${n}.0` : String(n);
}

export default function MyCredits() {
  const [year, setYear] = useState<number | "">(CURRENT_YEAR);
  const [data, setData] = useState<MyCreditsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = year !== "" ? { year } : {};
      const res = await http.get<MyCreditsResponse>("/my-credits", { params });
      setData(res.data);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">총 학점</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm text-slate-600">연도</label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">전체</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">로딩 중...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 space-y-3">
          <p className="text-rose-700">{error}</p>
          <button onClick={() => void load()} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            다시 시도
          </button>
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              { label: "사외교육", value: data.summary.externalTrainings },
              { label: "사내교육", value: data.summary.internalTrainings },
              { label: "사내강의", value: data.summary.internalLectures },
              { label: "자격증", value: data.summary.certifications },
              { label: "합계", value: data.summary.total, highlight: true }
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={`rounded-xl border p-4 text-center ${highlight ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${highlight ? "text-blue-700" : "text-slate-800"}`}>
                  {formatCredits(value)}
                </p>
                <p className="text-xs text-slate-400">학점</p>
              </div>
            ))}
          </div>

          {/* Detail tables */}
          <DetailTable
            title="사외교육"
            items={data.items.externalTrainings}
            nameKey="training_name"
            dateKey="start_date"
          />
          <DetailTable
            title="사내교육"
            items={data.items.internalTrainings}
            nameKey="training_name"
            dateKey="start_date"
          />
          <DetailTable
            title="사내강의"
            items={data.items.internalLectures}
            nameKey="lecture_name"
            dateKey="start_date"
          />
          <DetailTable
            title="자격증"
            items={data.items.certifications}
            nameKey="cert_name"
            dateKey="acquired_date"
            showGrade
          />
        </>
      ) : null}
    </section>
  );
}

function DetailTable({
  title,
  items,
  nameKey,
  dateKey,
  showGrade
}: {
  title: string;
  items: CreditItem[];
  nameKey: keyof CreditItem;
  dateKey: keyof CreditItem;
  showGrade?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold mb-3">{title}</h3>
        <p className="text-sm text-slate-500 py-4 text-center">이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-auto">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-3">이름</th>
            {!showGrade && <th className="py-2 pr-3">구분</th>}
            <th className="py-2 pr-3">날짜</th>
            {showGrade && <th className="py-2 pr-3">등급</th>}
            <th className="py-2 pr-3 text-right">학점</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
              <td className="py-2 pr-3">{String(item[nameKey] ?? "-")}</td>
              {!showGrade && <td className="py-2 pr-3">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item.type ?? "-"}</span>
              </td>}
              <td className="py-2 pr-3">{String(item[dateKey] ?? "-").slice(0, 10)}</td>
              {showGrade && <td className="py-2 pr-3">{item.grade ?? "-"}</td>}
              <td className="py-2 pr-3 text-right font-medium">{formatCredits(Number(item.credits ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

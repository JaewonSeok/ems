import { useRef, useState } from "react";
import { bulkUploadExternalEducations } from "../api/educations";
import { downloadBulkUploadTemplate, uploadBulkUploadFile } from "../api/bulkUpload";
import { BulkUploadCategory, BulkUploadResult } from "../types/bulkUpload";
import type { ExternalEducationRowData } from "../types/externalBulkUpload";
import { downloadExternalEducationTemplate } from "../utils/externalEducationTemplate";
import { parseExternalEducationFile, rowsToRecords } from "../utils/externalEducationParser";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_EXT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_OTHER_FILE_SIZE = 10 * 1024 * 1024;
const PAGE_SIZE = 20;

const OTHER_CATEGORY_OPTIONS: Array<{ value: BulkUploadCategory; label: string }> = [
  { value: "external-training", label: "사외교육" },
  { value: "internal-training", label: "사내교육" },
  { value: "internal-lecture", label: "사내강의" },
  { value: "certification", label: "자격증" },
];

type ActiveTab = "external-education" | "others";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAxiosErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as { response?: { data?: { message?: string; error?: string } } };
    const msg = e.response?.data?.message ?? e.response?.data?.error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

// ─── Preview table column definitions ────────────────────────────────────────

const PREVIEW_COLS = [
  { key: "no", label: "No", width: "w-12" },
  { key: "division", label: "본부", width: "w-24" },
  { key: "team", label: "팀", width: "w-24" },
  { key: "name", label: "이름", width: "w-20" },
  { key: "educationType", label: "교육구분", width: "w-24" },
  { key: "educationName", label: "교육명", width: "w-48" },
  { key: "startDate", label: "시작일자", width: "w-28" },
  { key: "endDate", label: "종료일자", width: "w-28" },
  { key: "days", label: "교육일수", width: "w-20" },
  { key: "cost", label: "교육비", width: "w-24" },
  { key: "organizer", label: "교육주관", width: "w-36" },
  { key: "certificate", label: "이수증", width: "w-16" },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkUpload() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("external-education");

  // ── External Education tab state ──
  const extFileInputRef = useRef<HTMLInputElement | null>(null);
  const [extDragActive, setExtDragActive] = useState(false);
  const [extFile, setExtFile] = useState<File | null>(null);
  const [extParsing, setExtParsing] = useState(false);
  const [extUploading, setExtUploading] = useState(false);
  const [extRows, setExtRows] = useState<ExternalEducationRowData[] | null>(null);
  const [extError, setExtError] = useState<string | null>(null);
  const [extSuccess, setExtSuccess] = useState<string | null>(null);
  const [extPage, setExtPage] = useState(1);

  // ── Other categories tab state ──
  const otherFileInputRef = useRef<HTMLInputElement | null>(null);
  const [otherDragActive, setOtherDragActive] = useState(false);
  const [otherCategory, setOtherCategory] = useState<BulkUploadCategory>("external-training");
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [otherDownloading, setOtherDownloading] = useState(false);
  const [otherUploading, setOtherUploading] = useState(false);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [otherResult, setOtherResult] = useState<BulkUploadResult | null>(null);

  // ── External Education: template download ──
  function handleExtTemplateDownload() {
    try {
      downloadExternalEducationTemplate();
    } catch {
      setExtError("템플릿 다운로드 중 오류가 발생했습니다.");
    }
  }

  // ── External Education: file assignment + parse ──
  async function assignExtFile(file: File | null) {
    if (!file) return;

    if (!hasAllowedExtension(file.name)) {
      setExtError("허용된 확장자는 .xlsx, .xls 입니다.");
      return;
    }
    if (file.size > MAX_EXT_FILE_SIZE) {
      setExtError("최대 파일 크기는 5MB입니다.");
      return;
    }

    setExtFile(file);
    setExtError(null);
    setExtSuccess(null);
    setExtRows(null);
    setExtPage(1);
    setExtParsing(true);

    try {
      const rows = await parseExternalEducationFile(file);
      if (rows.length === 0) {
        setExtError("데이터 행이 없습니다. 2행부터 데이터를 입력해주세요.");
        setExtFile(null);
      } else {
        setExtRows(rows);
      }
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "파일 파싱 중 오류가 발생했습니다.");
      setExtFile(null);
    } finally {
      setExtParsing(false);
    }
  }

  // ── External Education: reset ──
  function handleExtReset() {
    setExtFile(null);
    setExtRows(null);
    setExtError(null);
    setExtSuccess(null);
    setExtPage(1);
  }

  // ── External Education: upload ──
  async function handleExtUpload() {
    if (!extRows) return;

    const validRows = extRows.filter((r) => r._isValid);
    const errorCount = extRows.filter((r) => !r._isValid).length;

    if (validRows.length === 0) {
      setExtError("업로드할 정상 데이터가 없습니다.");
      return;
    }

    const confirmMsg =
      errorCount > 0
        ? `오류 데이터 ${errorCount}건이 있습니다. 오류 행을 제외하고 ${validRows.length}건을 업로드하시겠습니까?`
        : `${validRows.length}건을 업로드하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setExtUploading(true);
    setExtError(null);

    try {
      const records = rowsToRecords(validRows);
      const result = await bulkUploadExternalEducations(records);

      if (result.success) {
        setExtSuccess(`${result.insertedCount ?? 0}건이 성공적으로 업로드되었습니다.`);
        setExtRows(null);
        setExtFile(null);
        setExtPage(1);
      } else {
        setExtError(result.error ?? "업로드에 실패했습니다.");
      }
    } catch (err) {
      setExtError(getAxiosErrorMessage(err, "업로드 중 오류가 발생했습니다."));
    } finally {
      setExtUploading(false);
    }
  }

  // ── External Education: pagination ──
  const extTotalPages = extRows ? Math.ceil(extRows.length / PAGE_SIZE) : 0;
  const extPagedRows = extRows
    ? extRows.slice((extPage - 1) * PAGE_SIZE, extPage * PAGE_SIZE)
    : [];
  const extValidCount = extRows?.filter((r) => r._isValid).length ?? 0;
  const extErrorCount = extRows?.filter((r) => !r._isValid).length ?? 0;

  // ── Other categories: template download ──
  async function handleOtherDownload() {
    setOtherDownloading(true);
    setOtherError(null);
    try {
      const template = await downloadBulkUploadTemplate(otherCategory);
      const objectUrl = URL.createObjectURL(template.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = template.fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setOtherError(getAxiosErrorMessage(err, "템플릿 다운로드에 실패했습니다."));
    } finally {
      setOtherDownloading(false);
    }
  }

  // ── Other categories: file assignment ──
  function assignOtherFile(file: File | null) {
    if (!file) return;
    if (!hasAllowedExtension(file.name)) {
      setOtherError("허용된 확장자는 .xlsx, .xls 입니다.");
      return;
    }
    if (file.size > MAX_OTHER_FILE_SIZE) {
      setOtherError("최대 파일 크기는 10MB입니다.");
      return;
    }
    setOtherFile(file);
    setOtherError(null);
    setOtherResult(null);
  }

  // ── Other categories: upload ──
  async function handleOtherUpload() {
    if (!otherFile) {
      setOtherError("업로드할 파일을 선택해주세요.");
      return;
    }
    setOtherUploading(true);
    setOtherError(null);
    setOtherResult(null);
    try {
      const result = await uploadBulkUploadFile(otherCategory, otherFile);
      setOtherResult(result);
    } catch (err) {
      setOtherError(getAxiosErrorMessage(err, "일괄 업로드 처리 중 오류가 발생했습니다."));
    } finally {
      setOtherUploading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">엑셀 일괄 업로드</h2>
      </header>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("external-education")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "external-education"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          사외교육 일괄 업로드
        </button>
        <button
          onClick={() => setActiveTab("others")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "others"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          기타 일괄 업로드
        </button>
      </div>

      {/* ── Tab: 사외교육 일괄 업로드 ── */}
      {activeTab === "external-education" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            사외교육 실적을 엑셀 템플릿으로 일괄 등록합니다. 이름·본부·팀으로 직원을 조회하여 저장합니다.
          </p>

          {/* Step 1: Template download */}
          <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-base font-semibold">1. 템플릿 다운로드</h3>
            <p className="text-sm text-slate-600">
              아래 버튼을 클릭하여 엑셀 템플릿을 다운로드한 후 데이터를 입력하세요. 2행에 예시 데이터가 포함되어 있습니다.
            </p>
            <button
              onClick={handleExtTemplateDownload}
              className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              사외교육_일괄업로드_템플릿.xlsx 다운로드
            </button>
          </article>

          {/* Step 2: File upload */}
          <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-base font-semibold">2. 파일 업로드</h3>

            <input
              ref={extFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                void assignExtFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />

            {!extRows && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => extFileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    extFileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setExtDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setExtDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setExtDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExtDragActive(false);
                  void assignExtFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                  extDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-slate-400"
                }`}
              >
                {extParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <p className="text-sm text-slate-600">파일 분석 중...</p>
                  </div>
                ) : (
                  <>
                    <svg className="mx-auto w-10 h-10 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-base font-medium text-slate-800">엑셀 파일을 드래그하거나 클릭하여 선택</p>
                    <p className="mt-1 text-sm text-slate-500">(.xlsx, .xls / 최대 5MB)</p>
                  </>
                )}
              </div>
            )}

            {extFile && !extRows && !extParsing && (
              <p className="text-sm text-slate-700">선택 파일: {extFile.name}</p>
            )}

            {extFile && extRows && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700">선택 파일: <strong>{extFile.name}</strong></span>
                <button
                  onClick={handleExtReset}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  초기화
                </button>
              </div>
            )}
          </article>

          {/* Step 3: Preview table */}
          {extRows && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold">3. 데이터 미리보기</h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600">전체 <strong>{extRows.length}</strong>건</span>
                  <span className="text-emerald-700">정상 <strong>{extValidCount}</strong>건</span>
                  {extErrorCount > 0 && (
                    <span className="text-rose-700">오류 <strong>{extErrorCount}</strong>건</span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="py-2 px-3 w-16">상태</th>
                      {PREVIEW_COLS.map((col) => (
                        <th key={col.key} className={`py-2 px-3 ${col.width}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extPagedRows.map((row) => {
                      const tooltipText = [
                        ...row._errors.map((e) => `❌ ${e}`),
                        ...row._warnings.map((w) => `⚠️ ${w}`),
                      ].join("\n");

                      return (
                        <tr
                          key={row._rowIndex}
                          title={tooltipText || undefined}
                          className={`border-b border-slate-100 last:border-b-0 ${
                            !row._isValid
                              ? "bg-rose-50"
                              : row._hasWarning
                              ? "bg-amber-50"
                              : ""
                          }`}
                        >
                          <td className="py-2 px-3">
                            {!row._isValid ? (
                              <span
                                className="cursor-help text-rose-600 font-medium"
                                title={row._errors.join("\n")}
                              >
                                ❌ 오류
                              </span>
                            ) : row._hasWarning ? (
                              <span
                                className="cursor-help text-amber-600 font-medium"
                                title={row._warnings.join("\n")}
                              >
                                ⚠️ 경고
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">✅ 정상</span>
                            )}
                          </td>
                          {PREVIEW_COLS.map((col) => (
                            <td key={col.key} className="py-2 px-3 max-w-[200px] truncate">
                              {String(row[col.key] ?? "")}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {extTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setExtPage((p) => Math.max(1, p - 1))}
                    disabled={extPage === 1}
                    className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-slate-600">
                    {extPage} / {extTotalPages}
                  </span>
                  <button
                    onClick={() => setExtPage((p) => Math.min(extTotalPages, p + 1))}
                    disabled={extPage === extTotalPages}
                    className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
                  >
                    다음
                  </button>
                </div>
              )}

              {/* Upload button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => void handleExtUpload()}
                  disabled={extUploading || extValidCount === 0}
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {extUploading
                    ? "업로드 중..."
                    : extErrorCount > 0
                    ? `오류 제외 ${extValidCount}건 업로드`
                    : `${extValidCount}건 업로드`}
                </button>
              </div>
            </article>
          )}

          {/* Error / Success messages */}
          {extError && (
            <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">{extError}</p>
            </article>
          )}

          {extSuccess && (
            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">{extSuccess}</p>
            </article>
          )}

          {/* Guide */}
          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">안내사항</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              <li>이름·본부·팀이 시스템에 등록된 직원과 정확히 일치해야 합니다.</li>
              <li>날짜는 YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 형식을 지원합니다.</li>
              <li>교육비 빈값은 0으로, 이수증 빈값은 N으로 처리됩니다.</li>
              <li>오류 행은 업로드 시 자동으로 제외됩니다.</li>
              <li>1행은 헤더, 2행부터 데이터입니다. (템플릿 2행 예시 삭제 후 입력)</li>
            </ul>
          </article>
        </div>
      )}

      {/* ── Tab: 기타 일괄 업로드 ── */}
      {activeTab === "others" && (
        <div className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <section className="space-y-3">
              <h3 className="text-base font-semibold">1. 카테고리 선택</h3>
              <div className="flex flex-wrap gap-2">
                {OTHER_CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setOtherCategory(option.value);
                      setOtherResult(null);
                      setOtherError(null);
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm ${
                      otherCategory === option.value
                        ? "border-blue-600 text-blue-700 bg-blue-50"
                        : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold">2. 템플릿 다운로드</h3>
              <p className="text-sm text-slate-600">아래 버튼을 클릭하여 엑셀 템플릿을 다운로드한 후, 데이터를 입력하세요.</p>
              <button
                onClick={() => void handleOtherDownload()}
                disabled={otherDownloading}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {otherDownloading
                  ? "템플릿 다운로드 중..."
                  : `📥 ${OTHER_CATEGORY_OPTIONS.find((o) => o.value === otherCategory)?.label ?? ""} 템플릿 다운로드`}
              </button>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold">3. 파일 업로드</h3>
              <input
                ref={otherFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  assignOtherFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => otherFileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    otherFileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOtherDragActive(false);
                  assignOtherFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center ${
                  otherDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
                }`}
              >
                <p className="text-base font-medium text-slate-800">☁️ 엑셀 파일을 선택하세요</p>
                <p className="mt-1 text-sm text-slate-500">(.xlsx, .xls)</p>
              </div>

              {otherFile && <p className="text-sm text-slate-700">선택 파일: {otherFile.name}</p>}

              <button
                onClick={() => void handleOtherUpload()}
                disabled={otherUploading}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {otherUploading ? "일괄 등록 중..." : "일괄 등록"}
              </button>
            </section>
          </article>

          {otherError && (
            <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">{otherError}</p>
            </article>
          )}

          {otherResult && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-base font-semibold">업로드 결과</h3>
              <p className="text-sm text-slate-700">
                성공 <strong>{otherResult.createdCount}</strong>건 / 실패{" "}
                <strong>{otherResult.failedCount}</strong>건
              </p>
              {otherResult.failedRows.length > 0 && (
                <div className="max-h-64 overflow-auto rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left">
                        <th className="py-2 px-3">행 번호</th>
                        <th className="py-2 px-3">사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherResult.failedRows.map((row) => (
                        <tr
                          key={`${row.row}:${row.reason}`}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className="py-2 px-3">{row.row}</td>
                          <td className="py-2 px-3 text-rose-700">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}

          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">안내사항</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              <li>사번은 시스템에 등록된 사번이어야 합니다.</li>
              <li>날짜는 YYYY-MM-DD 형식입니다.</li>
              <li>첫 행은 헤더, 두 번째 행부터 데이터입니다.</li>
              <li>최대 10MB</li>
            </ul>
          </article>
        </div>
      )}
    </section>
  );
}

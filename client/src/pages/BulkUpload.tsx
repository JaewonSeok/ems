import { useRef, useState } from "react";
import { bulkUploadExternalEducations } from "../api/educations";
import { downloadBulkUploadTemplate, uploadBulkUploadFile } from "../api/bulkUpload";
import { BulkUploadCategory, BulkUploadResult } from "../types/bulkUpload";
import type { BulkUploadExternalResponse, ExternalEducationRowData } from "../types/externalBulkUpload";
import { downloadExternalEducationTemplate } from "../utils/externalEducationTemplate";
import {
  parseExternalEducationFile,
  revalidateAllRows,
  rowsToRecords,
} from "../utils/externalEducationParser";

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

// ─── Column definitions for the editable preview table ───────────────────────

type DataKey =
  | "no" | "division" | "team" | "name" | "educationType" | "educationName"
  | "startDate" | "endDate" | "days" | "cost" | "organizer" | "certificate";

interface ColDef {
  key: DataKey;
  label: string;
  inputType: "text" | "date" | "number" | "select";
  readOnly?: boolean;
  thWidth: string;
  minEditWidth: string;
  step?: string;
  options?: string[];
}

const COL_DEFS: ColDef[] = [
  { key: "no",            label: "No",     inputType: "number", readOnly: true, thWidth: "w-10",  minEditWidth: "44px" },
  { key: "division",      label: "본부",    inputType: "text",                  thWidth: "w-24",  minEditWidth: "80px" },
  { key: "team",          label: "팀",      inputType: "text",                  thWidth: "w-24",  minEditWidth: "80px" },
  { key: "name",          label: "이름",    inputType: "text",                  thWidth: "w-20",  minEditWidth: "70px" },
  { key: "educationType", label: "교육구분", inputType: "text",                  thWidth: "w-24",  minEditWidth: "80px" },
  { key: "educationName", label: "교육명",  inputType: "text",                  thWidth: "w-44",  minEditWidth: "140px" },
  { key: "startDate",     label: "시작일자", inputType: "date",                  thWidth: "w-32",  minEditWidth: "130px" },
  { key: "endDate",       label: "종료일자", inputType: "date",                  thWidth: "w-32",  minEditWidth: "130px" },
  { key: "days",          label: "교육일수", inputType: "number", step: "0.5",   thWidth: "w-20",  minEditWidth: "70px" },
  { key: "cost",          label: "교육비",  inputType: "number", step: "1",     thWidth: "w-24",  minEditWidth: "80px" },
  { key: "organizer",     label: "교육주관", inputType: "text",                  thWidth: "w-36",  minEditWidth: "100px" },
  { key: "certificate",   label: "이수증",  inputType: "select", options: ["Y", "N"], thWidth: "w-16", minEditWidth: "60px" },
];

// Columns available for Tab key navigation (no is read-only)
const NAVIGABLE_KEYS = COL_DEFS.filter((c) => !c.readOnly).map((c) => c.key);

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

/** Coerce a raw string input value to the correct field type. */
function coerceFieldValue(key: DataKey, raw: string): string | number {
  if (key === "days" || key === "cost" || key === "no") {
    const n = Number(raw.replace(/,/g, ""));
    return isFinite(n) ? n : raw;
  }
  return raw;
}

function getRowValue(row: ExternalEducationRowData, key: DataKey): string {
  const v = row[key as keyof ExternalEducationRowData];
  return v === undefined || v === null ? "" : String(v);
}

function makeEmptyRow(rowIndex: number, no: number): ExternalEducationRowData {
  return {
    _rowIndex: rowIndex,
    _isValid: false,
    _hasWarning: false,
    _errors: [
      "본부 필수", "팀 필수", "이름 필수", "교육구분 필수", "교육명 필수",
      "시작일자 형식 오류 (YYYY-MM-DD)", "종료일자 형식 오류 (YYYY-MM-DD)",
      "교육일수는 양수여야 함", "교육주관 필수",
    ],
    _warnings: [],
    no,
    division: "", team: "", name: "", educationType: "", educationName: "",
    startDate: "", endDate: "", days: "", cost: 0, organizer: "", certificate: "N",
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkUpload() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("external-education");

  // ── External Education state ──
  const extFileInputRef = useRef<HTMLInputElement | null>(null);
  const nextRowIdxRef = useRef(0);

  const [extDragActive, setExtDragActive] = useState(false);
  const [extFile, setExtFile] = useState<File | null>(null);
  const [extParsing, setExtParsing] = useState(false);
  const [extUploading, setExtUploading] = useState(false);
  const [extRows, setExtRows] = useState<ExternalEducationRowData[] | null>(null);
  const [extError, setExtError] = useState<string | null>(null);
  const [extResult, setExtResult] = useState<BulkUploadExternalResponse | null>(null);
  const [extPage, setExtPage] = useState(1);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colKey: DataKey; value: string } | null>(null);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());

  // ── Other categories state ──
  const otherFileInputRef = useRef<HTMLInputElement | null>(null);
  const [otherDragActive, setOtherDragActive] = useState(false);
  const [otherCategory, setOtherCategory] = useState<BulkUploadCategory>("external-training");
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [otherDownloading, setOtherDownloading] = useState(false);
  const [otherUploading, setOtherUploading] = useState(false);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [otherResult, setOtherResult] = useState<BulkUploadResult | null>(null);

  // ── Derived values ──
  const extTotalPages = extRows ? Math.ceil(extRows.length / PAGE_SIZE) : 0;
  const extPagedRows = extRows
    ? extRows.slice((extPage - 1) * PAGE_SIZE, extPage * PAGE_SIZE)
    : [];
  const extValidCount   = extRows?.filter((r) => r._isValid).length ?? 0;
  const extWarnCount    = extRows?.filter((r) => r._hasWarning && r._isValid).length ?? 0;
  const extErrorCount   = extRows?.filter((r) => !r._isValid).length ?? 0;

  // ── External Education: template ──
  function handleExtTemplateDownload() {
    try {
      downloadExternalEducationTemplate();
    } catch {
      setExtError("템플릿 다운로드 중 오류가 발생했습니다.");
    }
  }

  // ── External Education: file load + parse ──
  async function assignExtFile(file: File | null) {
    if (!file) return;
    if (!hasAllowedExtension(file.name)) { setExtError("허용된 확장자는 .xlsx, .xls 입니다."); return; }
    if (file.size > MAX_EXT_FILE_SIZE)   { setExtError("최대 파일 크기는 5MB입니다.");        return; }

    setExtFile(file);
    setExtError(null);
    setExtResult(null);
    setExtRows(null);
    setExtPage(1);
    setEditingCell(null);
    setEditedCells(new Set());
    setExtParsing(true);

    try {
      const rows = await parseExternalEducationFile(file);
      if (rows.length === 0) {
        setExtError("데이터 행이 없습니다. 2행부터 데이터를 입력해주세요.");
        setExtFile(null);
      } else {
        nextRowIdxRef.current = Math.max(...rows.map((r) => r._rowIndex)) + 1;
        setExtRows(rows);
      }
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "파일 파싱 중 오류가 발생했습니다.");
      setExtFile(null);
    } finally {
      setExtParsing(false);
    }
  }

  function handleExtReset() {
    setExtFile(null);
    setExtRows(null);
    setExtError(null);
    setExtResult(null);
    setExtPage(1);
    setEditingCell(null);
    setEditedCells(new Set());
    nextRowIdxRef.current = 0;
  }

  // ── External Education: upload ALL rows ──
  async function handleExtUpload() {
    if (!extRows || extRows.length === 0) return;

    const total = extRows.length;
    const parts: string[] = [];
    if (extErrorCount > 0) parts.push(`오류 ${extErrorCount}건`);
    if (extWarnCount  > 0) parts.push(`경고 ${extWarnCount}건`);
    const confirmMsg = parts.length > 0
      ? `${parts.join(", ")}이 포함되어 있습니다. 전체 ${total}건을 업로드하시겠습니까?`
      : `전체 ${total}건을 업로드하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setExtUploading(true);
    setExtError(null);

    try {
      const records = rowsToRecords(extRows);
      const result = await bulkUploadExternalEducations(records);

      if (result.success) {
        setExtResult(result);
        setExtRows(null);
        setExtFile(null);
        setExtPage(1);
        setEditingCell(null);
        setEditedCells(new Set());
      } else {
        setExtError(result.error ?? "업로드에 실패했습니다.");
      }
    } catch (err) {
      setExtError(getAxiosErrorMessage(err, "업로드 중 오류가 발생했습니다."));
    } finally {
      setExtUploading(false);
    }
  }

  // ── Inline editing ──

  function commitCell(rowIdx: number, colKey: DataKey, rawValue: string) {
    const coerced = coerceFieldValue(colKey, rawValue);
    setExtRows((prev) => {
      if (!prev) return prev;
      const updated = prev.map((row) =>
        row._rowIndex !== rowIdx ? row : { ...row, [colKey]: coerced }
      );
      return revalidateAllRows(updated);
    });
    setEditedCells((prev) => new Set(prev).add(`${rowIdx}::${colKey}`));
  }

  function handleCellClick(rowIdx: number, colKey: DataKey, currentValue: string) {
    if (editingCell?.rowIdx === rowIdx && editingCell.colKey === colKey) return;
    // Commit any active cell first (blur will also fire, but handle explicitly for reliability)
    if (editingCell && !(editingCell.rowIdx === rowIdx && editingCell.colKey === colKey)) {
      commitCell(editingCell.rowIdx, editingCell.colKey, editingCell.value);
    }
    setEditingCell({ rowIdx, colKey, value: currentValue });
  }

  function handleCellBlur(rowIdx: number, colKey: DataKey) {
    if (!editingCell || editingCell.rowIdx !== rowIdx || editingCell.colKey !== colKey) return;
    commitCell(rowIdx, colKey, editingCell.value);
    setEditingCell(null);
  }

  function getNextNavigableCell(rowIdx: number, colKey: DataKey): { rowIdx: number; colKey: DataKey } | null {
    const colPos = NAVIGABLE_KEYS.indexOf(colKey);
    const rowPos = extPagedRows.findIndex((r) => r._rowIndex === rowIdx);
    if (colPos < NAVIGABLE_KEYS.length - 1) {
      return { rowIdx, colKey: NAVIGABLE_KEYS[colPos + 1] };
    }
    if (rowPos < extPagedRows.length - 1) {
      return { rowIdx: extPagedRows[rowPos + 1]._rowIndex, colKey: NAVIGABLE_KEYS[0] };
    }
    return null;
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIdx: number,
    colKey: DataKey
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCell(rowIdx, colKey, editingCell!.value);
      setEditingCell(null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const currentValue = editingCell!.value;
      const next = getNextNavigableCell(rowIdx, colKey);
      // Capture next cell's value before committing (avoids stale closure)
      const nextRow = next ? extRows?.find((r) => r._rowIndex === next.rowIdx) : null;
      const nextValue = next && nextRow ? getRowValue(nextRow, next.colKey) : "";
      commitCell(rowIdx, colKey, currentValue);
      setEditingCell(next ? { rowIdx: next.rowIdx, colKey: next.colKey, value: nextValue } : null);
    }
  }

  // ── Row delete ──
  function handleDeleteRow(rowIdx: number) {
    if (editingCell?.rowIdx === rowIdx) setEditingCell(null);
    setExtRows((prev) => {
      if (!prev) return prev;
      const filtered = prev
        .filter((r) => r._rowIndex !== rowIdx)
        .map((r, i) => ({ ...r, no: i + 1 }));
      return revalidateAllRows(filtered);
    });
    setEditedCells((prev) => {
      const next = new Set(prev);
      for (const k of next) {
        if (k.startsWith(`${rowIdx}::`)) next.delete(k);
      }
      return next;
    });
    // Adjust page if last row on current page was deleted
    setExtPage((p) => {
      const remaining = (extRows?.length ?? 1) - 1;
      const maxPage = Math.max(1, Math.ceil(remaining / PAGE_SIZE));
      return Math.min(p, maxPage);
    });
  }

  // ── Row add ──
  function handleAddRow() {
    const newRowIdx = nextRowIdxRef.current++;
    const newNo = (extRows?.length ?? 0) + 1;
    const newRow = makeEmptyRow(newRowIdx, newNo);
    setExtRows((prev) => {
      const updated = [...(prev ?? []), newRow];
      return revalidateAllRows(updated.map((r, i) => ({ ...r, no: i + 1 })));
    });
    // Jump to last page
    const newTotal = (extRows?.length ?? 0) + 1;
    setExtPage(Math.ceil(newTotal / PAGE_SIZE));
  }

  // ── Pagination with edit commit ──
  function changePage(newPage: number) {
    if (editingCell) {
      commitCell(editingCell.rowIdx, editingCell.colKey, editingCell.value);
      setEditingCell(null);
    }
    setExtPage(newPage);
  }

  // ── Other categories ──
  async function handleOtherDownload() {
    setOtherDownloading(true); setOtherError(null);
    try {
      const template = await downloadBulkUploadTemplate(otherCategory);
      const url = URL.createObjectURL(template.blob);
      const a = document.createElement("a");
      a.href = url; a.download = template.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setOtherError(getAxiosErrorMessage(err, "템플릿 다운로드에 실패했습니다."));
    } finally {
      setOtherDownloading(false);
    }
  }

  function assignOtherFile(file: File | null) {
    if (!file) return;
    if (!hasAllowedExtension(file.name)) { setOtherError("허용된 확장자는 .xlsx, .xls 입니다."); return; }
    if (file.size > MAX_OTHER_FILE_SIZE)  { setOtherError("최대 파일 크기는 10MB입니다.");        return; }
    setOtherFile(file); setOtherError(null); setOtherResult(null);
  }

  async function handleOtherUpload() {
    if (!otherFile) { setOtherError("업로드할 파일을 선택해주세요."); return; }
    setOtherUploading(true); setOtherError(null); setOtherResult(null);
    try {
      setOtherResult(await uploadBulkUploadFile(otherCategory, otherFile));
    } catch (err) {
      setOtherError(getAxiosErrorMessage(err, "일괄 업로드 처리 중 오류가 발생했습니다."));
    } finally {
      setOtherUploading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">엑셀 일괄 업로드</h2>
      </header>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["external-education", "others"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "external-education" ? "사외교육 일괄 업로드" : "기타 일괄 업로드"}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab: 사외교육 일괄 업로드                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "external-education" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            사외교육 실적을 엑셀 템플릿으로 일괄 등록합니다. 이름·본부·팀으로 직원을 조회하여 저장합니다.
          </p>

          {/* Step 1: Template */}
          <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-base font-semibold">1. 템플릿 다운로드</h3>
            <p className="text-sm text-slate-600">
              아래 버튼을 클릭하여 엑셀 템플릿을 다운로드한 후 데이터를 입력하세요. 2행에 예시 데이터가 포함되어 있습니다.
            </p>
            <button
              onClick={handleExtTemplateDownload}
              className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
              onChange={(e) => { void assignExtFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
            />

            {!extRows && (
              <div
                role="button" tabIndex={0}
                onClick={() => extFileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); extFileInputRef.current?.click(); } }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setExtDragActive(true); }}
                onDragOver={(e)  => { e.preventDefault(); e.stopPropagation(); setExtDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setExtDragActive(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setExtDragActive(false); void assignExtFile(e.dataTransfer.files?.[0] ?? null); }}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-base font-medium text-slate-800">엑셀 파일을 드래그하거나 클릭하여 선택</p>
                    <p className="mt-1 text-sm text-slate-500">(.xlsx, .xls / 최대 5MB)</p>
                  </>
                )}
              </div>
            )}

            {extFile && extRows && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700">선택 파일: <strong>{extFile.name}</strong></span>
                <button onClick={handleExtReset} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  초기화
                </button>
              </div>
            )}
          </article>

          {/* Step 3: Preview table */}
          {extRows && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              {/* Summary bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold">3. 데이터 미리보기</h3>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-slate-600">전체 <strong>{extRows.length}</strong>건</span>
                  <span className="text-emerald-700">정상 <strong>{extValidCount}</strong>건</span>
                  {extWarnCount  > 0 && <span className="text-amber-600">경고 <strong>{extWarnCount}</strong>건</span>}
                  {extErrorCount > 0 && <span className="text-rose-700">오류 <strong>{extErrorCount}</strong>건</span>}
                  <span className="text-xs text-slate-400 ml-1">셀 클릭 시 편집 가능</span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="py-2 px-3 w-16 text-center">상태</th>
                      {COL_DEFS.map((col) => (
                        <th key={col.key} className={`py-2 px-3 ${col.thWidth}`}>
                          {col.label}
                        </th>
                      ))}
                      <th className="py-2 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extPagedRows.map((row) => {
                      const rowBg = !row._isValid
                        ? "bg-rose-50"
                        : row._hasWarning
                        ? "bg-amber-50"
                        : "";
                      const statusTip = [
                        ...row._errors.map((e) => `❌ ${e}`),
                        ...row._warnings.map((w) => `⚠️ ${w}`),
                      ].join("\n");

                      return (
                        <tr key={row._rowIndex} className={`border-b border-slate-100 last:border-b-0 ${rowBg}`}>
                          {/* Status cell */}
                          <td className="py-2 px-3 text-center">
                            {!row._isValid ? (
                              <span className="cursor-help text-rose-600 font-medium" title={statusTip}>
                                ❌
                              </span>
                            ) : row._hasWarning ? (
                              <span className="cursor-help text-amber-500 font-medium" title={statusTip}>
                                ⚠️
                              </span>
                            ) : (
                              <span className="text-emerald-600">✅</span>
                            )}
                          </td>

                          {/* Data cells */}
                          {COL_DEFS.map((col) => {
                            const isEditing =
                              editingCell?.rowIdx === row._rowIndex &&
                              editingCell.colKey === col.key;
                            const isEdited = editedCells.has(`${row._rowIndex}::${col.key}`);
                            const displayVal = getRowValue(row, col.key);

                            if (col.readOnly) {
                              return (
                                <td key={col.key} className="py-2 px-3 text-slate-500 select-none">
                                  {displayVal}
                                </td>
                              );
                            }

                            if (isEditing) {
                              const commonCls =
                                "w-full border border-blue-500 rounded px-1 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";
                              if (col.inputType === "select") {
                                return (
                                  <td key={col.key} className="py-1 px-1">
                                    <select
                                      autoFocus
                                      value={editingCell.value}
                                      style={{ minWidth: col.minEditWidth }}
                                      className={commonCls}
                                      onChange={(e) =>
                                        setEditingCell({ ...editingCell, value: e.target.value })
                                      }
                                      onBlur={() => handleCellBlur(row._rowIndex, col.key)}
                                      onKeyDown={(e) => handleCellKeyDown(e, row._rowIndex, col.key)}
                                    >
                                      {(col.options ?? []).map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              }
                              return (
                                <td key={col.key} className="py-1 px-1">
                                  <input
                                    autoFocus
                                    type={col.inputType}
                                    step={col.step}
                                    value={editingCell.value}
                                    style={{ minWidth: col.minEditWidth }}
                                    className={commonCls}
                                    onChange={(e) =>
                                      setEditingCell({ ...editingCell, value: e.target.value })
                                    }
                                    onBlur={() => handleCellBlur(row._rowIndex, col.key)}
                                    onKeyDown={(e) => handleCellKeyDown(e, row._rowIndex, col.key)}
                                  />
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col.key}
                                onClick={() => handleCellClick(row._rowIndex, col.key, displayVal)}
                                className={`relative py-2 px-3 max-w-[200px] truncate cursor-text select-none
                                  hover:bg-blue-50/60 transition-colors
                                  ${isEdited ? "bg-blue-50" : ""}`}
                                title={displayVal || undefined}
                              >
                                {/* Edited marker: small blue triangle in top-left corner */}
                                {isEdited && (
                                  <span
                                    className="absolute top-0 left-0 w-0 h-0 pointer-events-none"
                                    style={{
                                      borderStyle: "solid",
                                      borderWidth: "5px 5px 0 0",
                                      borderColor: "#60a5fa transparent transparent transparent",
                                    }}
                                  />
                                )}
                                {displayVal !== ""
                                  ? displayVal
                                  : <span className="text-slate-300 text-xs">—</span>
                                }
                              </td>
                            );
                          })}

                          {/* Delete button */}
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(row._rowIndex)}
                              className="text-slate-400 hover:text-rose-500 transition-colors"
                              title="행 삭제"
                              aria-label="행 삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add row + Pagination */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  행 추가
                </button>

                {extTotalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changePage(Math.max(1, extPage - 1))}
                      disabled={extPage === 1}
                      className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
                    >
                      이전
                    </button>
                    <span className="text-sm text-slate-600">{extPage} / {extTotalPages}</span>
                    <button
                      onClick={() => changePage(Math.min(extTotalPages, extPage + 1))}
                      disabled={extPage === extTotalPages}
                      className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>

              {/* Upload button */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-4">
                <button
                  onClick={() => void handleExtUpload()}
                  disabled={extUploading || extRows.length === 0}
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {extUploading ? "업로드 중..." : `전체 ${extRows.length}건 업로드`}
                </button>
                {(extErrorCount > 0 || extWarnCount > 0) && (
                  <span className="text-xs text-slate-500">
                    오류/경고 행도 포함하여 업로드합니다.
                  </span>
                )}
              </div>
            </article>
          )}

          {extError && (
            <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">{extError}</p>
            </article>
          )}

          {extResult && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-base font-semibold">업로드 결과</h3>
              <p className="text-sm text-slate-700">
                성공{" "}
                <strong className="text-emerald-700">{extResult.insertedCount ?? 0}</strong>건 / 실패{" "}
                <strong className={(extResult.failedCount ?? 0) > 0 ? "text-rose-700" : "text-slate-700"}>
                  {extResult.failedCount ?? 0}
                </strong>건
              </p>
              {(extResult.failedRows?.length ?? 0) > 0 && (
                <div className="max-h-64 overflow-auto rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left">
                        <th className="py-2 px-3 w-12">No</th>
                        <th className="py-2 px-3 w-24">이름</th>
                        <th className="py-2 px-3">사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extResult.failedRows!.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-2 px-3">{row.no}</td>
                          <td className="py-2 px-3">{row.name}</td>
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
              <li>이름·본부·팀이 시스템에 등록된 직원과 정확히 일치해야 합니다.</li>
              <li>날짜는 YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 형식을 지원합니다.</li>
              <li>교육비 빈값은 0으로, 이수증 빈값은 N으로 처리됩니다.</li>
              <li>오류·경고 행도 포함하여 전체 업로드됩니다. 업로드 전 셀 클릭으로 직접 수정하세요.</li>
              <li>1행은 헤더, 2행부터 데이터입니다. (템플릿 2행 예시 삭제 후 입력)</li>
            </ul>
          </article>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab: 기타 일괄 업로드                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "others" && (
        <div className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <section className="space-y-3">
              <h3 className="text-base font-semibold">1. 카테고리 선택</h3>
              <div className="flex flex-wrap gap-2">
                {OTHER_CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setOtherCategory(option.value); setOtherResult(null); setOtherError(null); }}
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
                type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { assignOtherFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
              <div
                role="button" tabIndex={0}
                onClick={() => otherFileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); otherFileInputRef.current?.click(); } }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(true); }}
                onDragOver={(e)  => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOtherDragActive(false); assignOtherFile(e.dataTransfer.files?.[0] ?? null); }}
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
                성공 <strong>{otherResult.createdCount}</strong>건 / 실패 <strong>{otherResult.failedCount}</strong>건
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
                        <tr key={`${row.row}:${row.reason}`} className="border-b border-slate-100 last:border-b-0">
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

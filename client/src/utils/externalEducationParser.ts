import * as XLSX from "xlsx";
import type { ExternalEducationRecord, ExternalEducationRowData } from "../types/externalBulkUpload";

const EXPECTED_HEADERS = [
  "No", "본부", "팀", "이름", "교육구분", "교육명",
  "시작일자", "종료일자", "교육일수", "교육비", "교육주관", "이수증",
];

function normalizeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function isBlank(value: unknown): boolean {
  return normalizeStr(value) === "";
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const parsed = (XLSX.SSF as { parse_date_code: (n: number) => { y: number; m: number; d: number } | null }).parse_date_code(value);
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const str = normalizeStr(value);
  const match = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!match) return null;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

function parseCost(value: unknown): number {
  if (isBlank(value)) return 0;
  const num = Number(normalizeStr(value).replace(/,/g, ""));
  return isFinite(num) ? num : NaN;
}

function validateRow(
  row: Array<unknown>,
  rowIndex: number,
  seenKeys: Set<string>
): ExternalEducationRowData {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawDivision = normalizeStr(row[1]);
  const rawTeam = normalizeStr(row[2]);
  const rawName = normalizeStr(row[3]);
  const rawEducationType = normalizeStr(row[4]);
  const rawEducationName = normalizeStr(row[5]);
  const rawStartDate = row[6];
  const rawEndDate = row[7];
  const rawDays = row[8];
  const rawCost = row[9];
  const rawOrganizer = normalizeStr(row[10]);
  const rawCertificateInput = normalizeStr(row[11]).toUpperCase();

  if (!rawDivision) errors.push("본부 필수");
  if (!rawTeam) errors.push("팀 필수");
  if (!rawName) errors.push("이름 필수");
  if (!rawEducationType) errors.push("교육구분 필수");
  if (!rawEducationName) errors.push("교육명 필수");
  if (!rawOrganizer) errors.push("교육주관 필수");

  const startDateStr = parseDate(rawStartDate);
  const endDateStr = parseDate(rawEndDate);

  if (!startDateStr || !isValidDateStr(startDateStr)) {
    errors.push("시작일자 형식 오류 (YYYY-MM-DD)");
  }
  if (!endDateStr || !isValidDateStr(endDateStr)) {
    errors.push("종료일자 형식 오류 (YYYY-MM-DD)");
  }

  if (startDateStr && endDateStr && isValidDateStr(startDateStr) && isValidDateStr(endDateStr)) {
    if (endDateStr < startDateStr) {
      errors.push("종료일자는 시작일자 이후여야 함");
    }
  }

  const daysNum = isBlank(rawDays) ? NaN : Number(normalizeStr(rawDays));
  if (!Number.isFinite(daysNum) || daysNum <= 0) {
    errors.push("교육일수는 양수여야 함");
  }

  if (
    startDateStr && endDateStr &&
    isValidDateStr(startDateStr) && isValidDateStr(endDateStr) &&
    Number.isFinite(daysNum) && daysNum > 0
  ) {
    const diffDays =
      Math.round((new Date(endDateStr).getTime() - new Date(startDateStr).getTime()) / 86400000) + 1;
    if (diffDays !== daysNum) {
      warnings.push(`교육일수(${daysNum}일)와 날짜 범위(${diffDays}일)가 다름`);
    }
  }

  const costNum = parseCost(rawCost);
  if (isNaN(costNum)) {
    errors.push("교육비는 숫자여야 함");
  } else if (costNum < 0) {
    errors.push("교육비는 0 이상이어야 함");
  }

  const certRaw = rawCertificateInput || "N";
  if (certRaw !== "Y" && certRaw !== "N") {
    errors.push("이수증은 Y 또는 N이어야 함");
  }

  const dedupKey = `${rawName}::${rawEducationName}::${startDateStr ?? ""}`;
  if (rawName && rawEducationName && startDateStr) {
    if (seenKeys.has(dedupKey)) {
      warnings.push("중복 행 (이름+교육명+시작일자 동일)");
    } else {
      seenKeys.add(dedupKey);
    }
  }

  return {
    _rowIndex: rowIndex,
    _isValid: errors.length === 0,
    _hasWarning: warnings.length > 0,
    _errors: errors,
    _warnings: warnings,
    no: typeof row[0] === "number" ? row[0] : normalizeStr(row[0]),
    division: rawDivision,
    team: rawTeam,
    name: rawName,
    educationType: rawEducationType,
    educationName: rawEducationName,
    startDate: startDateStr ?? normalizeStr(rawStartDate),
    endDate: endDateStr ?? normalizeStr(rawEndDate),
    days: Number.isFinite(daysNum) ? daysNum : normalizeStr(rawDays),
    cost: !isNaN(costNum) ? costNum : normalizeStr(rawCost),
    organizer: rawOrganizer,
    certificate: certRaw === "Y" ? "Y" : "N",
  };
}

export function parseExternalEducationFile(file: File): Promise<ExternalEducationRowData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = sheetName ? wb.Sheets[sheetName] : undefined;

        if (!ws) {
          reject(new Error("엑셀 시트가 비어 있습니다."));
          return;
        }

        const matrix = XLSX.utils.sheet_to_json<Array<unknown>>(ws, {
          header: 1,
          defval: "",
          raw: true,
        });

        if (matrix.length === 0) {
          reject(new Error("엑셀 데이터가 없습니다."));
          return;
        }

        const headerRow = (matrix[0] || []).map((h) => normalizeStr(h));
        const missingHeaders = EXPECTED_HEADERS.filter((h) => !headerRow.includes(h));
        if (missingHeaders.length > 0) {
          reject(new Error(`헤더가 올바르지 않습니다. 누락된 열: ${missingHeaders.join(", ")}`));
          return;
        }

        const seenKeys = new Set<string>();
        const result: ExternalEducationRowData[] = [];

        for (let i = 1; i < matrix.length; i++) {
          const row = matrix[i] || [];
          if (row.every((cell) => isBlank(cell))) continue;
          result.push(validateRow(row, i + 1, seenKeys));
        }

        resolve(result);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("파일 파싱 중 오류가 발생했습니다."));
      }
    };

    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsArrayBuffer(file);
  });
}

export function rowsToRecords(rows: ExternalEducationRowData[]): ExternalEducationRecord[] {
  return rows
    .filter((r) => r._isValid)
    .map((r) => ({
      no: typeof r.no === "number" ? r.no : 0,
      division: r.division,
      team: r.team,
      name: r.name,
      educationType: r.educationType,
      educationName: r.educationName,
      startDate: r.startDate,
      endDate: r.endDate,
      days: typeof r.days === "number" ? r.days : 0,
      cost: typeof r.cost === "number" ? r.cost : 0,
      organizer: r.organizer,
      certificate: r.certificate,
    }));
}

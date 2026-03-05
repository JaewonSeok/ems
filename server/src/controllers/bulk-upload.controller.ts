import { Prisma, training_type_enum } from "@prisma/client";
import { Response } from "express";
import XLSX from "xlsx";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

const BULK_CATEGORIES = ["external-training", "internal-training", "internal-lecture", "certification"] as const;

type BulkUploadCategory = (typeof BULK_CATEGORIES)[number];

type RowError = {
  row: number;
  reason: string;
};

type BulkUploadResult = {
  category: BulkUploadCategory;
  createdCount: number;
  failedCount: number;
  totalRows: number;
  failedRows: RowError[];
};

class RowValidationError extends Error {}

const CATEGORY_CONFIG: Record<
  BulkUploadCategory,
  {
    headers: string[];
    fileName: string;
    sheetName: string;
    sampleRow: Array<string | number>;
  }
> = {
  "external-training": {
    headers: ["사번", "교육명", "구분(오프라인/온라인)", "시작일", "종료일", "교육시간", "비용", "주관기관", "학점"],
    fileName: "external-training-template.xlsx",
    sheetName: "ExternalTraining",
    sampleRow: ["EMP001", "AI 교육", "오프라인", "2026-01-05", "2026-01-10", 40, 500000, "한국교육원", 5]
  },
  "internal-training": {
    headers: ["사번", "교육명", "구분", "시작일", "종료일", "교육시간", "주관기관", "학점"],
    fileName: "internal-training-template.xlsx",
    sheetName: "InternalTraining",
    sampleRow: ["EMP001", "신입 온보딩", "온라인", "2026-02-01", "2026-02-03", 12, "사내교육센터", 2]
  },
  "internal-lecture": {
    headers: ["사번", "강의명", "구분", "시작일", "종료일", "강의시간", "주관부서(강사명)", "학점"],
    fileName: "internal-lecture-template.xlsx",
    sheetName: "InternalLecture",
    sampleRow: ["EMP001", "보안 인식 교육", "오프라인", "2026-03-01", "2026-03-01", 2, "인사팀(김강사)", 1]
  },
  certification: {
    headers: ["사번", "자격증명", "등급", "취득일", "인정학점"],
    fileName: "certification-template.xlsx",
    sheetName: "Certification",
    sampleRow: ["EMP001", "정보처리기사", "1급", "2026-04-20", 4]
  }
};

function isBulkUploadCategory(value: string): value is BulkUploadCategory {
  return (BULK_CATEGORIES as readonly string[]).includes(value);
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function isBlankCell(value: unknown) {
  return normalizeCell(value) === "";
}

function parseRequiredString(value: unknown, fieldName: string, maxLength: number) {
  const parsed = normalizeCell(value);

  if (!parsed) {
    throw new RowValidationError(`${fieldName}은(는) 필수입니다.`);
  }

  if (parsed.length > maxLength) {
    throw new RowValidationError(`${fieldName}은(는) ${maxLength}자 이하여야 합니다.`);
  }

  return parsed;
}

function parseTrainingType(value: unknown, fieldName: string) {
  const parsed = normalizeCell(value).toUpperCase();

  if (parsed === "OFFLINE" || parsed === "오프라인") {
    return training_type_enum.OFFLINE;
  }

  if (parsed === "ONLINE" || parsed === "온라인") {
    return training_type_enum.ONLINE;
  }

  throw new RowValidationError(`${fieldName}은(는) OFFLINE/ONLINE 또는 오프라인/온라인이어야 합니다.`);
}

function toUtcDate(dateText: string) {
  const parsed = new Date(`${dateText}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateText) {
    throw new RowValidationError(`날짜 형식이 올바르지 않습니다. (${dateText})`);
  }

  return parsed;
}

function parseDateValue(value: unknown, fieldName: string) {
  if (value instanceof Date) {
    const dateText = value.toISOString().slice(0, 10);
    return toUtcDate(dateText);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
      throw new RowValidationError(`${fieldName} 날짜를 해석할 수 없습니다.`);
    }

    const dateText = `${parsed.y.toString().padStart(4, "0")}-${parsed.m.toString().padStart(2, "0")}-${parsed.d
      .toString()
      .padStart(2, "0")}`;

    return toUtcDate(dateText);
  }

  const text = normalizeCell(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new RowValidationError(`${fieldName}은(는) YYYY-MM-DD 형식이어야 합니다.`);
  }

  return toUtcDate(text);
}

function parseOptionalDecimal(
  value: unknown,
  fieldName: string,
  options: {
    min?: number;
    maxScale?: number;
  } = {}
) {
  if (value === null || value === undefined || isBlankCell(value)) {
    return null;
  }

  const normalized = normalizeCell(value).replace(/,/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new RowValidationError(`${fieldName}은(는) 숫자여야 합니다.`);
  }

  const min = options.min ?? 0;
  if (parsed < min) {
    throw new RowValidationError(`${fieldName}은(는) ${min} 이상이어야 합니다.`);
  }

  if (typeof options.maxScale === "number") {
    const scaleFactor = 10 ** options.maxScale;
    if (Math.round(parsed * scaleFactor) !== parsed * scaleFactor) {
      throw new RowValidationError(`${fieldName}은(는) 소수점 ${options.maxScale}자리 이하여야 합니다.`);
    }
  }

  return parsed;
}

function parseRequiredDecimal(
  value: unknown,
  fieldName: string,
  options: {
    min?: number;
    maxScale?: number;
  } = {}
) {
  const parsed = parseOptionalDecimal(value, fieldName, options);

  if (parsed === null) {
    throw new RowValidationError(`${fieldName}은(는) 필수입니다.`);
  }

  return parsed;
}

function parseOptionalInteger(value: unknown, fieldName: string, min = 0) {
  const parsed = parseOptionalDecimal(value, fieldName, { min, maxScale: 0 });

  if (parsed === null) {
    return null;
  }

  return Math.trunc(parsed);
}

function getSheetMatrix(fileBuffer: Buffer) {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!sheet) {
    throw new RowValidationError("엑셀 시트가 비어 있습니다.");
  }

  return XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    defval: "",
    raw: true
  });
}

function assertHeaders(headers: string[], requiredHeaders: string[]) {
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new RowValidationError(`필수 헤더가 없습니다: ${header}`);
    }
  }
}

function buildUserMap(users: Array<{ id: string; employee_id: string }>) {
  const map = new Map<string, string>();

  for (const user of users) {
    map.set(user.employee_id, user.id);
  }

  return map;
}

function parseExternalTrainingRow(
  row: Array<unknown>,
  headerIndex: Record<string, number>,
  userId: string
): Prisma.external_trainingsCreateInput {
  const training_name = parseRequiredString(row[headerIndex["교육명"]], "교육명", 255);
  const type = parseTrainingType(row[headerIndex["구분(오프라인/온라인)"]], "구분(오프라인/온라인)");
  const start_date = parseDateValue(row[headerIndex["시작일"]], "시작일");
  const end_date = parseDateValue(row[headerIndex["종료일"]], "종료일");

  if (end_date < start_date) {
    throw new RowValidationError("종료일은 시작일보다 빠를 수 없습니다.");
  }

  const hours = parseRequiredDecimal(row[headerIndex["교육시간"]], "교육시간", { min: 0, maxScale: 1 });
  const cost = parseOptionalInteger(row[headerIndex["비용"]], "비용", 0);
  const institution = parseRequiredString(row[headerIndex["주관기관"]], "주관기관", 255);
  const credits = parseOptionalDecimal(row[headerIndex["학점"]], "학점", { min: 0, maxScale: 1 });

  return {
    user: { connect: { id: userId } },
    training_name,
    type,
    start_date,
    end_date,
    hours: new Prisma.Decimal(hours),
    cost,
    institution,
    credits: credits === null ? null : new Prisma.Decimal(credits)
  };
}

function parseInternalTrainingRow(
  row: Array<unknown>,
  headerIndex: Record<string, number>,
  userId: string
): Prisma.internal_trainingsCreateInput {
  const training_name = parseRequiredString(row[headerIndex["교육명"]], "교육명", 255);
  const type = parseTrainingType(row[headerIndex["구분"]], "구분");
  const start_date = parseDateValue(row[headerIndex["시작일"]], "시작일");
  const end_date = parseDateValue(row[headerIndex["종료일"]], "종료일");

  if (end_date < start_date) {
    throw new RowValidationError("종료일은 시작일보다 빠를 수 없습니다.");
  }

  const hours = parseRequiredDecimal(row[headerIndex["교육시간"]], "교육시간", { min: 0, maxScale: 1 });
  const institution = parseRequiredString(row[headerIndex["주관기관"]], "주관기관", 255);
  const credits = parseOptionalDecimal(row[headerIndex["학점"]], "학점", { min: 0, maxScale: 1 });

  return {
    user: { connect: { id: userId } },
    training_name,
    type,
    start_date,
    end_date,
    hours: new Prisma.Decimal(hours),
    institution,
    credits: credits === null ? null : new Prisma.Decimal(credits)
  };
}

function parseInternalLectureRow(
  row: Array<unknown>,
  headerIndex: Record<string, number>,
  userId: string
): Prisma.internal_lecturesCreateInput {
  const lecture_name = parseRequiredString(row[headerIndex["강의명"]], "강의명", 255);
  const type = parseTrainingType(row[headerIndex["구분"]], "구분");
  const start_date = parseDateValue(row[headerIndex["시작일"]], "시작일");
  const end_date = parseDateValue(row[headerIndex["종료일"]], "종료일");

  if (end_date < start_date) {
    throw new RowValidationError("종료일은 시작일보다 빠를 수 없습니다.");
  }

  const hours = parseRequiredDecimal(row[headerIndex["강의시간"]], "강의시간", { min: 0, maxScale: 1 });
  const department_instructor = parseRequiredString(row[headerIndex["주관부서(강사명)"]], "주관부서(강사명)", 255);
  const credits = parseOptionalDecimal(row[headerIndex["학점"]], "학점", { min: 0, maxScale: 1 });

  return {
    user: { connect: { id: userId } },
    lecture_name,
    type,
    start_date,
    end_date,
    hours: new Prisma.Decimal(hours),
    department_instructor,
    credits: credits === null ? null : new Prisma.Decimal(credits)
  };
}

function parseCertificationRow(
  row: Array<unknown>,
  headerIndex: Record<string, number>,
  userId: string
): Prisma.certificationsCreateInput {
  const cert_name = parseRequiredString(row[headerIndex["자격증명"]], "자격증명", 255);
  const grade = parseRequiredString(row[headerIndex["등급"]], "등급", 100);
  const acquired_date = parseDateValue(row[headerIndex["취득일"]], "취득일");
  const credits = parseOptionalDecimal(row[headerIndex["인정학점"]], "인정학점", { min: 0, maxScale: 1 });

  return {
    user: { connect: { id: userId } },
    cert_name,
    grade,
    acquired_date,
    credits: credits === null ? null : new Prisma.Decimal(credits)
  };
}

export async function downloadBulkTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const categoryParam = String(req.params.category || "").trim();

    if (!isBulkUploadCategory(categoryParam)) {
      return res.status(400).json({ message: "지원하지 않는 카테고리입니다." });
    }

    const config = CATEGORY_CONFIG[categoryParam];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([config.headers, config.sampleRow]);

    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);

    const fileBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${config.fileName}"`);

    return res.status(200).send(fileBuffer);
  } catch (error) {
    console.error("downloadBulkTemplate error:", error);
    return res.status(500).json({ message: "템플릿 다운로드에 실패했습니다." });
  }
}

export async function bulkUploadByCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const categoryParam = String(req.params.category || "").trim();

    if (!isBulkUploadCategory(categoryParam)) {
      return res.status(400).json({ message: "지원하지 않는 카테고리입니다." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "업로드 파일이 필요합니다." });
    }

    const config = CATEGORY_CONFIG[categoryParam];
    const matrix = getSheetMatrix(req.file.buffer);

    if (matrix.length === 0) {
      return res.status(400).json({ message: "엑셀 데이터가 비어 있습니다." });
    }

    const headers = (matrix[0] || []).map((cell) => normalizeCell(cell));
    assertHeaders(headers, config.headers);

    const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<string, number>;

    const candidateRows: Array<{ rowNumber: number; values: Array<unknown> }> = [];
    const employeeIdSet = new Set<string>();

    for (let i = 1; i < matrix.length; i += 1) {
      const row = matrix[i] || [];
      const rowNumber = i + 1;

      const isBlank = row.every((cell) => isBlankCell(cell));
      if (isBlank) {
        continue;
      }

      candidateRows.push({ rowNumber, values: row });

      const employeeIdCell = row[headerIndex["사번"]];
      const employeeId = normalizeCell(employeeIdCell);
      if (employeeId) {
        employeeIdSet.add(employeeId);
      }
    }

    if (candidateRows.length === 0) {
      const emptyResult: BulkUploadResult = {
        category: categoryParam,
        createdCount: 0,
        failedCount: 0,
        totalRows: 0,
        failedRows: []
      };

      return res.status(200).json(emptyResult);
    }

    const users = await prisma.users.findMany({
      where: {
        employee_id: {
          in: Array.from(employeeIdSet)
        }
      },
      select: {
        id: true,
        employee_id: true
      }
    });

    const userMap = buildUserMap(users);
    const failedRows: RowError[] = [];
    let createdCount = 0;

    for (const candidate of candidateRows) {
      try {
        const employee_id = parseRequiredString(candidate.values[headerIndex["사번"]], "사번", 50);
        const userId = userMap.get(employee_id);

        if (!userId) {
          throw new RowValidationError(`사번(${employee_id})에 해당하는 사용자가 없습니다.`);
        }

        if (categoryParam === "external-training") {
          const data = parseExternalTrainingRow(candidate.values, headerIndex, userId);
          await prisma.external_trainings.create({ data });
        } else if (categoryParam === "internal-training") {
          const data = parseInternalTrainingRow(candidate.values, headerIndex, userId);
          await prisma.internal_trainings.create({ data });
        } else if (categoryParam === "internal-lecture") {
          const data = parseInternalLectureRow(candidate.values, headerIndex, userId);
          await prisma.internal_lectures.create({ data });
        } else {
          const data = parseCertificationRow(candidate.values, headerIndex, userId);
          await prisma.certifications.create({ data });
        }

        createdCount += 1;
      } catch (error) {
        const reason = error instanceof RowValidationError ? error.message : "행 처리 중 오류가 발생했습니다.";
        failedRows.push({
          row: candidate.rowNumber,
          reason
        });
      }
    }

    const result: BulkUploadResult = {
      category: categoryParam,
      createdCount,
      failedCount: failedRows.length,
      totalRows: createdCount + failedRows.length,
      failedRows
    };

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof RowValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("bulkUploadByCategory error:", error);
    return res.status(500).json({ message: "일괄 업로드 처리에 실패했습니다." });
  }
}

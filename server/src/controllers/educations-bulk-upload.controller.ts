import { certificate_status_enum, Prisma, training_type_enum } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

interface ExternalEducationRecord {
  no: number;
  division: string;
  team: string;
  name: string;
  educationType: string;
  educationName: string;
  startDate: string;
  endDate: string;
  days: number;
  cost: number;
  organizer: string;
  certificate: string;
}

interface FailedRow {
  no: number;
  name: string;
  reason: string;
}

function normalizeStr(value: unknown): string {
  return String(value ?? "").trim();
}

/** Parse YYYY-MM-DD string → UTC Date. Returns null if not parseable. */
function tryParseDate(value: unknown): Date | null {
  const str = normalizeStr(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const date = new Date(`${str}T00:00:00.000Z`);
  return isNaN(date.getTime()) ? null : date;
}

interface ParsedRecord {
  name: string;
  team: string;
  division: string;
  educationName: string;
  educationType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  cost: number;
  organizer: string;
  certificateStatus: certificate_status_enum;
}

function parseRecord(record: ExternalEducationRecord): ParsedRecord {
  const startDate = tryParseDate(record.startDate);
  const endDate = tryParseDate(record.endDate);
  if (!startDate || !endDate) {
    throw new Error("날짜를 파싱할 수 없습니다. (YYYY-MM-DD 형식 필요)");
  }

  const days = Number(record.days);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("교육일수는 양수여야 합니다.");
  }

  const cost = Number(record.cost);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("교육비는 0 이상이어야 합니다.");
  }

  const educationName = normalizeStr(record.educationName);
  if (!educationName) {
    throw new Error("교육명은 필수입니다.");
  }

  const organizer = normalizeStr(record.organizer);
  if (!organizer) {
    throw new Error("교육주관은 필수입니다.");
  }

  const certRaw = normalizeStr(record.certificate).toUpperCase();
  const certStatus =
    certRaw === "Y" ? certificate_status_enum.SUBMITTED : certificate_status_enum.NOT_SUBMITTED;

  return {
    name: normalizeStr(record.name),
    team: normalizeStr(record.team),
    division: normalizeStr(record.division),
    educationName,
    educationType: normalizeStr(record.educationType),
    startDate,
    endDate,
    hours: days * 8,
    cost,
    organizer,
    certificateStatus: certStatus,
  };
}

export async function bulkUploadExternalEducations(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as { records?: unknown };

    if (!Array.isArray(body.records) || body.records.length === 0) {
      return res.status(400).json({ success: false, error: "업로드할 데이터가 없습니다." });
    }

    if (body.records.length > 1000) {
      return res.status(400).json({ success: false, error: "한 번에 최대 1000건까지 업로드할 수 있습니다." });
    }

    const records = body.records as ExternalEducationRecord[];

    // Collect all names for a single DB lookup
    const nameSet = new Set<string>();
    for (const record of records) {
      const name = normalizeStr(record.name);
      if (name) nameSet.add(name);
    }

    const matchedUsers = await prisma.users.findMany({
      where: { name: { in: Array.from(nameSet) }, is_active: true },
      select: { id: true, name: true, team: true, department: true },
    });

    // key: "name::team::department"
    const userMap = new Map<string, string>();
    for (const user of matchedUsers) {
      userMap.set(`${user.name}::${user.team}::${user.department}`, user.id);
    }

    let insertedCount = 0;
    const failedRows: FailedRow[] = [];

    for (const record of records) {
      const no = record.no;
      const name = normalizeStr(record.name);

      try {
        const parsed = parseRecord(record);

        if (!parsed.name) {
          failedRows.push({ no, name: "(이름 없음)", reason: "이름은 필수입니다." });
          continue;
        }

        const userId = userMap.get(`${parsed.name}::${parsed.team}::${parsed.division}`);
        if (!userId) {
          failedRows.push({ no, name: parsed.name, reason: "시스템에 등록된 직원을 찾을 수 없습니다. (이름·팀·본부 일치 확인)" });
          continue;
        }

        await prisma.external_trainings.create({
          data: {
            user: { connect: { id: userId } },
            training_name: parsed.educationName,
            education_category: parsed.educationType || null,
            type: training_type_enum.OFFLINE,
            start_date: parsed.startDate,
            end_date: parsed.endDate,
            hours: new Prisma.Decimal(parsed.hours),
            cost: parsed.cost,
            institution: parsed.organizer,
            certificate_status: parsed.certificateStatus,
          },
        });

        insertedCount++;
      } catch (err) {
        failedRows.push({
          no,
          name: name || "(이름 없음)",
          reason: err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      insertedCount,
      failedCount: failedRows.length,
      failedRows,
    });
  } catch (error) {
    console.error("bulkUploadExternalEducations error:", error);
    return res.status(500).json({ success: false, error: "일괄 업로드 처리에 실패했습니다." });
  }
}

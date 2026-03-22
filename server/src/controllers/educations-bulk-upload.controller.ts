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

class RecordValidationError extends Error {}

function normalizeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function validateDateStr(value: string, fieldName: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RecordValidationError(`${fieldName}은(는) YYYY-MM-DD 형식이어야 합니다.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    throw new RecordValidationError(`${fieldName} 날짜가 올바르지 않습니다.`);
  }
  return date;
}

function validateRecord(record: ExternalEducationRecord): {
  division: string;
  team: string;
  name: string;
  educationType: string;
  educationName: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  cost: number;
  organizer: string;
  certificateStatus: certificate_status_enum;
} {
  const division = normalizeStr(record.division);
  const team = normalizeStr(record.team);
  const name = normalizeStr(record.name);
  const educationType = normalizeStr(record.educationType);
  const educationName = normalizeStr(record.educationName);
  const organizer = normalizeStr(record.organizer);
  const certificateRaw = normalizeStr(record.certificate).toUpperCase();

  if (!division) throw new RecordValidationError("본부는 필수입니다.");
  if (!team) throw new RecordValidationError("팀은 필수입니다.");
  if (!name) throw new RecordValidationError("이름은 필수입니다.");
  if (!educationName) throw new RecordValidationError("교육명은 필수입니다.");
  if (!organizer) throw new RecordValidationError("교육주관은 필수입니다.");

  const startDate = validateDateStr(normalizeStr(record.startDate), "시작일자");
  const endDate = validateDateStr(normalizeStr(record.endDate), "종료일자");

  if (endDate < startDate) {
    throw new RecordValidationError("종료일자는 시작일자 이후여야 합니다.");
  }

  const days = Number(record.days);
  if (!Number.isFinite(days) || days <= 0) {
    throw new RecordValidationError("교육일수는 양수여야 합니다.");
  }

  const cost = Number(record.cost);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new RecordValidationError("교육비는 0 이상이어야 합니다.");
  }

  if (certificateRaw !== "Y" && certificateRaw !== "N") {
    throw new RecordValidationError("이수증은 Y 또는 N이어야 합니다.");
  }

  return {
    division,
    team,
    name,
    educationType,
    educationName,
    startDate,
    endDate,
    hours: days * 8,
    cost,
    organizer,
    certificateStatus: certificateRaw === "Y" ? certificate_status_enum.SUBMITTED : certificate_status_enum.NOT_SUBMITTED,
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

    const nameSet = new Set<string>();
    for (const record of records) {
      const name = normalizeStr(record.name);
      if (name) nameSet.add(name);
    }

    const matchedUsers = await prisma.users.findMany({
      where: {
        name: { in: Array.from(nameSet) },
        is_active: true,
      },
      select: { id: true, name: true, team: true, department: true },
    });

    const userMap = new Map<string, string>();
    for (const user of matchedUsers) {
      const key = `${user.name}::${user.team}::${user.department}`;
      userMap.set(key, user.id);
    }

    let insertedCount = 0;

    for (const record of records) {
      try {
        const validated = validateRecord(record);
        const userKey = `${validated.name}::${validated.team}::${validated.division}`;
        const userId = userMap.get(userKey);

        if (!userId) {
          continue;
        }

        await prisma.external_trainings.create({
          data: {
            user: { connect: { id: userId } },
            training_name: validated.educationName,
            education_category: validated.educationType || null,
            type: training_type_enum.OFFLINE,
            start_date: validated.startDate,
            end_date: validated.endDate,
            hours: new Prisma.Decimal(validated.hours),
            cost: validated.cost,
            institution: validated.organizer,
            certificate_status: validated.certificateStatus,
          },
        });

        insertedCount++;
      } catch {
        continue;
      }
    }

    return res.status(200).json({ success: true, insertedCount });
  } catch (error) {
    console.error("bulkUploadExternalEducations error:", error);
    return res.status(500).json({ success: false, error: "일괄 업로드 처리에 실패했습니다." });
  }
}

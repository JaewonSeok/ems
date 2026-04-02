import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type AllRecordsCategoryFilter = "all" | "external-training" | "internal-training" | "internal-lecture" | "certification";
export type AllRecordsSortField =
  | "employee_name"
  | "employee_id"
  | "department"
  | "team"
  | "category"
  | "title"
  | "type"
  | "start_date"
  | "end_date"
  | "hours"
  | "cost"
  | "certificate_status"
  | "credits"
  | "created_at";
export type AllRecordsSortOrder = "asc" | "desc";

type UnifiedRecordInternal = {
  id: string;
  source_id: string;
  category: "EXTERNAL_TRAINING" | "INTERNAL_TRAINING" | "INTERNAL_LECTURE" | "CERTIFICATION";
  category_label: "사외교육" | "사내교육" | "사내강의" | "자격증";
  user_id: string;
  employee_name: string;
  employee_id: string;
  department: string;
  team: string;
  title: string;
  type: "OFFLINE" | "ONLINE" | null;
  start_date: string | null;
  end_date: string | null;
  hours: number | null;
  cost: number | null;
  certificate_status: "SUBMITTED" | "NOT_SUBMITTED" | "N/A";
  credits: number | null;
  created_at: string;
};

export type UnifiedRecord = Omit<UnifiedRecordInternal, never>;

function toDateString(value: Date | null) {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function buildSearchWhere(search: string) {
  if (!search) {
    return undefined;
  }

  return {
    contains: search,
    mode: "insensitive" as const
  };
}

function shouldInclude(categoryFilter: AllRecordsCategoryFilter, category: AllRecordsCategoryFilter) {
  return categoryFilter === "all" || categoryFilter === category;
}

export async function getUnifiedRecords(params: { search: string; category: AllRecordsCategoryFilter }) {
  const searchWhere = buildSearchWhere(params.search);

  const jobs: Array<Promise<UnifiedRecordInternal[]>> = [];

  if (shouldInclude(params.category, "external-training")) {
    const where: Prisma.external_trainingsWhereInput | undefined = searchWhere
      ? {
          OR: [{ training_name: searchWhere }, { user: { name: searchWhere } }, { user: { employee_id: searchWhere } }]
        }
      : undefined;

    jobs.push(
      prisma.external_trainings
        .findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employee_id: true,
                department: true,
                team: true
              }
            }
          }
        })
        .then((rows) =>
          rows.map((row) => ({
            id: `${row.id}:EXTERNAL_TRAINING`,
            source_id: row.id,
            category: "EXTERNAL_TRAINING" as const,
            category_label: "사외교육" as const,
            user_id: row.user_id,
            employee_name: row.user.name,
            employee_id: row.user.employee_id,
            department: row.user.department,
            team: row.user.team,
            title: row.training_name,
            type: row.type,
            start_date: toDateString(row.start_date),
            end_date: toDateString(row.end_date),
            hours: Number(row.hours),
            cost: row.cost,
            certificate_status: row.certificate_status,
            credits: toNumber(row.credits),
            created_at: row.created_at.toISOString()
          }))
        )
    );
  }

  if (shouldInclude(params.category, "internal-training")) {
    const where: Prisma.internal_trainingsWhereInput | undefined = searchWhere
      ? {
          OR: [{ training_name: searchWhere }, { user: { name: searchWhere } }, { user: { employee_id: searchWhere } }]
        }
      : undefined;

    jobs.push(
      prisma.internal_trainings
        .findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employee_id: true,
                department: true,
                team: true
              }
            }
          }
        })
        .then((rows) =>
          rows.map((row) => ({
            id: `${row.id}:INTERNAL_TRAINING`,
            source_id: row.id,
            category: "INTERNAL_TRAINING" as const,
            category_label: "사내교육" as const,
            user_id: row.user_id,
            employee_name: row.user.name,
            employee_id: row.user.employee_id,
            department: row.user.department,
            team: row.user.team,
            title: row.training_name,
            type: row.type,
            start_date: toDateString(row.start_date),
            end_date: toDateString(row.end_date),
            hours: Number(row.hours),
            cost: null,
            certificate_status: row.certificate_status,
            credits: toNumber(row.credits),
            created_at: row.created_at.toISOString()
          }))
        )
    );
  }

  if (shouldInclude(params.category, "internal-lecture")) {
    const where: Prisma.internal_lecturesWhereInput | undefined = searchWhere
      ? {
          OR: [{ lecture_name: searchWhere }, { user: { name: searchWhere } }, { user: { employee_id: searchWhere } }]
        }
      : undefined;

    jobs.push(
      prisma.internal_lectures
        .findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employee_id: true,
                department: true,
                team: true
              }
            }
          }
        })
        .then((rows) =>
          rows.map((row) => ({
            id: `${row.id}:INTERNAL_LECTURE`,
            source_id: row.id,
            category: "INTERNAL_LECTURE" as const,
            category_label: "사내강의" as const,
            user_id: row.user_id,
            employee_name: row.user.name,
            employee_id: row.user.employee_id,
            department: row.user.department,
            team: row.user.team,
            title: row.lecture_name,
            type: row.type,
            start_date: toDateString(row.start_date),
            end_date: toDateString(row.end_date),
            hours: Number(row.hours),
            cost: null,
            certificate_status: "N/A" as const,
            credits: toNumber(row.credits),
            created_at: row.created_at.toISOString()
          }))
        )
    );
  }

  if (shouldInclude(params.category, "certification")) {
    const where: Prisma.certificationsWhereInput | undefined = searchWhere
      ? {
          OR: [{ cert_name: searchWhere }, { user: { name: searchWhere } }, { user: { employee_id: searchWhere } }]
        }
      : undefined;

    jobs.push(
      prisma.certifications
        .findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employee_id: true,
                department: true,
                team: true
              }
            }
          }
        })
        .then((rows) =>
          rows.map((row) => ({
            id: `${row.id}:CERTIFICATION`,
            source_id: row.id,
            category: "CERTIFICATION" as const,
            category_label: "자격증" as const,
            user_id: row.user_id,
            employee_name: row.user.name,
            employee_id: row.user.employee_id,
            department: row.user.department,
            team: row.user.team,
            title: row.cert_name,
            type: null,
            start_date: toDateString(row.acquired_date),
            end_date: null,
            hours: null,
            cost: null,
            certificate_status: "N/A" as const,
            credits: toNumber(row.credits),
            created_at: row.created_at.toISOString()
          }))
        )
    );
  }

  const chunks = await Promise.all(jobs);
  return chunks.flat();
}

function compareNullableString(a: string | null, b: string | null, order: AllRecordsSortOrder) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  const compared = a.localeCompare(b, "ko");
  return order === "asc" ? compared : -compared;
}

function compareNullableNumber(a: number | null, b: number | null, order: AllRecordsSortOrder) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return order === "asc" ? a - b : b - a;
}

export function sortUnifiedRecords(records: UnifiedRecordInternal[], sort: AllRecordsSortField, order: AllRecordsSortOrder) {
  return [...records].sort((left, right) => {
    switch (sort) {
      case "employee_name":
        return compareNullableString(left.employee_name, right.employee_name, order);
      case "employee_id":
        return compareNullableString(left.employee_id, right.employee_id, order);
      case "department":
        return compareNullableString(left.department, right.department, order);
      case "team":
        return compareNullableString(left.team, right.team, order);
      case "category":
        return compareNullableString(left.category_label, right.category_label, order);
      case "title":
        return compareNullableString(left.title, right.title, order);
      case "type":
        return compareNullableString(left.type, right.type, order);
      case "start_date":
        return compareNullableString(left.start_date, right.start_date, order);
      case "end_date":
        return compareNullableString(left.end_date, right.end_date, order);
      case "hours":
        return compareNullableNumber(left.hours, right.hours, order);
      case "cost":
        return compareNullableNumber(left.cost, right.cost, order);
      case "certificate_status":
        return compareNullableString(left.certificate_status, right.certificate_status, order);
      case "credits":
        return compareNullableNumber(left.credits, right.credits, order);
      case "created_at":
      default:
        return compareNullableString(left.created_at, right.created_at, order);
    }
  });
}

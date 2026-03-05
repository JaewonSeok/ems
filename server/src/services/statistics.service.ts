import { Prisma, role_enum, training_type_enum } from "@prisma/client";
import { prisma } from "../config/prisma";

type StatisticsCategory = "external-training" | "internal-training" | "internal-lecture" | "certification";

type StatisticsScope = {
  userId: string;
  role: role_enum;
};

export type StatisticsFilters = {
  year: number;
  department: string | null;
  categories: StatisticsCategory[];
  rawCategory: string;
};

export type StatisticsOverviewResponse = {
  filters: {
    year: number;
    department: string;
    category: string;
  };
  meta: {
    departments: string[];
    scope: "ADMIN" | "USER";
  };
  monthlyHours: Array<{ month: number; hours: number }>;
  categoryCounts: Array<{ category: StatisticsCategory; count: number }>;
  typeRatios: Array<{ type: training_type_enum; count: number }>;
  departmentComparison: Array<{ department: string; recordCount: number; hours: number; credits: number }>;
};

export type StatisticsCostTrendResponse = {
  filters: {
    year: number;
    department: string;
    category: string;
  };
  items: Array<{ month: number; cost: number }>;
};

export type StatisticsCompletionRateResponse = {
  filters: {
    year: number;
    department: string;
    category: string;
  };
  items: Array<{
    category: "external-training" | "internal-training";
    submitted: number;
    notSubmitted: number;
    approved: number;
    rejected: number;
  }>;
};

export type StatisticsTopEmployeesResponse = {
  filters: {
    year: number;
    department: string;
    category: string;
  };
  items: Array<{
    userId: string;
    employeeId: string;
    name: string;
    department: string;
    team: string;
    totalHours: number;
  }>;
};

const ALL_CATEGORIES: StatisticsCategory[] = [
  "external-training",
  "internal-training",
  "internal-lecture",
  "certification"
];
const DEFAULT_STATISTICS_YEAR = 2026;

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value);
}

function startOfYearUtc(year: number) {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

function endOfYearUtc(year: number) {
  return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
}

function monthFromDate(value: Date) {
  return value.getUTCMonth() + 1;
}

export function parseStatisticsFilters(query: {
  year?: string;
  department?: string;
  category?: string;
}): StatisticsFilters {
  const rawYear = String(query.year || "").trim();
  const year = rawYear ? Number(rawYear) : DEFAULT_STATISTICS_YEAR;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("INVALID_YEAR");
  }

  const departmentRaw = String(query.department || "all").trim();
  const department = !departmentRaw || departmentRaw === "all" ? null : departmentRaw;

  if (department && department.length > 100) {
    throw new Error("INVALID_DEPARTMENT");
  }

  const rawCategory = String(query.category || "all").trim().toLowerCase();
  let categories: StatisticsCategory[];

  if (!rawCategory || rawCategory === "all") {
    categories = [...ALL_CATEGORIES];
  } else {
    const parsed = Array.from(
      new Set(
        rawCategory
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    const invalid = parsed.find((value) => !ALL_CATEGORIES.includes(value as StatisticsCategory));

    if (invalid) {
      throw new Error("INVALID_CATEGORY");
    }

    categories = parsed as StatisticsCategory[];

    if (categories.length === 0) {
      categories = [...ALL_CATEGORIES];
    }
  }

  return {
    year,
    department,
    categories,
    rawCategory: rawCategory || "all"
  };
}

function includesCategory(filters: StatisticsFilters, category: StatisticsCategory) {
  return filters.categories.includes(category);
}

function buildExternalWhere(filters: StatisticsFilters, scope: StatisticsScope): Prisma.external_trainingsWhereInput {
  const where: Prisma.external_trainingsWhereInput = {
    start_date: {
      gte: startOfYearUtc(filters.year),
      lt: endOfYearUtc(filters.year)
    }
  };

  if (scope.role === role_enum.USER) {
    where.user_id = scope.userId;
  }

  if (filters.department) {
    where.user = {
      department: filters.department
    };
  }

  return where;
}

function buildInternalWhere(filters: StatisticsFilters, scope: StatisticsScope): Prisma.internal_trainingsWhereInput {
  const where: Prisma.internal_trainingsWhereInput = {
    start_date: {
      gte: startOfYearUtc(filters.year),
      lt: endOfYearUtc(filters.year)
    }
  };

  if (scope.role === role_enum.USER) {
    where.user_id = scope.userId;
  }

  if (filters.department) {
    where.user = {
      department: filters.department
    };
  }

  return where;
}

function buildLectureWhere(filters: StatisticsFilters, scope: StatisticsScope): Prisma.internal_lecturesWhereInput {
  const where: Prisma.internal_lecturesWhereInput = {
    start_date: {
      gte: startOfYearUtc(filters.year),
      lt: endOfYearUtc(filters.year)
    }
  };

  if (scope.role === role_enum.USER) {
    where.user_id = scope.userId;
  }

  if (filters.department) {
    where.user = {
      department: filters.department
    };
  }

  return where;
}

function buildCertificationWhere(filters: StatisticsFilters, scope: StatisticsScope): Prisma.certificationsWhereInput {
  const where: Prisma.certificationsWhereInput = {
    acquired_date: {
      gte: startOfYearUtc(filters.year),
      lt: endOfYearUtc(filters.year)
    }
  };

  if (scope.role === role_enum.USER) {
    where.user_id = scope.userId;
  }

  if (filters.department) {
    where.user = {
      department: filters.department
    };
  }

  return where;
}

async function getDepartmentOptions(scope: StatisticsScope) {
  if (scope.role === role_enum.USER) {
    const me = await prisma.users.findUnique({
      where: { id: scope.userId },
      select: { department: true }
    });

    if (!me?.department) {
      return [];
    }

    return [me.department];
  }

  const rows = await prisma.users.findMany({
    where: {
      is_active: true
    },
    select: {
      department: true
    },
    distinct: ["department"],
    orderBy: {
      department: "asc"
    }
  });

  return rows.map((row) => row.department);
}

export async function getStatisticsOverview(
  filters: StatisticsFilters,
  scope: StatisticsScope
): Promise<StatisticsOverviewResponse> {
  const externalEnabled = includesCategory(filters, "external-training");
  const internalEnabled = includesCategory(filters, "internal-training");
  const lectureEnabled = includesCategory(filters, "internal-lecture");
  const certificationEnabled = includesCategory(filters, "certification");

  const [externalRows, internalRows, lectureRows, certificationRows, departments] = await Promise.all([
    externalEnabled
      ? prisma.external_trainings.findMany({
          where: buildExternalWhere(filters, scope),
          select: {
            start_date: true,
            hours: true,
            credits: true,
            type: true,
            user: {
              select: {
                department: true
              }
            }
          }
        })
      : Promise.resolve([]),
    internalEnabled
      ? prisma.internal_trainings.findMany({
          where: buildInternalWhere(filters, scope),
          select: {
            start_date: true,
            hours: true,
            credits: true,
            type: true,
            user: {
              select: {
                department: true
              }
            }
          }
        })
      : Promise.resolve([]),
    lectureEnabled
      ? prisma.internal_lectures.findMany({
          where: buildLectureWhere(filters, scope),
          select: {
            start_date: true,
            hours: true,
            credits: true,
            type: true,
            user: {
              select: {
                department: true
              }
            }
          }
        })
      : Promise.resolve([]),
    certificationEnabled
      ? prisma.certifications.findMany({
          where: buildCertificationWhere(filters, scope),
          select: {
            credits: true,
            user: {
              select: {
                department: true
              }
            }
          }
        })
      : Promise.resolve([]),
    getDepartmentOptions(scope)
  ]);

  const monthlyMap = new Map<number, number>();
  for (let month = 1; month <= 12; month += 1) {
    monthlyMap.set(month, 0);
  }

  const typeMap = new Map<training_type_enum, number>([
    [training_type_enum.OFFLINE, 0],
    [training_type_enum.ONLINE, 0]
  ]);

  const departmentMap = new Map<string, { recordCount: number; hours: number; credits: number }>();

  function upsertDepartment(department: string, payload: { recordCount: number; hours: number; credits: number }) {
    const current = departmentMap.get(department) || { recordCount: 0, hours: 0, credits: 0 };
    current.recordCount += payload.recordCount;
    current.hours += payload.hours;
    current.credits += payload.credits;
    departmentMap.set(department, current);
  }

  for (const row of externalRows) {
    const month = monthFromDate(row.start_date);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + toNumber(row.hours));
    typeMap.set(row.type, (typeMap.get(row.type) || 0) + 1);
    upsertDepartment(row.user.department, {
      recordCount: 1,
      hours: toNumber(row.hours),
      credits: toNumber(row.credits)
    });
  }

  for (const row of internalRows) {
    const month = monthFromDate(row.start_date);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + toNumber(row.hours));
    typeMap.set(row.type, (typeMap.get(row.type) || 0) + 1);
    upsertDepartment(row.user.department, {
      recordCount: 1,
      hours: toNumber(row.hours),
      credits: toNumber(row.credits)
    });
  }

  for (const row of lectureRows) {
    const month = monthFromDate(row.start_date);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + toNumber(row.hours));
    typeMap.set(row.type, (typeMap.get(row.type) || 0) + 1);
    upsertDepartment(row.user.department, {
      recordCount: 1,
      hours: toNumber(row.hours),
      credits: toNumber(row.credits)
    });
  }

  for (const row of certificationRows) {
    upsertDepartment(row.user.department, {
      recordCount: 1,
      hours: 0,
      credits: toNumber(row.credits)
    });
  }

  const monthlyHours = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    hours: monthlyMap.get(index + 1) || 0
  }));

  const categoryCounts: StatisticsOverviewResponse["categoryCounts"] = [
    {
      category: "external-training",
      count: externalRows.length
    },
    {
      category: "internal-training",
      count: internalRows.length
    },
    {
      category: "internal-lecture",
      count: lectureRows.length
    },
    {
      category: "certification",
      count: certificationRows.length
    }
  ];

  const typeRatios: StatisticsOverviewResponse["typeRatios"] = [
    {
      type: training_type_enum.OFFLINE,
      count: typeMap.get(training_type_enum.OFFLINE) || 0
    },
    {
      type: training_type_enum.ONLINE,
      count: typeMap.get(training_type_enum.ONLINE) || 0
    }
  ];

  const departmentComparison = Array.from(departmentMap.entries())
    .map(([department, value]) => ({
      department,
      recordCount: value.recordCount,
      hours: Number(value.hours.toFixed(1)),
      credits: Number(value.credits.toFixed(1))
    }))
    .sort((a, b) => a.department.localeCompare(b.department, "ko-KR"));

  return {
    filters: {
      year: filters.year,
      department: filters.department ?? "all",
      category: filters.rawCategory || "all"
    },
    meta: {
      departments,
      scope: scope.role
    },
    monthlyHours,
    categoryCounts,
    typeRatios,
    departmentComparison
  };
}

export async function getStatisticsCostTrend(
  filters: StatisticsFilters,
  scope: StatisticsScope
): Promise<StatisticsCostTrendResponse> {
  const items = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, cost: 0 }));

  if (!includesCategory(filters, "external-training")) {
    return {
      filters: {
        year: filters.year,
        department: filters.department ?? "all",
        category: filters.rawCategory || "all"
      },
      items
    };
  }

  const rows = await prisma.external_trainings.findMany({
    where: buildExternalWhere(filters, scope),
    select: {
      start_date: true,
      cost: true
    }
  });

  for (const row of rows) {
    const month = monthFromDate(row.start_date);
    const target = items[month - 1];
    target.cost += Number(row.cost || 0);
  }

  return {
    filters: {
      year: filters.year,
      department: filters.department ?? "all",
      category: filters.rawCategory || "all"
    },
    items
  };
}

export async function getStatisticsCompletionRate(
  filters: StatisticsFilters,
  scope: StatisticsScope
): Promise<StatisticsCompletionRateResponse> {
  const [externalRows, internalRows] = await Promise.all([
    includesCategory(filters, "external-training")
      ? prisma.external_trainings.findMany({
          where: buildExternalWhere(filters, scope),
          select: {
            certificate_status: true,
            approval_status: true
          }
        })
      : Promise.resolve([]),
    includesCategory(filters, "internal-training")
      ? prisma.internal_trainings.findMany({
          where: buildInternalWhere(filters, scope),
          select: {
            certificate_status: true
          }
        })
      : Promise.resolve([])
  ]);

  const external = {
    category: "external-training" as const,
    submitted: 0,
    notSubmitted: 0,
    approved: 0,
    rejected: 0
  };

  for (const row of externalRows) {
    if (row.certificate_status === "SUBMITTED") {
      external.submitted += 1;
    } else {
      external.notSubmitted += 1;
    }

    if (row.approval_status === "APPROVED") {
      external.approved += 1;
    }

    if (row.approval_status === "REJECTED") {
      external.rejected += 1;
    }
  }

  const internal = {
    category: "internal-training" as const,
    submitted: 0,
    notSubmitted: 0,
    approved: 0,
    rejected: 0
  };

  for (const row of internalRows) {
    if (row.certificate_status === "SUBMITTED") {
      internal.submitted += 1;
    } else {
      internal.notSubmitted += 1;
    }
  }

  return {
    filters: {
      year: filters.year,
      department: filters.department ?? "all",
      category: filters.rawCategory || "all"
    },
    items: [external, internal]
  };
}

export async function getStatisticsTopEmployees(
  filters: StatisticsFilters,
  scope: StatisticsScope
): Promise<StatisticsTopEmployeesResponse> {
  const [externalRows, internalRows, lectureRows] = await Promise.all([
    includesCategory(filters, "external-training")
      ? prisma.external_trainings.findMany({
          where: buildExternalWhere(filters, scope),
          select: {
            user_id: true,
            hours: true,
            user: {
              select: {
                employee_id: true,
                name: true,
                department: true,
                team: true
              }
            }
          }
        })
      : Promise.resolve([]),
    includesCategory(filters, "internal-training")
      ? prisma.internal_trainings.findMany({
          where: buildInternalWhere(filters, scope),
          select: {
            user_id: true,
            hours: true,
            user: {
              select: {
                employee_id: true,
                name: true,
                department: true,
                team: true
              }
            }
          }
        })
      : Promise.resolve([]),
    includesCategory(filters, "internal-lecture")
      ? prisma.internal_lectures.findMany({
          where: buildLectureWhere(filters, scope),
          select: {
            user_id: true,
            hours: true,
            user: {
              select: {
                employee_id: true,
                name: true,
                department: true,
                team: true
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const map = new Map<
    string,
    {
      employeeId: string;
      name: string;
      department: string;
      team: string;
      totalHours: number;
    }
  >();

  function putRow(row: {
    user_id: string;
    hours: Prisma.Decimal;
    user: { employee_id: string; name: string; department: string; team: string };
  }) {
    const current = map.get(row.user_id) || {
      employeeId: row.user.employee_id,
      name: row.user.name,
      department: row.user.department,
      team: row.user.team,
      totalHours: 0
    };

    current.totalHours += toNumber(row.hours);
    map.set(row.user_id, current);
  }

  externalRows.forEach(putRow);
  internalRows.forEach(putRow);
  lectureRows.forEach(putRow);

  const items = Array.from(map.entries())
    .map(([userId, value]) => ({
      userId,
      employeeId: value.employeeId,
      name: value.name,
      department: value.department,
      team: value.team,
      totalHours: Number(value.totalHours.toFixed(1))
    }))
    .sort((a, b) => {
      if (b.totalHours !== a.totalHours) {
        return b.totalHours - a.totalHours;
      }

      return a.name.localeCompare(b.name, "ko-KR");
    })
    .slice(0, 10);

  return {
    filters: {
      year: filters.year,
      department: filters.department ?? "all",
      category: filters.rawCategory || "all"
    },
    items
  };
}

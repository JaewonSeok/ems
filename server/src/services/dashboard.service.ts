import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type DashboardSummary = {
  totalRecords: number;
  totalHours: number;
  totalCredits: number;
  notSubmittedCount: number;
};

export type DashboardMonthlyHoursPoint = {
  month: number;
  hours: number;
};

export type DashboardCategoryCount = {
  category: "EXTERNAL" | "INTERNAL" | "LECTURE";
  count: number;
};

export type DashboardDepartmentSummary = {
  department: string;
  recordCount: number;
  hours: number;
  credits: number;
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [externalAgg, internalAgg, lectureAgg, certificationAgg, externalNotSubmitted, internalNotSubmitted] =
    await Promise.all([
      prisma.external_trainings.aggregate({
        _count: { id: true },
        _sum: { hours: true, credits: true }
      }),
      prisma.internal_trainings.aggregate({
        _count: { id: true },
        _sum: { hours: true, credits: true }
      }),
      prisma.internal_lectures.aggregate({
        _count: { id: true },
        _sum: { hours: true, credits: true }
      }),
      prisma.certifications.aggregate({
        _count: { id: true },
        _sum: { credits: true }
      }),
      prisma.external_trainings.count({ where: { certificate_status: "NOT_SUBMITTED" } }),
      prisma.internal_trainings.count({ where: { certificate_status: "NOT_SUBMITTED" } })
    ]);

  const totalRecords =
    externalAgg._count.id + internalAgg._count.id + lectureAgg._count.id + certificationAgg._count.id;

  const totalHours =
    toNumber(externalAgg._sum.hours) + toNumber(internalAgg._sum.hours) + toNumber(lectureAgg._sum.hours);

  const totalCredits =
    toNumber(externalAgg._sum.credits) +
    toNumber(internalAgg._sum.credits) +
    toNumber(lectureAgg._sum.credits) +
    toNumber(certificationAgg._sum.credits);

  const notSubmittedCount = externalNotSubmitted + internalNotSubmitted;

  return {
    totalRecords,
    totalHours,
    totalCredits,
    notSubmittedCount
  };
}

export async function getDashboardMonthlyHours(year: number): Promise<DashboardMonthlyHoursPoint[]> {
  const rows = await prisma.$queryRaw<{ month: number; hours: number | string }[]>(Prisma.sql`
    SELECT month, SUM(hours)::float8 AS hours
    FROM (
      SELECT EXTRACT(MONTH FROM start_date)::int AS month, hours::numeric AS hours
      FROM external_trainings
      WHERE EXTRACT(YEAR FROM start_date) = ${year}
      UNION ALL
      SELECT EXTRACT(MONTH FROM start_date)::int AS month, hours::numeric AS hours
      FROM internal_trainings
      WHERE EXTRACT(YEAR FROM start_date) = ${year}
      UNION ALL
      SELECT EXTRACT(MONTH FROM start_date)::int AS month, hours::numeric AS hours
      FROM internal_lectures
      WHERE EXTRACT(YEAR FROM start_date) = ${year}
    ) source
    GROUP BY month
    ORDER BY month ASC
  `);

  const byMonth = new Map<number, number>();

  for (const row of rows) {
    byMonth.set(row.month, toNumber(row.hours));
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      month,
      hours: byMonth.get(month) ?? 0
    };
  });
}

export async function getDashboardCategoryCount(): Promise<DashboardCategoryCount[]> {
  const [externalCount, internalCount, lectureCount] = await Promise.all([
    prisma.external_trainings.count(),
    prisma.internal_trainings.count(),
    prisma.internal_lectures.count()
  ]);

  return [
    { category: "EXTERNAL", count: externalCount },
    { category: "INTERNAL", count: internalCount },
    { category: "LECTURE", count: lectureCount }
  ];
}

export async function getDashboardDepartmentSummary(): Promise<DashboardDepartmentSummary[]> {
  const rows = await prisma.$queryRaw<
    { department: string; record_count: bigint | number; total_hours: number | string | null; total_credits: number | string | null }[]
  >(Prisma.sql`
    SELECT
      source.department,
      SUM(source.record_count)::bigint AS record_count,
      COALESCE(SUM(source.hours), 0)::float8 AS total_hours,
      COALESCE(SUM(source.credits), 0)::float8 AS total_credits
    FROM (
      SELECT u.department, 1::int AS record_count, et.hours::numeric AS hours, COALESCE(et.credits, 0)::numeric AS credits
      FROM external_trainings et
      JOIN users u ON u.id = et.user_id
      UNION ALL
      SELECT u.department, 1::int AS record_count, it.hours::numeric AS hours, COALESCE(it.credits, 0)::numeric AS credits
      FROM internal_trainings it
      JOIN users u ON u.id = it.user_id
      UNION ALL
      SELECT u.department, 1::int AS record_count, il.hours::numeric AS hours, COALESCE(il.credits, 0)::numeric AS credits
      FROM internal_lectures il
      JOIN users u ON u.id = il.user_id
      UNION ALL
      SELECT u.department, 1::int AS record_count, 0::numeric AS hours, COALESCE(c.credits, 0)::numeric AS credits
      FROM certifications c
      JOIN users u ON u.id = c.user_id
    ) source
    GROUP BY source.department
    ORDER BY source.department ASC
  `);

  return rows.map((row) => ({
    department: row.department,
    recordCount: Number(row.record_count),
    hours: toNumber(row.total_hours),
    credits: toNumber(row.total_credits)
  }));
}

export async function seedDashboardDemoData() {
  const [admin, user] = await Promise.all([
    prisma.users.findFirst({ where: { role: "ADMIN", is_active: true } }),
    prisma.users.findFirst({ where: { role: "USER", is_active: true } })
  ]);

  if (!admin || !user) {
    throw new Error("Missing ADMIN/USER seed accounts");
  }

  const existingCount =
    (await prisma.external_trainings.count()) +
    (await prisma.internal_trainings.count()) +
    (await prisma.internal_lectures.count()) +
    (await prisma.certifications.count());

  if (existingCount > 0) {
    return { inserted: false, message: "Dashboard demo seed skipped because data already exists." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.external_trainings.createMany({
      data: [
        {
          user_id: user.id,
          training_name: "Demo External A",
          type: "OFFLINE",
          start_date: new Date("2026-01-10"),
          end_date: new Date("2026-01-12"),
          hours: new Prisma.Decimal("12.0"),
          cost: 200000,
          institution: "Demo Institute",
          certificate_status: "SUBMITTED",
          certificate_file: null,
          approval_status: "PENDING",
          approval_comment: null,
          approved_by: null,
          approved_at: null,
          credits: new Prisma.Decimal("2.0")
        },
        {
          user_id: admin.id,
          training_name: "Demo External B",
          type: "ONLINE",
          start_date: new Date("2026-02-03"),
          end_date: new Date("2026-02-04"),
          hours: new Prisma.Decimal("6.0"),
          cost: 100000,
          institution: "Demo Academy",
          certificate_status: "NOT_SUBMITTED",
          certificate_file: null,
          approval_status: "PENDING",
          approval_comment: null,
          approved_by: null,
          approved_at: null,
          credits: new Prisma.Decimal("1.0")
        }
      ]
    });

    await tx.internal_trainings.create({
      data: {
        user_id: user.id,
        training_name: "Demo Internal",
        type: "OFFLINE",
        start_date: new Date("2026-03-05"),
        end_date: new Date("2026-03-05"),
        hours: new Prisma.Decimal("4.0"),
        institution: "Company L&D",
        certificate_status: "NOT_SUBMITTED",
        certificate_file: null,
        credits: new Prisma.Decimal("1.5")
      }
    });

    await tx.internal_lectures.create({
      data: {
        user_id: admin.id,
        lecture_name: "Demo Lecture",
        type: "ONLINE",
        start_date: new Date("2026-04-15"),
        end_date: new Date("2026-04-15"),
        hours: new Prisma.Decimal("2.0"),
        department_instructor: "IT Team",
        credits: new Prisma.Decimal("1.0")
      }
    });
  });

  return { inserted: true, message: "Dashboard demo seed inserted." };
}

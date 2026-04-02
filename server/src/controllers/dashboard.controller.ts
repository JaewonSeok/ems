import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  getDashboardCategoryCount,
  getDashboardDepartmentSummary,
  getDashboardMonthlyHours,
  getDashboardSummary,
  seedDashboardDemoData
} from "../services/dashboard.service";

function parseYear(rawYear: string | undefined) {
  if (!rawYear) {
    return 2026;
  }

  const year = Number(rawYear);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid year");
  }

  return year;
}

export async function summary(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDashboardSummary();
    return res.status(200).json(data);
  } catch (error) {
    console.error("dashboard summary error:", error);
    return res.status(500).json({ message: "Failed to load dashboard summary" });
  }
}

export async function monthlyHours(req: AuthenticatedRequest, res: Response) {
  try {
    const year = parseYear(req.query.year as string | undefined);
    const data = await getDashboardMonthlyHours(year);
    return res.status(200).json({ year, items: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid year") {
      return res.status(400).json({ message: "year must be an integer between 2000 and 2100" });
    }

    console.error("dashboard monthly error:", error);
    return res.status(500).json({ message: "Failed to load monthly hours" });
  }
}

export async function categoryCount(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDashboardCategoryCount();
    return res.status(200).json({ items: data });
  } catch (error) {
    console.error("dashboard category error:", error);
    return res.status(500).json({ message: "Failed to load category counts" });
  }
}

export async function departmentSummary(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDashboardDepartmentSummary();
    return res.status(200).json({ items: data });
  } catch (error) {
    console.error("dashboard department error:", error);
    return res.status(500).json({ message: "Failed to load department summary" });
  }
}

export async function mySummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const [externalRows, internalRows, lectureRows, certRows] = await Promise.all([
      prisma.external_trainings.findMany({
        where: { user_id: userId },
        select: {
          training_name: true,
          start_date: true,
          hours: true,
          credits: true,
          certificate_status: true,
          created_at: true
        },
        orderBy: { created_at: "desc" }
      }),
      prisma.internal_trainings.findMany({
        where: { user_id: userId },
        select: {
          training_name: true,
          start_date: true,
          hours: true,
          credits: true,
          certificate_status: true,
          created_at: true
        },
        orderBy: { created_at: "desc" }
      }),
      prisma.internal_lectures.findMany({
        where: { user_id: userId },
        select: {
          lecture_name: true,
          start_date: true,
          hours: true,
          credits: true,
          created_at: true
        },
        orderBy: { created_at: "desc" }
      }),
      prisma.certifications.findMany({
        where: { user_id: userId },
        select: {
          cert_name: true,
          acquired_date: true,
          credits: true,
          created_at: true
        },
        orderBy: { created_at: "desc" }
      })
    ]);

    const toNum = (v: unknown) => Number(v ?? 0);

    const totalHours =
      externalRows.reduce((s, r) => s + toNum(r.hours), 0) +
      internalRows.reduce((s, r) => s + toNum(r.hours), 0) +
      lectureRows.reduce((s, r) => s + toNum(r.hours), 0);

    const totalCredits =
      externalRows.reduce((s, r) => s + toNum(r.credits), 0) +
      internalRows.reduce((s, r) => s + toNum(r.credits), 0) +
      lectureRows.reduce((s, r) => s + toNum(r.credits), 0) +
      certRows.reduce((s, r) => s + toNum(r.credits), 0);

    const notSubmittedCount =
      externalRows.filter((r) => r.certificate_status === "NOT_SUBMITTED").length +
      internalRows.filter((r) => r.certificate_status === "NOT_SUBMITTED").length;

    type RecentRecord = {
      category: "external-training" | "internal-training" | "internal-lecture" | "certification";
      name: string;
      date: string;
      hours: number | null;
      credits: number | null;
    };

    const allRecent: Array<RecentRecord & { _created: Date }> = [
      ...externalRows.map((r) => ({
        category: "external-training" as const,
        name: r.training_name,
        date: r.start_date.toISOString().slice(0, 10),
        hours: toNum(r.hours),
        credits: r.credits !== null ? toNum(r.credits) : null,
        _created: r.created_at
      })),
      ...internalRows.map((r) => ({
        category: "internal-training" as const,
        name: r.training_name,
        date: r.start_date.toISOString().slice(0, 10),
        hours: toNum(r.hours),
        credits: r.credits !== null ? toNum(r.credits) : null,
        _created: r.created_at
      })),
      ...lectureRows.map((r) => ({
        category: "internal-lecture" as const,
        name: r.lecture_name,
        date: r.start_date.toISOString().slice(0, 10),
        hours: toNum(r.hours),
        credits: r.credits !== null ? toNum(r.credits) : null,
        _created: r.created_at
      })),
      ...certRows.map((r) => ({
        category: "certification" as const,
        name: r.cert_name,
        date: r.acquired_date.toISOString().slice(0, 10),
        hours: null,
        credits: r.credits !== null ? toNum(r.credits) : null,
        _created: r.created_at
      }))
    ];

    const recentRecords: RecentRecord[] = allRecent
      .sort((a, b) => b._created.getTime() - a._created.getTime())
      .slice(0, 5)
      .map(({ _created: _c, ...rest }) => rest);

    return res.status(200).json({
      totalHours: Number(totalHours.toFixed(1)),
      totalCredits: Number(totalCredits.toFixed(1)),
      notSubmittedCount,
      recentRecords
    });
  } catch (error) {
    console.error("mySummary error:", error);
    return res.status(500).json({ message: "Failed to load my summary" });
  }
}

export async function demoSeed(req: AuthenticatedRequest, res: Response) {
  if (process.env.ENABLE_DASHBOARD_DEMO_SEED !== "true") {
    return res.status(403).json({ message: "Dashboard demo seed is disabled" });
  }

  try {
    const result = await seedDashboardDemoData();
    return res.status(200).json(result);
  } catch (error) {
    console.error("dashboard demo seed error:", error);
    return res.status(500).json({ message: "Failed to seed dashboard demo data" });
  }
}

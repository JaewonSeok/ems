import { Response } from "express";
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

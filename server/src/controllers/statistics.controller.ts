import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  getStatisticsCompletionRate,
  getStatisticsCostTrend,
  getStatisticsOverview,
  getStatisticsTopEmployees,
  getStatisticsYearComparison,
  parseStatisticsFilters
} from "../services/statistics.service";

function getScope(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    userId: req.user.id,
    role: req.user.role
  };
}

function parseFilters(req: AuthenticatedRequest) {
  return parseStatisticsFilters({
    year: req.query.year as string | undefined,
    department: req.query.department as string | undefined,
    category: req.query.category as string | undefined
  });
}

function handleFilterError(error: unknown, res: Response) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === "INVALID_YEAR") {
    res.status(400).json({ message: "year must be an integer between 2000 and 2100" });
    return true;
  }

  if (error.message === "INVALID_DEPARTMENT") {
    res.status(400).json({ message: "department must be <= 100 characters" });
    return true;
  }

  if (error.message === "INVALID_CATEGORY") {
    res.status(400).json({
      message: "category must be all or comma-separated values of external-training,internal-training,internal-lecture,certification"
    });
    return true;
  }

  return false;
}

export async function statisticsOverview(req: AuthenticatedRequest, res: Response) {
  try {
    const scope = getScope(req);
    const filters = parseFilters(req);
    const result = await getStatisticsOverview(filters, scope);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (handleFilterError(error, res)) {
      return;
    }

    console.error("statisticsOverview error:", error);
    return res.status(500).json({ message: "Failed to load statistics overview" });
  }
}

export async function statisticsCostTrend(req: AuthenticatedRequest, res: Response) {
  try {
    const scope = getScope(req);
    const filters = parseFilters(req);
    const result = await getStatisticsCostTrend(filters, scope);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (handleFilterError(error, res)) {
      return;
    }

    console.error("statisticsCostTrend error:", error);
    return res.status(500).json({ message: "Failed to load statistics cost trend" });
  }
}

export async function statisticsCompletionRate(req: AuthenticatedRequest, res: Response) {
  try {
    const scope = getScope(req);
    const filters = parseFilters(req);
    const result = await getStatisticsCompletionRate(filters, scope);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (handleFilterError(error, res)) {
      return;
    }

    console.error("statisticsCompletionRate error:", error);
    return res.status(500).json({ message: "Failed to load statistics completion rate" });
  }
}

export async function statisticsTopEmployees(req: AuthenticatedRequest, res: Response) {
  try {
    const scope = getScope(req);
    const filters = parseFilters(req);
    const result = await getStatisticsTopEmployees(filters, scope);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (handleFilterError(error, res)) {
      return;
    }

    console.error("statisticsTopEmployees error:", error);
    return res.status(500).json({ message: "Failed to load statistics top employees" });
  }
}

export async function statisticsYearComparison(req: AuthenticatedRequest, res: Response) {
  try {
    const scope = getScope(req);
    const filters = parseFilters(req);
    const result = await getStatisticsYearComparison(filters, scope);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (handleFilterError(error, res)) {
      return;
    }

    console.error("statisticsYearComparison error:", error);
    return res.status(500).json({ message: "Failed to load statistics year comparison" });
  }
}

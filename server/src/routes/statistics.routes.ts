import { Router } from "express";
import {
  statisticsCompletionRate,
  statisticsCostTrend,
  statisticsOverview,
  statisticsTopEmployees,
  statisticsYearComparison
} from "../controllers/statistics.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { role_enum } from "@prisma/client";

const statisticsRoutes = Router();

statisticsRoutes.use(authMiddleware);
statisticsRoutes.use(rbacMiddleware([role_enum.ADMIN]));
statisticsRoutes.get("/overview", statisticsOverview);
statisticsRoutes.get("/cost-trend", statisticsCostTrend);
statisticsRoutes.get("/completion-rate", statisticsCompletionRate);
statisticsRoutes.get("/top-employees", statisticsTopEmployees);
statisticsRoutes.get("/year-comparison", statisticsYearComparison);

export default statisticsRoutes;

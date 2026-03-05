import { Router } from "express";
import {
  statisticsCompletionRate,
  statisticsCostTrend,
  statisticsOverview,
  statisticsTopEmployees
} from "../controllers/statistics.controller";
import { authMiddleware } from "../middleware/auth";

const statisticsRoutes = Router();

statisticsRoutes.use(authMiddleware);
statisticsRoutes.get("/overview", statisticsOverview);
statisticsRoutes.get("/cost-trend", statisticsCostTrend);
statisticsRoutes.get("/completion-rate", statisticsCompletionRate);
statisticsRoutes.get("/top-employees", statisticsTopEmployees);

export default statisticsRoutes;

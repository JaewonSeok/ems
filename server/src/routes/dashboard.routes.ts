import { Router } from "express";
import { role_enum } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { categoryCount, demoSeed, departmentSummary, monthlyHours, summary } from "../controllers/dashboard.controller";

const dashboardRoutes = Router();

dashboardRoutes.use(authMiddleware, rbacMiddleware([role_enum.ADMIN]));

dashboardRoutes.get("/summary", summary);
dashboardRoutes.get("/monthly-hours", monthlyHours);
dashboardRoutes.get("/category-count", categoryCount);
dashboardRoutes.get("/department-summary", departmentSummary);
dashboardRoutes.post("/demo-seed", demoSeed);

export default dashboardRoutes;

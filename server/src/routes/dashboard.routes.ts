import { Router } from "express";
import { role_enum } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { categoryCount, demoSeed, departmentSummary, monthlyHours, mySummary, summary } from "../controllers/dashboard.controller";

const dashboardRoutes = Router();

// USER 포함 모든 인증 사용자 접근 가능
dashboardRoutes.get("/my-summary", authMiddleware, mySummary);

// 이하 ADMIN 전용
dashboardRoutes.get("/summary", authMiddleware, rbacMiddleware([role_enum.ADMIN]), summary);
dashboardRoutes.get("/monthly-hours", authMiddleware, rbacMiddleware([role_enum.ADMIN]), monthlyHours);
dashboardRoutes.get("/category-count", authMiddleware, rbacMiddleware([role_enum.ADMIN]), categoryCount);
dashboardRoutes.get("/department-summary", authMiddleware, rbacMiddleware([role_enum.ADMIN]), departmentSummary);
dashboardRoutes.post("/demo-seed", authMiddleware, rbacMiddleware([role_enum.ADMIN]), demoSeed);

export default dashboardRoutes;

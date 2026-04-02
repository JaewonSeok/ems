import { Router } from "express";
import { role_enum } from "@prisma/client";
import rateLimit from "express-rate-limit";
import {
  changePassword,
  googleCallback,
  googleLogin,
  login,
  logout,
  refresh,
  searchImpersonableUsers,
  startImpersonation,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";

// 로그인 엔드포인트 rate-limit: 5회/분 (PRD 3.3)
// 주의: 인스턴스 로컬 메모리 스토어 — Vercel 다중 인스턴스 환경에서는 인스턴스별 카운트 분리됨
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }
});

const authRoutes = Router();

authRoutes.post("/login", loginLimiter, login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", authMiddleware, logout);
authRoutes.put("/change-password", authMiddleware, changePassword);
authRoutes.get("/google", loginLimiter, googleLogin);
authRoutes.get("/google/callback", googleCallback);
authRoutes.get("/impersonable-users", authMiddleware, rbacMiddleware([role_enum.ADMIN]), searchImpersonableUsers);
authRoutes.post("/impersonate", authMiddleware, rbacMiddleware([role_enum.ADMIN]), startImpersonation);

export default authRoutes;

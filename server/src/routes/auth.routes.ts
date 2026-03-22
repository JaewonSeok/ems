import { Router } from "express";
import { role_enum } from "@prisma/client";
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

const authRoutes = Router();

authRoutes.post("/login", login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", authMiddleware, logout);
authRoutes.put("/change-password", authMiddleware, changePassword);
authRoutes.get("/google", googleLogin);
authRoutes.get("/google/callback", googleCallback);
authRoutes.get("/impersonable-users", authMiddleware, rbacMiddleware([role_enum.ADMIN]), searchImpersonableUsers);
authRoutes.post("/impersonate", authMiddleware, rbacMiddleware([role_enum.ADMIN]), startImpersonation);

export default authRoutes;

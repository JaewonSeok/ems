import { Router } from "express";
import { changePassword, googleCallback, googleLogin, login, logout, refresh } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";

const authRoutes = Router();

authRoutes.post("/login", login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", authMiddleware, logout);
authRoutes.put("/change-password", authMiddleware, changePassword);
authRoutes.get("/google", googleLogin);
authRoutes.get("/google/callback", googleCallback);

export default authRoutes;

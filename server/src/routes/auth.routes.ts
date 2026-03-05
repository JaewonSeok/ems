import { Router } from "express";
import { changePassword, login, logout, refresh } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";

const authRoutes = Router();

authRoutes.post("/login", login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", authMiddleware, logout);
authRoutes.put("/change-password", authMiddleware, changePassword);

export default authRoutes;

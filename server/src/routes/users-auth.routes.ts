import { Router } from "express";
import { role_enum } from "@prisma/client";
import { resetPassword } from "../controllers/users.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";

const usersAuthRoutes = Router();

usersAuthRoutes.use(authMiddleware, rbacMiddleware([role_enum.ADMIN]));
usersAuthRoutes.put("/:id/reset-password", resetPassword);

export default usersAuthRoutes;

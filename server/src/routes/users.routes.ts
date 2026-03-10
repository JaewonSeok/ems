import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  activateUser,
  bulkUploadUserRows,
  bulkUploadUsers,
  createUser,
  deactivateUser,
  downloadUserTemplate,
  listUsers,
  resetPassword,
  updateUser
} from "../controllers/users.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { userBulkUploadMiddleware } from "../middleware/users-upload";

const usersRoutes = Router();

usersRoutes.use(authMiddleware, rbacMiddleware([role_enum.ADMIN]));

usersRoutes.get("/", listUsers);
usersRoutes.post("/", createUser);
usersRoutes.get("/template", downloadUserTemplate);
usersRoutes.post("/bulk-upload", userBulkUploadMiddleware, bulkUploadUsers);
usersRoutes.post("/bulk-upload-rows", bulkUploadUserRows);
usersRoutes.put("/:id", updateUser);
usersRoutes.put("/:id/reset-password", resetPassword);
usersRoutes.put("/:id/deactivate", deactivateUser);
usersRoutes.put("/:id/activate", activateUser);

export default usersRoutes;

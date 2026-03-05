import { Router } from "express";
import { role_enum } from "@prisma/client";
import { bulkUploadByCategory, downloadBulkTemplate } from "../controllers/bulk-upload.controller";
import { authMiddleware } from "../middleware/auth";
import { bulkUploadFileMiddleware } from "../middleware/bulk-upload";
import { rbacMiddleware } from "../middleware/rbac";

const bulkUploadRoutes = Router();

bulkUploadRoutes.use(authMiddleware, rbacMiddleware([role_enum.ADMIN]));

bulkUploadRoutes.get("/template/:category", downloadBulkTemplate);
bulkUploadRoutes.post("/:category", bulkUploadFileMiddleware, bulkUploadByCategory);

export default bulkUploadRoutes;

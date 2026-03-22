import { Router } from "express";
import { role_enum } from "@prisma/client";
import { bulkUploadExternalEducations } from "../controllers/educations-bulk-upload.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";

const educationsBulkUploadRoutes = Router();

educationsBulkUploadRoutes.use(authMiddleware, rbacMiddleware([role_enum.ADMIN]));

educationsBulkUploadRoutes.post("/bulk-upload", bulkUploadExternalEducations);

export default educationsBulkUploadRoutes;

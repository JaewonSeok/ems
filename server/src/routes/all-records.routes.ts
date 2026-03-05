import { Router } from "express";
import { role_enum } from "@prisma/client";
import { exportAllRecords, listAllRecords } from "../controllers/all-records.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";

const allRecordsRoutes = Router();

allRecordsRoutes.use(authMiddleware, rbacMiddleware([role_enum.ADMIN]));
allRecordsRoutes.get("/", listAllRecords);
allRecordsRoutes.get("/export", exportAllRecords);

export default allRecordsRoutes;

import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  createInternalTraining,
  deleteInternalTraining,
  deleteInternalTrainingCertificate,
  downloadInternalTrainingCertificate,
  listInternalTrainingUserOptions,
  listInternalTrainings,
  updateInternalTraining,
  uploadInternalTrainingCertificate
} from "../controllers/internal-trainings.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { internalTrainingCertificateUpload } from "../middleware/upload";

const internalTrainingRoutes = Router();

internalTrainingRoutes.use(authMiddleware);

internalTrainingRoutes.get("/", listInternalTrainings);
internalTrainingRoutes.get("/users/options", rbacMiddleware([role_enum.ADMIN]), listInternalTrainingUserOptions);
internalTrainingRoutes.post("/", createInternalTraining);
internalTrainingRoutes.put("/:id", updateInternalTraining);
internalTrainingRoutes.delete("/:id", deleteInternalTraining);
internalTrainingRoutes.post("/:id/certificate", internalTrainingCertificateUpload, uploadInternalTrainingCertificate);
internalTrainingRoutes.get("/:id/certificate", downloadInternalTrainingCertificate);
internalTrainingRoutes.delete("/:id/certificate", deleteInternalTrainingCertificate);

export default internalTrainingRoutes;

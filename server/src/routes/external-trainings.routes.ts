import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  approveExternalTraining,
  createExternalTraining,
  deleteExternalTraining,
  deleteExternalTrainingCertificate,
  downloadExternalTrainingCertificate,
  listExternalTrainingUserOptions,
  listExternalTrainings,
  rejectExternalTraining,
  updateExternalTraining,
  uploadExternalTrainingCertificate
} from "../controllers/external-trainings.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { externalTrainingCertificateUpload } from "../middleware/upload";

const externalTrainingRoutes = Router();

externalTrainingRoutes.use(authMiddleware);

externalTrainingRoutes.get("/", listExternalTrainings);
externalTrainingRoutes.get("/users/options", rbacMiddleware([role_enum.ADMIN]), listExternalTrainingUserOptions);
externalTrainingRoutes.post("/", createExternalTraining);
externalTrainingRoutes.put("/:id", updateExternalTraining);
externalTrainingRoutes.delete("/:id", deleteExternalTraining);

externalTrainingRoutes.post("/:id/certificate", externalTrainingCertificateUpload, uploadExternalTrainingCertificate);
externalTrainingRoutes.get("/:id/certificate", downloadExternalTrainingCertificate);
externalTrainingRoutes.delete("/:id/certificate", deleteExternalTrainingCertificate);

externalTrainingRoutes.put("/:id/approve", rbacMiddleware([role_enum.ADMIN]), approveExternalTraining);
externalTrainingRoutes.put("/:id/reject", rbacMiddleware([role_enum.ADMIN]), rejectExternalTraining);

export default externalTrainingRoutes;

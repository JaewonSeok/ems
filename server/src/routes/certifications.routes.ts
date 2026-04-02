import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  createCertification,
  deleteCertification,
  deleteCertificationCertificate,
  downloadCertificationCertificate,
  listCertificationUserOptions,
  listCertifications,
  updateCertification,
  uploadCertificationCertificate
} from "../controllers/certifications.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { certificationCertificateUpload } from "../middleware/upload";

const certificationsRoutes = Router();

certificationsRoutes.use(authMiddleware);

certificationsRoutes.get("/", listCertifications);
certificationsRoutes.get("/users/options", rbacMiddleware([role_enum.ADMIN]), listCertificationUserOptions);
certificationsRoutes.post("/", createCertification);
certificationsRoutes.put("/:id", updateCertification);
certificationsRoutes.delete("/:id", deleteCertification);

certificationsRoutes.post("/:id/certificate", certificationCertificateUpload, uploadCertificationCertificate);
certificationsRoutes.get("/:id/certificate", downloadCertificationCertificate);
certificationsRoutes.delete("/:id/certificate", deleteCertificationCertificate);

export default certificationsRoutes;

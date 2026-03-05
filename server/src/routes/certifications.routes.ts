import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  createCertification,
  deleteCertification,
  listCertificationUserOptions,
  listCertifications,
  updateCertification
} from "../controllers/certifications.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";

const certificationsRoutes = Router();

certificationsRoutes.use(authMiddleware);

certificationsRoutes.get("/", listCertifications);
certificationsRoutes.get("/users/options", rbacMiddleware([role_enum.ADMIN]), listCertificationUserOptions);
certificationsRoutes.post("/", createCertification);
certificationsRoutes.put("/:id", updateCertification);
certificationsRoutes.delete("/:id", deleteCertification);

export default certificationsRoutes;

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
certificationsRoutes.post("/", rbacMiddleware([role_enum.ADMIN]), createCertification);
certificationsRoutes.put("/:id", rbacMiddleware([role_enum.ADMIN]), updateCertification);
certificationsRoutes.delete("/:id", rbacMiddleware([role_enum.ADMIN]), deleteCertification);

export default certificationsRoutes;

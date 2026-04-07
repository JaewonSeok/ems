import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  createInternalLecture,
  deleteInternalLecture,
  deleteInternalLectureCertificate,
  distributeToTrainings,
  downloadInternalLectureCertificate,
  listInternalLectureUserOptions,
  listInternalLectures,
  updateInternalLecture,
  uploadInternalLectureCertificate
} from "../controllers/internal-lectures.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";
import { internalLectureCertificateUpload } from "../middleware/upload";

const internalLectureRoutes = Router();

internalLectureRoutes.use(authMiddleware);

internalLectureRoutes.get("/", listInternalLectures);
internalLectureRoutes.get("/users/options", rbacMiddleware([role_enum.ADMIN]), listInternalLectureUserOptions);
internalLectureRoutes.post("/", createInternalLecture);
internalLectureRoutes.put("/:id", updateInternalLecture);
internalLectureRoutes.delete("/:id", deleteInternalLecture);

internalLectureRoutes.post("/:id/distribute", rbacMiddleware([role_enum.ADMIN]), distributeToTrainings);
internalLectureRoutes.post("/:id/certificate", internalLectureCertificateUpload, uploadInternalLectureCertificate);
internalLectureRoutes.get("/:id/certificate", downloadInternalLectureCertificate);
internalLectureRoutes.delete("/:id/certificate", deleteInternalLectureCertificate);

export default internalLectureRoutes;

import { Router } from "express";
import { role_enum } from "@prisma/client";
import {
  createInternalLecture,
  deleteInternalLecture,
  listInternalLectureUserOptions,
  listInternalLectures,
  updateInternalLecture
} from "../controllers/internal-lectures.controller";
import { authMiddleware } from "../middleware/auth";
import { rbacMiddleware } from "../middleware/rbac";

const internalLectureRoutes = Router();

internalLectureRoutes.use(authMiddleware);

internalLectureRoutes.get("/", listInternalLectures);
internalLectureRoutes.get("/users/options", rbacMiddleware([role_enum.ADMIN]), listInternalLectureUserOptions);
internalLectureRoutes.post("/", createInternalLecture);
internalLectureRoutes.put("/:id", updateInternalLecture);
internalLectureRoutes.delete("/:id", deleteInternalLecture);

export default internalLectureRoutes;

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import allRecordsRoutes from "./routes/all-records.routes";
import authRoutes from "./routes/auth.routes";
import bulkUploadRoutes from "./routes/bulk-upload.routes";
import certificationsRoutes from "./routes/certifications.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import externalTrainingRoutes from "./routes/external-trainings.routes";
import internalLectureRoutes from "./routes/internal-lectures.routes";
import internalTrainingRoutes from "./routes/internal-trainings.routes";
import statisticsRoutes from "./routes/statistics.routes";
import teamRecordsRoutes from "./routes/team-records.routes";
import usersRoutes from "./routes/users.routes";

dotenv.config();

const app = express();

// CORS 설정
// - 로컬 개발: CORS_ORIGIN=http://localhost:3001 (.env)
// - Vercel 배포: 프론트엔드와 API가 동일 도메인이므로 CORS 불필요 → 환경변수 미설정 시 비활성화
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );
}

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "ems-server" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/all-records", allRecordsRoutes);
app.use("/api/external-trainings", externalTrainingRoutes);
app.use("/api/internal-trainings", internalTrainingRoutes);
app.use("/api/internal-lectures", internalLectureRoutes);
app.use("/api/certifications", certificationsRoutes);
app.use("/api/bulk-upload", bulkUploadRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/team-records", teamRecordsRoutes);

export default app;
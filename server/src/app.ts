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
import usersRoutes from "./routes/users.routes";

dotenv.config();

const app = express();

const allowedOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    }
  })
);

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

export default app;

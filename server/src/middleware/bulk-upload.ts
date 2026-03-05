import multer from "multer";
import { NextFunction, Request, Response } from "express";
import path from "path";

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024);
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
]);
const allowedExtensions = new Set([".xlsx", ".xls"]);

const bulkUploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(extension)) {
      callback(new Error("Only .xlsx or .xls files are allowed."));
      return;
    }

    if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only .xlsx or .xls files are allowed."));
      return;
    }

    callback(null, true);
  }
});

export function bulkUploadFileMiddleware(req: Request, res: Response, next: NextFunction) {
  bulkUploadMulter.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: `File size must be <= ${maxFileSize} bytes` });
      return;
    }

    res.status(400).json({ message: error.message || "Invalid upload" });
  });
}

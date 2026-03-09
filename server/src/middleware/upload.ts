import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { readFile } from "fs/promises";

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024);
const uploadRootDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./uploads");
const externalTrainingDir = path.join(uploadRootDir, "external-trainings");
const internalTrainingDir = path.join(uploadRootDir, "internal-trainings");

try {
  fs.mkdirSync(externalTrainingDir, { recursive: true });
  fs.mkdirSync(internalTrainingDir, { recursive: true });
} catch {
  // Serverless 환경(읽기 전용 /var/task)에서는 UPLOAD_DIR을 /tmp/uploads로 설정
}

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function extensionByMime(mimeType: string) {
  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    default:
      return "";
  }
}

function createCertificateUploader(destinationDir: string) {
  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, destinationDir);
    },
    filename: (_req, file, callback) => {
      const extension = extensionByMime(file.mimetype);
      if (!extension) {
        callback(new Error("Unsupported file type"), "");
        return;
      }
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new Error("Only PDF, JPG, PNG files are allowed."));
        return;
      }

      callback(null, true);
    }
  });
}

function handleCertificateUpload(upload: multer.Multer, req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error) => {
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

const externalTrainingUpload = createCertificateUploader(externalTrainingDir);
const internalTrainingUpload = createCertificateUploader(internalTrainingDir);

export function externalTrainingCertificateUpload(req: Request, res: Response, next: NextFunction) {
  handleCertificateUpload(externalTrainingUpload, req, res, next);
}

export function internalTrainingCertificateUpload(req: Request, res: Response, next: NextFunction) {
  handleCertificateUpload(internalTrainingUpload, req, res, next);
}

export function getUploadRootDir() {
  return uploadRootDir;
}

export function toRelativeExternalTrainingPath(fileName: string) {
  return `external-trainings/${fileName}`;
}

export function toRelativeInternalTrainingPath(fileName: string) {
  return `internal-trainings/${fileName}`;
}

export function resolveStoredPath(storedPath: string) {
  const absolute = path.resolve(uploadRootDir, storedPath);

  if (!(absolute === uploadRootDir || absolute.startsWith(`${uploadRootDir}${path.sep}`))) {
    throw new Error("Invalid stored file path");
  }

  return absolute;
}

function isPdf(bytes: Buffer) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

function isJpeg(bytes: Buffer) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Buffer) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export async function validateStoredFileSignature(filePath: string, mimeType: string) {
  const bytes = await readFile(filePath);

  if (mimeType === "application/pdf") {
    return isPdf(bytes);
  }

  if (mimeType === "image/jpeg") {
    return isJpeg(bytes);
  }

  if (mimeType === "image/png") {
    return isPng(bytes);
  }

  return false;
}

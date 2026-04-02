import { NextFunction, Request, Response } from "express";
import multer from "multer";

// Vercel 서버리스 request body 한도(4.5MB)를 고려하여 기본값을 4MB로 설정
const maxFileSize = Number(process.env.MAX_FILE_SIZE || 4 * 1024 * 1024);
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function extensionByMime(mimeType: string) {
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

/** multer memoryStorage 기반 — buffer에서 파일 시그니처 검증 */
export function validateFileBuffer(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return isPdf(buffer);
  if (mimeType === "image/jpeg") return isJpeg(buffer);
  if (mimeType === "image/png") return isPng(buffer);
  return false;
}

function createCertificateUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize },
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

const certificateUploader = createCertificateUploader();

export function externalTrainingCertificateUpload(req: Request, res: Response, next: NextFunction) {
  handleCertificateUpload(certificateUploader, req, res, next);
}

export function internalTrainingCertificateUpload(req: Request, res: Response, next: NextFunction) {
  handleCertificateUpload(certificateUploader, req, res, next);
}

export function internalLectureCertificateUpload(req: Request, res: Response, next: NextFunction) {
  handleCertificateUpload(certificateUploader, req, res, next);
}

export function certificationCertificateUpload(req: Request, res: Response, next: NextFunction) {
  handleCertificateUpload(certificateUploader, req, res, next);
}

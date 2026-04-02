import { randomUUID } from "crypto";
import { Prisma, role_enum } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/prisma";
import { getSupabase, CERTIFICATES_BUCKET } from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth";
import { extensionByMime, validateFileBuffer } from "../middleware/upload";

class ValidationError extends Error {}

function toDateString(value: Date | null) {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function parseBoundedString(value: unknown, fieldName: string, maxLength: number) {
  const parsed = String(value || "").trim();

  if (!parsed) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (parsed.length > maxLength) {
    throw new ValidationError(`${fieldName} must be <= ${maxLength} characters`);
  }

  return parsed;
}

function parseStrictDate(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ValidationError(`${fieldName} must be in YYYY-MM-DD format`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new ValidationError(`${fieldName} is invalid date`);
  }

  return parsed;
}

function parseCredits(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = String(value).trim();

  if (!/^\d+(\.\d)?$/.test(parsed)) {
    throw new ValidationError("credits must be a non-negative number with up to 1 decimal place");
  }

  const numeric = Number(parsed);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 999.9) {
    throw new ValidationError("credits must be between 0 and 999.9");
  }

  return numeric;
}

function assertAuthUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error("Unauthorized");
  }

  return req.user;
}

function mapRecord(
  record: Prisma.certificationsGetPayload<{
    include: {
      user: { select: { id: true; name: true; employee_id: true; department: true; team: true } };
    };
  }>
) {
  return {
    id: record.id,
    user_id: record.user_id,
    employee_name: record.user.name,
    employee_id: record.user.employee_id,
    department: record.user.department,
    team: record.user.team,
    cert_name: record.cert_name,
    grade: record.grade,
    acquired_date: toDateString(record.acquired_date),
    credits: toNumber(record.credits),
    certificate_file: record.certificate_file ?? null,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString()
  };
}

async function findCertificationById(id: string) {
  return prisma.certifications.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          employee_id: true,
          department: true,
          team: true
        }
      }
    }
  });
}

function assertRecordAccess(req: AuthenticatedRequest, record: { user_id: string }) {
  const user = assertAuthUser(req);

  if (user.role === role_enum.ADMIN) {
    return;
  }

  if (record.user_id !== user.id) {
    throw new Error("Forbidden");
  }
}

export async function listCertifications(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || "").trim();

    const where: Prisma.certificationsWhereInput = {};

    if (user.role === role_enum.USER) {
      where.user_id = user.id;
    }

    if (search) {
      where.OR = [
        {
          cert_name: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          user: {
            name: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      ];
    }

    const [total, items] = await Promise.all([
      prisma.certifications.count({ where }),
      prisma.certifications.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employee_id: true,
              department: true,
              team: true
            }
          }
        },
        orderBy: {
          created_at: "desc"
        },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return res.status(200).json({
      items: items.map(mapRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.error("listCertifications error:", error);
    return res.status(500).json({ message: "Failed to list certifications" });
  }
}

export async function listCertificationUserOptions(_req: AuthenticatedRequest, res: Response) {
  try {
    const users = await prisma.users.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        employee_id: true
      },
      orderBy: [{ name: "asc" }, { employee_id: "asc" }]
    });

    return res.status(200).json({ items: users });
  } catch (error) {
    console.error("listCertificationUserOptions error:", error);
    return res.status(500).json({ message: "Failed to load user options" });
  }
}

export async function createCertification(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const body = req.body as Record<string, unknown>;

    const cert_name = parseBoundedString(body.cert_name, "cert_name", 255);
    const grade = parseBoundedString(body.grade, "grade", 100);
    const acquired_date = parseStrictDate(body.acquired_date, "acquired_date");
    const credits = user.role === role_enum.ADMIN ? parseCredits(body.credits) : null;

    let targetUserId = user.id;

    if (user.role === role_enum.ADMIN) {
      const requestedUserId = String(body.user_id || "").trim();

      if (!requestedUserId) {
        return res.status(400).json({ message: "user_id is required for ADMIN create" });
      }

      const exists = await prisma.users.findUnique({ where: { id: requestedUserId }, select: { id: true } });

      if (!exists) {
        return res.status(400).json({ message: "user_id is invalid" });
      }

      targetUserId = requestedUserId;
    }

    const created = await prisma.certifications.create({
      data: {
        user_id: targetUserId,
        cert_name,
        grade,
        acquired_date,
        credits: credits === null ? null : new Prisma.Decimal(credits)
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true,
            department: true,
            team: true
          }
        }
      }
    });

    return res.status(201).json(mapRecord(created));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("createCertification error:", error);
    return res.status(500).json({ message: "Failed to create certification" });
  }
}

export async function updateCertification(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const authUser = assertAuthUser(req);

    const existing = await findCertificationById(id);

    if (!existing) {
      return res.status(404).json({ message: "Certification not found" });
    }

    assertRecordAccess(req, existing);

    const updateData: Prisma.certificationsUpdateInput = {};

    if (body.cert_name !== undefined) {
      updateData.cert_name = parseBoundedString(body.cert_name, "cert_name", 255);
    }

    if (body.grade !== undefined) {
      updateData.grade = parseBoundedString(body.grade, "grade", 100);
    }

    if (body.acquired_date !== undefined) {
      updateData.acquired_date = parseStrictDate(body.acquired_date, "acquired_date");
    }

    if (body.credits !== undefined && authUser.role === role_enum.ADMIN) {
      const credits = parseCredits(body.credits);
      updateData.credits = credits === null ? null : new Prisma.Decimal(credits);
    }

    if (body.user_id !== undefined) {
      if (authUser.role !== role_enum.ADMIN) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const requestedUserId = String(body.user_id || "").trim();

      if (!requestedUserId) {
        return res.status(400).json({ message: "user_id cannot be empty" });
      }

      const exists = await prisma.users.findUnique({ where: { id: requestedUserId }, select: { id: true } });

      if (!exists) {
        return res.status(400).json({ message: "user_id is invalid" });
      }

      updateData.user = { connect: { id: requestedUserId } };
    }

    const updated = await prisma.certifications.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true,
            department: true,
            team: true
          }
        }
      }
    });

    return res.status(200).json(mapRecord(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("updateCertification error:", error);
    return res.status(500).json({ message: "Failed to update certification" });
  }
}

export async function deleteCertification(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const existing = await findCertificationById(id);

    if (!existing) {
      return res.status(404).json({ message: "Certification not found" });
    }

    assertRecordAccess(req, existing);

    if (existing.certificate_file) {
      await getSupabase().storage.from(CERTIFICATES_BUCKET).remove([existing.certificate_file]).catch(() => undefined);
    }

    await prisma.certifications.delete({ where: { id } });

    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    console.error("deleteCertification error:", error);
    return res.status(500).json({ message: "Failed to delete certification" });
  }
}

export async function uploadCertificationCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file?.buffer) {
      return res.status(400).json({ message: "file is required" });
    }

    const existing = await findCertificationById(id);

    if (!existing) {
      return res.status(404).json({ message: "Certification not found" });
    }

    assertRecordAccess(req, existing);

    if (!validateFileBuffer(file.buffer, file.mimetype)) {
      return res.status(400).json({ message: "Uploaded file signature is invalid for its type" });
    }

    if (existing.certificate_file) {
      await getSupabase().storage.from(CERTIFICATES_BUCKET).remove([existing.certificate_file]).catch(() => undefined);
    }

    const ext = extensionByMime(file.mimetype);
    const storagePath = `certifications/${Date.now()}-${randomUUID()}${ext}`;
    const { error: uploadError } = await getSupabase().storage
      .from(CERTIFICATES_BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return res.status(500).json({ message: `첨부파일 업로드 실패: ${uploadError.message}` });
    }

    const updated = await prisma.certifications.update({
      where: { id },
      data: { certificate_file: storagePath },
      include: {
        user: { select: { id: true, name: true, employee_id: true, department: true, team: true } }
      }
    });

    return res.status(200).json(mapRecord(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    console.error("uploadCertificationCertificate error:", error);
    return res.status(500).json({ message: "Failed to upload certificate" });
  }
}

export async function deleteCertificationCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findCertificationById(id);

    if (!existing) {
      return res.status(404).json({ message: "Certification not found" });
    }

    assertRecordAccess(req, existing);

    if (!existing.certificate_file) {
      return res.status(404).json({ message: "No certificate uploaded" });
    }

    await getSupabase().storage.from(CERTIFICATES_BUCKET).remove([existing.certificate_file]).catch(() => undefined);

    const updated = await prisma.certifications.update({
      where: { id },
      data: { certificate_file: null },
      include: {
        user: { select: { id: true, name: true, employee_id: true, department: true, team: true } }
      }
    });

    return res.status(200).json(mapRecord(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    console.error("deleteCertificationCertificate error:", error);
    return res.status(500).json({ message: "Failed to delete certificate" });
  }
}

export async function downloadCertificationCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findCertificationById(id);

    if (!existing) {
      return res.status(404).json({ message: "Certification not found" });
    }

    assertRecordAccess(req, existing);

    if (!existing.certificate_file) {
      return res.status(404).json({ message: "No certificate uploaded" });
    }

    const { data, error } = await getSupabase().storage.from(CERTIFICATES_BUCKET).download(existing.certificate_file);

    if (error || !data) {
      console.error("Supabase Storage download error:", error);
      return res.status(404).json({ message: "Certificate file not found" });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const fileName = existing.certificate_file.split("/").pop() ?? "certificate";
    const contentType = data.type || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    console.error("downloadCertificationCertificate error:", error);
    return res.status(500).json({ message: "Failed to download certificate" });
  }
}

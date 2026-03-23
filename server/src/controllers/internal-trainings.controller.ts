import fs from "fs/promises";
import path from "path";
import { Prisma, certificate_status_enum, role_enum, training_type_enum } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { resolveStoredPath, toRelativeInternalTrainingPath, validateStoredFileSignature } from "../middleware/upload";

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

function parsePositiveNumber(value: unknown, fieldName: string, allowZero = true) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${fieldName} must be a number`);
  }

  if (allowZero ? parsed < 0 : parsed <= 0) {
    throw new ValidationError(`${fieldName} must be ${allowZero ? "0 or greater" : "greater than 0"}`);
  }

  return parsed;
}

function parseDate(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${fieldName} is invalid date`);
  }

  return parsed;
}

function assertTrainingType(value: unknown) {
  if (value !== "OFFLINE" && value !== "ONLINE") {
    throw new ValidationError("type must be OFFLINE or ONLINE");
  }

  return value as training_type_enum;
}

function assertAuthUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error("Unauthorized");
  }

  return req.user;
}

function mapRecord(
  record: Prisma.internal_trainingsGetPayload<{
    include: {
      user: { select: { id: true; name: true; employee_id: true } };
    };
  }>
) {
  return {
    id: record.id,
    user_id: record.user_id,
    employee_name: record.user.name,
    employee_id: record.user.employee_id,
    training_name: record.training_name,
    type: record.type,
    start_date: toDateString(record.start_date),
    end_date: toDateString(record.end_date),
    hours: Number(record.hours),
    institution: record.institution,
    certificate_status: record.certificate_status,
    certificate_file: record.certificate_file,
    credits: toNumber(record.credits),
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString()
  };
}

async function findInternalTrainingById(id: string) {
  return prisma.internal_trainings.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          employee_id: true
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

export async function listInternalTrainings(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || "").trim();

    const where: Prisma.internal_trainingsWhereInput = {};

    if (user.role === role_enum.USER) {
      where.user_id = user.id;
    }

    if (search) {
      where.OR = [
        {
          training_name: {
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
      prisma.internal_trainings.count({ where }),
      prisma.internal_trainings.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employee_id: true
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

    console.error("listInternalTrainings error:", error);
    return res.status(500).json({ message: "Failed to list internal trainings" });
  }
}

export async function listInternalTrainingUserOptions(_req: AuthenticatedRequest, res: Response) {
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
    console.error("listInternalTrainingUserOptions error:", error);
    return res.status(500).json({ message: "Failed to load user options" });
  }
}

export async function createInternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const body = req.body as Record<string, unknown>;

    const training_name = parseBoundedString(body.training_name, "training_name", 255);
    const institution = parseBoundedString(body.institution, "institution", 255);
    const type = assertTrainingType(body.type);
    const start_date = parseDate(body.start_date, "start_date");
    const end_date = parseDate(body.end_date, "end_date");

    if (end_date < start_date) {
      return res.status(400).json({ message: "end_date must be greater than or equal to start_date" });
    }

    const hours = parsePositiveNumber(body.hours, "hours", true);
    const credits = body.credits === null || body.credits === undefined || body.credits === "" ? null : Number(body.credits);

    if (credits !== null && (!Number.isFinite(credits) || credits < 0)) {
      return res.status(400).json({ message: "credits must be >= 0" });
    }

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

    const created = await prisma.internal_trainings.create({
      data: {
        user_id: targetUserId,
        training_name,
        type,
        start_date,
        end_date,
        hours: new Prisma.Decimal(hours),
        institution,
        certificate_status: "NOT_SUBMITTED",
        certificate_file: null,
        credits: credits === null ? null : new Prisma.Decimal(credits)
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
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

    console.error("createInternalTraining error:", error);
    return res.status(500).json({ message: "Failed to create internal training" });
  }
}

export async function updateInternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const authUser = assertAuthUser(req);

    const existing = await findInternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal training not found" });
    }

    assertRecordAccess(req, existing);

    const updateData: Prisma.internal_trainingsUpdateInput = {};

    if (body.training_name !== undefined) {
      updateData.training_name = parseBoundedString(body.training_name, "training_name", 255);
    }

    if (body.type !== undefined) {
      updateData.type = assertTrainingType(body.type);
    }

    if (body.institution !== undefined) {
      updateData.institution = parseBoundedString(body.institution, "institution", 255);
    }

    if (body.start_date !== undefined) {
      updateData.start_date = parseDate(body.start_date, "start_date");
    }

    if (body.end_date !== undefined) {
      updateData.end_date = parseDate(body.end_date, "end_date");
    }

    const nextStart = (updateData.start_date as Date | undefined) ?? existing.start_date;
    const nextEnd = (updateData.end_date as Date | undefined) ?? existing.end_date;

    if (nextEnd < nextStart) {
      return res.status(400).json({ message: "end_date must be greater than or equal to start_date" });
    }

    if (body.hours !== undefined) {
      const hours = parsePositiveNumber(body.hours, "hours", true);
      updateData.hours = new Prisma.Decimal(hours);
    }

    if (body.credits !== undefined) {
      if (body.credits === null || body.credits === "") {
        updateData.credits = null;
      } else {
        const credits = Number(body.credits);
        if (!Number.isFinite(credits) || credits < 0) {
          return res.status(400).json({ message: "credits must be >= 0" });
        }
        updateData.credits = new Prisma.Decimal(credits);
      }
    }

    if (body.certificate_status !== undefined && authUser.role === role_enum.ADMIN) {
      const validCert = ["SUBMITTED", "NOT_SUBMITTED"];
      if (!validCert.includes(String(body.certificate_status))) {
        return res.status(400).json({ message: "certificate_status must be SUBMITTED or NOT_SUBMITTED" });
      }
      updateData.certificate_status = body.certificate_status as certificate_status_enum;
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

    const updated = await prisma.internal_trainings.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
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

    console.error("updateInternalTraining error:", error);
    return res.status(500).json({ message: "Failed to update internal training" });
  }
}

export async function deleteInternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const existing = await findInternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal training not found" });
    }

    assertRecordAccess(req, existing);

    await prisma.internal_trainings.delete({ where: { id } });

    if (existing.certificate_file) {
      try {
        const abs = resolveStoredPath(existing.certificate_file);
        await fs.unlink(abs);
      } catch {
        // ignore cleanup failure
      }
    }

    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    console.error("deleteInternalTraining error:", error);
    return res.status(500).json({ message: "Failed to delete internal training" });
  }
}

export async function uploadInternalTrainingCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "file is required" });
    }

    const existing = await findInternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal training not found" });
    }

    assertRecordAccess(req, existing);

    const signatureOk = await validateStoredFileSignature(file.path, file.mimetype);

    if (!signatureOk) {
      await fs.unlink(file.path).catch(() => undefined);
      return res.status(400).json({ message: "Uploaded file signature is invalid for its type" });
    }

    const relativePath = toRelativeInternalTrainingPath(file.filename);

    if (existing.certificate_file) {
      try {
        const previous = resolveStoredPath(existing.certificate_file);
        await fs.unlink(previous);
      } catch {
        // ignore previous file cleanup failure
      }
    }

    const updated = await prisma.internal_trainings.update({
      where: { id },
      data: {
        certificate_file: relativePath,
        certificate_status: "SUBMITTED"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
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

    console.error("uploadInternalTrainingCertificate error:", error);
    return res.status(500).json({ message: "Failed to upload certificate" });
  }
}

export async function deleteInternalTrainingCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findInternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal training not found" });
    }

    assertRecordAccess(req, existing);

    if (!existing.certificate_file) {
      return res.status(404).json({ message: "No certificate uploaded" });
    }

    try {
      const absPath = resolveStoredPath(existing.certificate_file);
      await fs.unlink(absPath);
    } catch {
      // ignore file cleanup failure
    }

    const updated = await prisma.internal_trainings.update({
      where: { id },
      data: { certificate_file: null, certificate_status: "NOT_SUBMITTED" },
      include: { user: { select: { id: true, name: true, employee_id: true } } }
    });

    return res.status(200).json(mapRecord(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    console.error("deleteInternalTrainingCertificate error:", error);
    return res.status(500).json({ message: "Failed to delete certificate" });
  }
}

export async function downloadInternalTrainingCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findInternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal training not found" });
    }

    assertRecordAccess(req, existing);

    if (!existing.certificate_file) {
      return res.status(404).json({ message: "No certificate uploaded" });
    }

    const absPath = resolveStoredPath(existing.certificate_file);
    await fs.access(absPath);

    return res.download(absPath, path.basename(absPath));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    console.error("downloadInternalTrainingCertificate error:", error);
    return res.status(404).json({ message: "Certificate file not found" });
  }
}

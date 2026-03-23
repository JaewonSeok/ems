import { randomUUID } from "crypto";
import { Prisma, approval_status_enum, certificate_status_enum, role_enum, training_type_enum } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/prisma";
import { supabase, CERTIFICATES_BUCKET } from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth";
import { extensionByMime, validateFileBuffer } from "../middleware/upload";

class ValidationError extends Error {}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function toDateString(value: Date | null) {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
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

function assertTrainingType(value: unknown) {
  if (value !== "OFFLINE" && value !== "ONLINE") {
    throw new ValidationError("type must be OFFLINE or ONLINE");
  }

  return value as training_type_enum;
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

function isAdmin(req: AuthenticatedRequest) {
  return req.user?.role === role_enum.ADMIN;
}

function assertAuthUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error("Unauthorized");
  }

  return req.user;
}

function mapRecord(
  record: Prisma.external_trainingsGetPayload<{
    include: {
      user: { select: { id: true; name: true; employee_id: true } };
      approver: { select: { id: true; name: true } };
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
    cost: record.cost,
    institution: record.institution,
    certificate_status: record.certificate_status,
    certificate_file: record.certificate_file,
    approval_status: record.approval_status,
    approval_comment: record.approval_comment,
    approved_by: record.approved_by,
    approved_at: record.approved_at?.toISOString() ?? null,
    approver_name: record.approver?.name ?? null,
    credits: toNumber(record.credits),
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString()
  };
}

async function findExternalTrainingById(id: string) {
  return prisma.external_trainings.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          employee_id: true
        }
      },
      approver: {
        select: {
          id: true,
          name: true
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

export async function listExternalTrainings(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || "").trim();

    const where: Prisma.external_trainingsWhereInput = {};

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
      prisma.external_trainings.count({ where }),
      prisma.external_trainings.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employee_id: true
            }
          },
          approver: {
            select: {
              id: true,
              name: true
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

    console.error("listExternalTrainings error:", error);
    return res.status(500).json({ message: "Failed to list external trainings" });
  }
}

export async function listExternalTrainingUserOptions(_req: AuthenticatedRequest, res: Response) {
  try {
    const users = await prisma.users.findMany({
      where: {
        is_active: true
      },
      select: {
        id: true,
        name: true,
        employee_id: true
      },
      orderBy: [{ name: "asc" }, { employee_id: "asc" }]
    });

    return res.status(200).json({ items: users });
  } catch (error) {
    console.error("listExternalTrainingUserOptions error:", error);
    return res.status(500).json({ message: "Failed to load user options" });
  }
}

export async function createExternalTraining(req: AuthenticatedRequest, res: Response) {
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
    const cost = body.cost === null || body.cost === undefined || body.cost === "" ? null : Number(body.cost);
    const credits = body.credits === null || body.credits === undefined || body.credits === "" ? null : Number(body.credits);

    if (cost !== null && (!Number.isInteger(cost) || cost < 0)) {
      return res.status(400).json({ message: "cost must be an integer >= 0" });
    }

    if (credits !== null && (!Number.isFinite(credits) || credits < 0)) {
      return res.status(400).json({ message: "credits must be >= 0" });
    }

    let targetUserId = user.id;

    if (isAdmin(req)) {
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

    const created = await prisma.external_trainings.create({
      data: {
        user_id: targetUserId,
        training_name,
        type,
        start_date,
        end_date,
        hours: new Prisma.Decimal(hours),
        cost,
        institution,
        certificate_status: "NOT_SUBMITTED",
        certificate_file: null,
        approval_status: "PENDING",
        approval_comment: null,
        approved_by: null,
        approved_at: null,
        credits: credits === null ? null : new Prisma.Decimal(credits)
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true
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

    console.error("createExternalTraining error:", error);
    return res.status(500).json({ message: "Failed to create external training" });
  }
}

export async function updateExternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    assertRecordAccess(req, existing);

    const updateData: Prisma.external_trainingsUpdateInput = {};
    const authUser = assertAuthUser(req);

    if (body.training_name !== undefined) {
      updateData.training_name = parseBoundedString(body.training_name, "training_name", 255);
    }

    if (body.type !== undefined) {
      updateData.type = assertTrainingType(body.type);
    }

    if (body.institution !== undefined) {
      updateData.institution = parseBoundedString(body.institution, "institution", 255);
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

    if (body.cost !== undefined) {
      if (body.cost === null || body.cost === "") {
        updateData.cost = null;
      } else {
        const cost = Number(body.cost);
        if (!Number.isInteger(cost) || cost < 0) {
          return res.status(400).json({ message: "cost must be an integer >= 0" });
        }
        updateData.cost = cost;
      }
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

    if (body.approval_status !== undefined && authUser.role === role_enum.ADMIN) {
      const validApproval = ["PENDING", "APPROVED", "REJECTED"];
      if (!validApproval.includes(String(body.approval_status))) {
        return res.status(400).json({ message: "approval_status must be PENDING, APPROVED, or REJECTED" });
      }
      updateData.approval_status = body.approval_status as approval_status_enum;
      if (body.approval_status !== "PENDING") {
        updateData.approver = { connect: { id: authUser.id } };
        updateData.approved_at = new Date();
      } else {
        updateData.approver = { disconnect: true };
        updateData.approved_at = null;
        updateData.approval_comment = null;
      }
    }

    if (body.certificate_status !== undefined && authUser.role === role_enum.ADMIN) {
      const validCert = ["SUBMITTED", "NOT_SUBMITTED"];
      if (!validCert.includes(String(body.certificate_status))) {
        return res.status(400).json({ message: "certificate_status must be SUBMITTED or NOT_SUBMITTED" });
      }
      updateData.certificate_status = body.certificate_status as certificate_status_enum;
    }

    const updated = await prisma.external_trainings.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true
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

    console.error("updateExternalTraining error:", error);
    return res.status(500).json({ message: "Failed to update external training" });
  }
}

export async function deleteExternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    assertRecordAccess(req, existing);

    await prisma.external_trainings.delete({ where: { id } });

    if (existing.certificate_file) {
      await supabase.storage.from(CERTIFICATES_BUCKET).remove([existing.certificate_file]).catch(() => undefined);
    }

    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    console.error("deleteExternalTraining error:", error);
    return res.status(500).json({ message: "Failed to delete external training" });
  }
}

export async function uploadExternalTrainingCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file?.buffer) {
      return res.status(400).json({ message: "file is required" });
    }

    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    assertRecordAccess(req, existing);

    if (!validateFileBuffer(file.buffer, file.mimetype)) {
      return res.status(400).json({ message: "Uploaded file signature is invalid for its type" });
    }

    // 이전 파일 삭제
    if (existing.certificate_file) {
      await supabase.storage.from(CERTIFICATES_BUCKET).remove([existing.certificate_file]).catch(() => undefined);
    }

    // Supabase Storage에 업로드
    const ext = extensionByMime(file.mimetype);
    const storagePath = `external-trainings/${Date.now()}-${randomUUID()}${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(CERTIFICATES_BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return res.status(500).json({ message: "Failed to upload certificate to storage" });
    }

    const updated = await prisma.external_trainings.update({
      where: { id },
      data: {
        certificate_file: storagePath,
        certificate_status: "SUBMITTED",
        approval_status: "PENDING",
        approval_comment: null,
        approved_by: null,
        approved_at: null
      },
      include: {
        user: { select: { id: true, name: true, employee_id: true } },
        approver: { select: { id: true, name: true } }
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
    console.error("uploadExternalTrainingCertificate error:", error);
    return res.status(500).json({ message: "Failed to upload certificate" });
  }
}

export async function deleteExternalTrainingCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    assertRecordAccess(req, existing);

    if (!existing.certificate_file) {
      return res.status(404).json({ message: "No certificate uploaded" });
    }

    // Supabase Storage에서 파일 삭제 (실패해도 DB 업데이트는 진행)
    await supabase.storage.from(CERTIFICATES_BUCKET).remove([existing.certificate_file]).catch(() => undefined);

    const updated = await prisma.external_trainings.update({
      where: { id },
      data: {
        certificate_file: null,
        certificate_status: "NOT_SUBMITTED",
        approval_status: "PENDING",
        approval_comment: null,
        approved_by: null,
        approved_at: null
      },
      include: {
        user: { select: { id: true, name: true, employee_id: true } },
        approver: { select: { id: true, name: true } }
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
    console.error("deleteExternalTrainingCertificate error:", error);
    return res.status(500).json({ message: "Failed to delete certificate" });
  }
}

export async function downloadExternalTrainingCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    assertRecordAccess(req, existing);

    if (!existing.certificate_file) {
      return res.status(404).json({ message: "No certificate uploaded" });
    }

    // Supabase Storage에서 파일 다운로드
    const { data, error } = await supabase.storage.from(CERTIFICATES_BUCKET).download(existing.certificate_file);

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
    console.error("downloadExternalTrainingCertificate error:", error);
    return res.status(404).json({ message: "Certificate file not found" });
  }
}

export async function approveExternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const { id } = req.params;

    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    if (existing.certificate_status !== "SUBMITTED") {
      return res.status(400).json({ message: "Certificate must be submitted before approval" });
    }

    if (existing.approval_status !== "PENDING") {
      return res.status(400).json({ message: "Only PENDING records can be approved" });
    }

    const updated = await prisma.external_trainings.update({
      where: { id },
      data: {
        approval_status: "APPROVED",
        approval_comment: null,
        approved_by: user.id,
        approved_at: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(200).json(mapRecord(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.error("approveExternalTraining error:", error);
    return res.status(500).json({ message: "Failed to approve external training" });
  }
}

export async function rejectExternalTraining(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const { id } = req.params;
    const comment = String((req.body as { comment?: string }).comment || "").trim();

    if (!comment) {
      return res.status(400).json({ message: "comment is required for rejection" });
    }

    if (comment.length > 1000) {
      return res.status(400).json({ message: "comment must be <= 1000 characters" });
    }

    const existing = await findExternalTrainingById(id);

    if (!existing) {
      return res.status(404).json({ message: "External training not found" });
    }

    if (existing.certificate_status !== "SUBMITTED") {
      return res.status(400).json({ message: "Certificate must be submitted before rejection" });
    }

    if (existing.approval_status !== "PENDING") {
      return res.status(400).json({ message: "Only PENDING records can be rejected" });
    }

    const updated = await prisma.external_trainings.update({
      where: { id },
      data: {
        approval_status: "REJECTED",
        approval_comment: comment,
        approved_by: user.id,
        approved_at: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employee_id: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(200).json(mapRecord(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.error("rejectExternalTraining error:", error);
    return res.status(500).json({ message: "Failed to reject external training" });
  }
}

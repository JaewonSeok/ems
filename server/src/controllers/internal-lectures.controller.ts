import { Prisma, role_enum, training_type_enum } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

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
  record: Prisma.internal_lecturesGetPayload<{
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
    lecture_name: record.lecture_name,
    type: record.type,
    start_date: toDateString(record.start_date),
    end_date: toDateString(record.end_date),
    hours: Number(record.hours),
    department_instructor: record.department_instructor,
    credits: toNumber(record.credits),
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString()
  };
}

async function findInternalLectureById(id: string) {
  return prisma.internal_lectures.findUnique({
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

export async function listInternalLectures(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || "").trim();

    const where: Prisma.internal_lecturesWhereInput = {};

    if (user.role === role_enum.USER) {
      where.user_id = user.id;
    }

    if (search) {
      where.OR = [
        {
          lecture_name: {
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
      prisma.internal_lectures.count({ where }),
      prisma.internal_lectures.findMany({
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

    console.error("listInternalLectures error:", error);
    return res.status(500).json({ message: "Failed to list internal lectures" });
  }
}

export async function listInternalLectureUserOptions(_req: AuthenticatedRequest, res: Response) {
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
    console.error("listInternalLectureUserOptions error:", error);
    return res.status(500).json({ message: "Failed to load user options" });
  }
}

export async function createInternalLecture(req: AuthenticatedRequest, res: Response) {
  try {
    const user = assertAuthUser(req);
    const body = req.body as Record<string, unknown>;

    const lecture_name = parseBoundedString(body.lecture_name, "lecture_name", 255);
    const department_instructor = parseBoundedString(body.department_instructor, "department_instructor", 255);
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

    const created = await prisma.internal_lectures.create({
      data: {
        user_id: targetUserId,
        lecture_name,
        type,
        start_date,
        end_date,
        hours: new Prisma.Decimal(hours),
        department_instructor,
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

    console.error("createInternalLecture error:", error);
    return res.status(500).json({ message: "Failed to create internal lecture" });
  }
}

export async function updateInternalLecture(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const authUser = assertAuthUser(req);

    const existing = await findInternalLectureById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal lecture not found" });
    }

    assertRecordAccess(req, existing);

    const updateData: Prisma.internal_lecturesUpdateInput = {};

    if (body.lecture_name !== undefined) {
      updateData.lecture_name = parseBoundedString(body.lecture_name, "lecture_name", 255);
    }

    if (body.type !== undefined) {
      updateData.type = assertTrainingType(body.type);
    }

    if (body.department_instructor !== undefined) {
      updateData.department_instructor = parseBoundedString(body.department_instructor, "department_instructor", 255);
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

    const updated = await prisma.internal_lectures.update({
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

    console.error("updateInternalLecture error:", error);
    return res.status(500).json({ message: "Failed to update internal lecture" });
  }
}

export async function deleteInternalLecture(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const existing = await findInternalLectureById(id);

    if (!existing) {
      return res.status(404).json({ message: "Internal lecture not found" });
    }

    assertRecordAccess(req, existing);
    await prisma.internal_lectures.delete({ where: { id } });

    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    console.error("deleteInternalLecture error:", error);
    return res.status(500).json({ message: "Failed to delete internal lecture" });
  }
}

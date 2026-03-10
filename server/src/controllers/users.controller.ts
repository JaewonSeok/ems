import { Prisma, position_title_enum, role_enum } from "@prisma/client";
import { Response } from "express";
import XLSX from "xlsx";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { hashPassword } from "../utils/password";

class ValidationError extends Error {}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseRequiredString(value: unknown, fieldName: string, maxLength: number) {
  const parsed = String(value || "").trim();

  if (!parsed) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (parsed.length > maxLength) {
    throw new ValidationError(`${fieldName} must be <= ${maxLength} characters`);
  }

  return parsed;
}

function parseRole(value: unknown) {
  if (value !== role_enum.ADMIN && value !== role_enum.USER) {
    throw new ValidationError("role must be ADMIN or USER");
  }

  return value;
}

const VALID_POSITION_TITLES = [
  position_title_enum.팀장,
  position_title_enum.실장,
  position_title_enum.부문장,
  position_title_enum.본부장
] as const;

function parsePositionTitle(value: unknown): position_title_enum | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (!VALID_POSITION_TITLES.includes(normalized as position_title_enum)) {
    throw new ValidationError("유효하지 않은 직책입니다. (팀장/실장/부문장/본부장 중 선택)");
  }
  return normalized as position_title_enum;
}

function mapUser(record: {
  id: string;
  email: string;
  employee_id: string;
  name: string;
  department: string;
  team: string;
  role: role_enum;
  position_title: position_title_enum | null;
  is_first_login: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: record.id,
    email: record.email,
    employee_id: record.employee_id,
    name: record.name,
    department: record.department,
    team: record.team,
    role: record.role,
    position_title: record.position_title ?? null,
    is_first_login: record.is_first_login,
    is_active: record.is_active,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString()
  };
}

function uniqueConstraintMessage(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code !== "P2002") {
    return null;
  }

  const target = Array.isArray(error.meta?.target) ? error.meta?.target.map(String) : [];

  if (target.includes("email")) {
    return "email already exists";
  }

  if (target.includes("employee_id")) {
    return "employee_id already exists";
  }

  return "Unique constraint violation";
}

async function wouldRemoveLastActiveAdmin(target: { id: string; role: role_enum; is_active: boolean }) {
  if (target.role !== role_enum.ADMIN || !target.is_active) {
    return false;
  }

  const activeAdminCount = await prisma.users.count({
    where: {
      role: role_enum.ADMIN,
      is_active: true
    }
  });

  return activeAdminCount <= 1;
}

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const search = String(req.query.search || "").trim();
    const roleQuery = String(req.query.role || "all").trim();
    const statusQuery = String(req.query.status || "all").trim();

    const where: Prisma.usersWhereInput = {};

    if (search) {
      const searchFilter: Prisma.StringFilter = {
        contains: search,
        mode: "insensitive"
      };

      where.OR = [
        { name: searchFilter },
        { email: searchFilter },
        { employee_id: searchFilter },
        { department: searchFilter },
        { team: searchFilter }
      ];
    }

    if (roleQuery !== "all") {
      if (roleQuery !== role_enum.ADMIN && roleQuery !== role_enum.USER) {
        return res.status(400).json({ message: "role must be all, ADMIN, USER" });
      }
      where.role = roleQuery as role_enum;
    }

    if (statusQuery !== "all") {
      if (statusQuery !== "active" && statusQuery !== "inactive") {
        return res.status(400).json({ message: "status must be all, active, inactive" });
      }
      where.is_active = statusQuery === "active";
    }

    const [total, users] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        orderBy: {
          created_at: "desc"
        },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return res.status(200).json({
      items: users.map(mapUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      },
      filters: {
        search,
        role: roleQuery,
        status: statusQuery
      }
    });
  } catch (error) {
    console.error("listUsers error:", error);
    return res.status(500).json({ message: "Failed to list users" });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;

    const email = parseRequiredString(body.email, "email", 255).toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "email format is invalid" });
    }

    const employee_id = parseRequiredString(body.employee_id, "employee_id", 50);
    const name = parseRequiredString(body.name, "name", 100);
    const department = parseRequiredString(body.department, "department", 100);
    const team = parseRequiredString(body.team, "team", 100);
    const role = parseRole(body.role);
    const position_title = parsePositionTitle(body.position_title);

    const passwordHash = await hashPassword(employee_id);

    const created = await prisma.users.create({
      data: {
        email,
        employee_id,
        name,
        department,
        team,
        role,
        position_title,
        password_hash: passwordHash,
        is_first_login: true,
        is_active: true
      }
    });

    return res.status(201).json(mapUser(created));
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = uniqueConstraintMessage(error);
      if (message) {
        return res.status(409).json({ message });
      }
    }

    console.error("createUser error:", error);
    return res.status(500).json({ message: "Failed to create user" });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    const targetUser = await prisma.users.findUnique({ where: { id } });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateData: Prisma.usersUpdateInput = {};

    if (body.email !== undefined) {
      const email = parseRequiredString(body.email, "email", 255).toLowerCase();
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "email format is invalid" });
      }
      updateData.email = email;
    }

    if (body.employee_id !== undefined) {
      updateData.employee_id = parseRequiredString(body.employee_id, "employee_id", 50);
    }

    if (body.name !== undefined) {
      updateData.name = parseRequiredString(body.name, "name", 100);
    }

    if (body.department !== undefined) {
      updateData.department = parseRequiredString(body.department, "department", 100);
    }

    if (body.team !== undefined) {
      updateData.team = parseRequiredString(body.team, "team", 100);
    }

    if (body.role !== undefined) {
      const nextRole = parseRole(body.role);
      if (targetUser.role === role_enum.ADMIN && nextRole === role_enum.USER && targetUser.is_active) {
        const canDemote = !(await wouldRemoveLastActiveAdmin(targetUser));
        if (!canDemote) {
          return res.status(400).json({ message: "Cannot demote the last active ADMIN user" });
        }
      }
      updateData.role = nextRole;
    }

    if (body.position_title !== undefined) {
      updateData.position_title = parsePositionTitle(body.position_title);
    }

    const updated = await prisma.users.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json(mapUser(updated));
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = uniqueConstraintMessage(error);
      if (message) {
        return res.status(409).json({ message });
      }
    }

    console.error("updateUser error:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
}

export async function deactivateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.id;
    const { id } = req.params;

    const targetUser = await prisma.users.findUnique({ where: { id } });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!targetUser.is_active) {
      return res.status(200).json({ message: "User already inactive", user: mapUser(targetUser) });
    }

    if (actorId && actorId === targetUser.id) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    if (await wouldRemoveLastActiveAdmin(targetUser)) {
      return res.status(400).json({ message: "Cannot deactivate the last active ADMIN user" });
    }

    const updated = await prisma.users.update({
      where: { id },
      data: { is_active: false }
    });

    return res.status(200).json({ message: "User deactivated", user: mapUser(updated) });
  } catch (error) {
    console.error("deactivateUser error:", error);
    return res.status(500).json({ message: "Failed to deactivate user" });
  }
}

export async function activateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const targetUser = await prisma.users.findUnique({ where: { id } });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.is_active) {
      return res.status(200).json({ message: "User already active", user: mapUser(targetUser) });
    }

    const updated = await prisma.users.update({
      where: { id },
      data: { is_active: true }
    });

    return res.status(200).json({ message: "User activated", user: mapUser(updated) });
  } catch (error) {
    console.error("activateUser error:", error);
    return res.status(500).json({ message: "Failed to activate user" });
  }
}

export async function resetPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const targetUser = await prisma.users.findUnique({ where: { id } });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordHash = await hashPassword(targetUser.employee_id);

    const updated = await prisma.users.update({
      where: { id: targetUser.id },
      data: {
        password_hash: passwordHash,
        is_first_login: true
      }
    });

    return res.status(200).json({
      message: "Password reset completed",
      user: {
        id: updated.id,
        email: updated.email,
        employee_id: updated.employee_id,
        is_first_login: updated.is_first_login
      }
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function downloadUserTemplate(_req: AuthenticatedRequest, res: Response) {
  try {
    const workbook = XLSX.utils.book_new();
    const rows = [{ 이름: "", 이메일: "", 사번: "", 부서: "", 팀: "", "역할(ADMIN/USER)": "USER", "직책(팀장/실장/부문장/본부장)": "" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "UsersTemplate");

    const fileBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const fileName = "users-template.xlsx";

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(fileBuffer);
  } catch (error) {
    console.error("downloadUserTemplate error:", error);
    return res.status(500).json({ message: "Failed to download user template" });
  }
}

type ParsedBulkUser = {
  row: number;
  name: string;
  email: string;
  employee_id: string;
  department: string;
  team: string;
  role: role_enum;
  position_title: position_title_enum | null;
};

type FailedBulkUser = {
  row: number;
  message: string;
};

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

type BulkRowInput = {
  row: number;
  name: string;
  email: string;
  employee_id: string;
  department: string;
  team: string;
  role: string;
  position_title: string;
};

async function insertCandidates(candidates: ParsedBulkUser[], failed: FailedBulkUser[]) {
  const [existingByEmail, existingByEmployeeId] = await Promise.all([
    prisma.users.findMany({
      where: { email: { in: candidates.map((c) => c.email) } },
      select: { email: true }
    }),
    prisma.users.findMany({
      where: { employee_id: { in: candidates.map((c) => c.employee_id) } },
      select: { employee_id: true }
    })
  ]);

  const existingEmailSet = new Set(existingByEmail.map((row) => row.email.toLowerCase()));
  const existingEmployeeIdSet = new Set(existingByEmployeeId.map((row) => row.employee_id));

  const creatable = candidates.filter((candidate) => {
    if (existingEmailSet.has(candidate.email)) {
      failed.push({ row: candidate.row, message: "email already exists" });
      return false;
    }
    if (existingEmployeeIdSet.has(candidate.employee_id)) {
      failed.push({ row: candidate.row, message: "employee_id already exists" });
      return false;
    }
    return true;
  });

  if (creatable.length === 0) {
    return 0;
  }

  const creatableWithHash = await Promise.all(
    creatable.map(async (candidate) => ({
      ...candidate,
      passwordHash: await hashPassword(candidate.employee_id)
    }))
  );

  const { count } = await prisma.users.createMany({
    data: creatableWithHash.map((c) => ({
      email: c.email,
      employee_id: c.employee_id,
      name: c.name,
      department: c.department,
      team: c.team,
      role: c.role,
      position_title: c.position_title,
      password_hash: c.passwordHash,
      is_first_login: true,
      is_active: true
    })),
    skipDuplicates: true
  });

  return count;
}

export async function bulkUploadUserRows(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as { rows?: unknown[] };

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return res.status(200).json({ createdCount: 0, failedCount: 0, failedRows: [] });
    }

    const failed: FailedBulkUser[] = [];
    const candidates: ParsedBulkUser[] = [];
    const seenEmails = new Map<string, number>();
    const seenEmployeeIds = new Map<string, number>();

    for (const item of body.rows) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const r = item as Record<string, unknown>;
      const rowNumber = Number(r.row) || 0;
      const name = normalizeCell(r.name);
      const email = normalizeCell(r.email).toLowerCase();
      const employee_id = normalizeCell(r.employee_id);
      const department = normalizeCell(r.department);
      const team = normalizeCell(r.team);
      const roleRaw = normalizeCell(r.role).toUpperCase();
      const positionRaw = normalizeCell(r.position_title);

      let position_title: position_title_enum | null = null;

      try {
        parseRequiredString(name, "name", 100);
        parseRequiredString(email, "email", 255);
        parseRequiredString(employee_id, "employee_id", 50);
        parseRequiredString(department, "department", 100);
        parseRequiredString(team, "team", 100);
        position_title = parsePositionTitle(positionRaw);
      } catch (validationError) {
        failed.push({ row: rowNumber, message: validationError instanceof Error ? validationError.message : "Invalid row" });
        continue;
      }

      if (!isValidEmail(email)) {
        failed.push({ row: rowNumber, message: "email format is invalid" });
        continue;
      }

      if (roleRaw !== role_enum.ADMIN && roleRaw !== role_enum.USER) {
        failed.push({ row: rowNumber, message: "role must be ADMIN or USER" });
        continue;
      }

      if (seenEmails.has(email)) {
        failed.push({ row: rowNumber, message: `duplicate email in chunk (first row: ${seenEmails.get(email)})` });
        continue;
      }

      if (seenEmployeeIds.has(employee_id)) {
        failed.push({ row: rowNumber, message: `duplicate employee_id in chunk (first row: ${seenEmployeeIds.get(employee_id)})` });
        continue;
      }

      seenEmails.set(email, rowNumber);
      seenEmployeeIds.set(employee_id, rowNumber);
      candidates.push({ row: rowNumber, name, email, employee_id, department, team, role: roleRaw as role_enum, position_title });
    }

    if (candidates.length === 0) {
      return res.status(200).json({ createdCount: 0, failedCount: failed.length, failedRows: failed });
    }

    const createdCount = await insertCandidates(candidates, failed);

    return res.status(200).json({
      createdCount,
      failedCount: failed.length,
      failedRows: failed.sort((a, b) => a.row - b.row)
    });
  } catch (error) {
    console.error("bulkUploadUserRows error:", error);
    return res.status(500).json({ message: "Failed to bulk upload user rows" });
  }
}

export async function bulkUploadUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "file is required" });
    }

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return res.status(400).json({ message: "Worksheet is empty" });
    }

    const matrix = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, { header: 1, defval: "" });
    const headers = (matrix[0] || []).map((cell) => normalizeCell(cell));
    const roleHeader = "역할(ADMIN/USER)";
    const positionHeader = "직책(팀장/실장/부문장/본부장)";
    const requiredHeaders = ["이름", "이메일", "사번", "부서", "팀", roleHeader];

    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        return res.status(400).json({ message: `Missing required header: ${header}` });
      }
    }

    const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
    const failed: FailedBulkUser[] = [];
    const candidates: ParsedBulkUser[] = [];

    const seenEmails = new Map<string, number>();
    const seenEmployeeIds = new Map<string, number>();

    for (let i = 1; i < matrix.length; i += 1) {
      const rowNumber = i + 1;
      const row = matrix[i] || [];

      const name = normalizeCell(row[headerIndex["이름"]]);
      const email = normalizeCell(row[headerIndex["이메일"]]).toLowerCase();
      const employee_id = normalizeCell(row[headerIndex["사번"]]);
      const department = normalizeCell(row[headerIndex["부서"]]);
      const team = normalizeCell(row[headerIndex["팀"]]);
      const roleRaw = normalizeCell(row[headerIndex[roleHeader]]).toUpperCase();
      const positionRaw = positionHeader in headerIndex ? normalizeCell(row[headerIndex[positionHeader]]) : "";

      if (!name && !email && !employee_id && !department && !team && !roleRaw) {
        continue;
      }

      let position_title: position_title_enum | null = null;

      try {
        parseRequiredString(name, "name", 100);
        parseRequiredString(email, "email", 255);
        parseRequiredString(employee_id, "employee_id", 50);
        parseRequiredString(department, "department", 100);
        parseRequiredString(team, "team", 100);
        position_title = parsePositionTitle(positionRaw);
      } catch (validationError) {
        failed.push({ row: rowNumber, message: validationError instanceof Error ? validationError.message : "Invalid row" });
        continue;
      }

      if (!isValidEmail(email)) {
        failed.push({ row: rowNumber, message: "email format is invalid" });
        continue;
      }

      if (roleRaw !== role_enum.ADMIN && roleRaw !== role_enum.USER) {
        failed.push({ row: rowNumber, message: "role must be ADMIN or USER" });
        continue;
      }

      if (seenEmails.has(email)) {
        failed.push({ row: rowNumber, message: `duplicate email in file (first row: ${seenEmails.get(email)})` });
        continue;
      }

      if (seenEmployeeIds.has(employee_id)) {
        failed.push({ row: rowNumber, message: `duplicate employee_id in file (first row: ${seenEmployeeIds.get(employee_id)})` });
        continue;
      }

      seenEmails.set(email, rowNumber);
      seenEmployeeIds.set(employee_id, rowNumber);

      candidates.push({
        row: rowNumber,
        name,
        email,
        employee_id,
        department,
        team,
        role: roleRaw as role_enum,
        position_title
      });
    }

    if (candidates.length === 0) {
      return res.status(200).json({ createdCount: 0, failedCount: failed.length, failedRows: failed });
    }

    const createdCount = await insertCandidates(candidates, failed);

    return res.status(200).json({
      createdCount,
      failedCount: failed.length,
      failedRows: failed.sort((a, b) => a.row - b.row)
    });
  } catch (error) {
    console.error("bulkUploadUsers error:", error);
    return res.status(500).json({ message: "Failed to bulk upload users" });
  }
}

import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../config/prisma", () => ({
  prisma: {
    users: { findUnique: vi.fn(), findMany: vi.fn() },
    external_trainings: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock authMiddleware so tests don't depend on JWT/DB for auth.
// Each test calls setAuthUser() to configure which user is "logged in".
vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import app from "../app";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = { id: "admin-1", email: "admin@test.com", role: "ADMIN" as const };
const USER  = { id: "user-1",  email: "user@test.com",  role: "USER"  as const };

function setAuthUser(user: typeof ADMIN | typeof USER) {
  vi.mocked(authMiddleware).mockImplementation((req: any, _res, next) => {
    req.user = user;
    next();
  });
}

/** Minimal record shape returned by Prisma (matches mapRecord expectations) */
const makeRec = (overrides: Record<string, unknown> = {}) => ({
  id: "rec-1",
  user_id: USER.id,
  training_name: "Leadership Bootcamp",
  education_category: null,
  type: "OFFLINE",
  start_date: new Date("2026-03-01"),
  end_date: new Date("2026-03-03"),
  hours: 24,
  cost: null,
  institution: "HQ Academy",
  certificate_status: "SUBMITTED",
  certificate_file: "path/cert.pdf",
  approval_status: "PENDING",
  approval_comment: null,
  approved_by: null,
  approved_at: null,
  credits: null,
  created_at: new Date(),
  updated_at: new Date(),
  user: { id: USER.id, name: "Jane", employee_id: "EMP001" },
  approver: null,
  ...overrides,
});

// ── GET /api/external-trainings ───────────────────────────────────────────────

describe("GET /api/external-trainings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("ADMIN: no user_id filter applied — all records returned", async () => {
    setAuthUser(ADMIN);
    vi.mocked(prisma.external_trainings.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.external_trainings.findMany).mockResolvedValueOnce(
      [makeRec(), makeRec({ id: "rec-2", user_id: "other-user" })] as any
    );

    const res = await request(app).get("/api/external-trainings");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    // The WHERE clause passed to count must NOT have user_id
    const where = vi.mocked(prisma.external_trainings.count).mock.calls[0]?.[0]?.where;
    expect(where).not.toHaveProperty("user_id");
  });

  it("USER: query is scoped to own user_id only", async () => {
    setAuthUser(USER);
    vi.mocked(prisma.external_trainings.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.external_trainings.findMany).mockResolvedValueOnce([makeRec()] as any);

    const res = await request(app).get("/api/external-trainings");

    expect(res.status).toBe(200);

    const where = vi.mocked(prisma.external_trainings.count).mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ user_id: USER.id });
  });

  it("returns 200 with empty items when no data", async () => {
    setAuthUser(USER);
    vi.mocked(prisma.external_trainings.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.external_trainings.findMany).mockResolvedValueOnce([] as any);

    const res = await request(app).get("/api/external-trainings");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });
});

// ── POST /api/external-trainings ──────────────────────────────────────────────

describe("POST /api/external-trainings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("400 when training_name is missing", async () => {
    setAuthUser(USER);

    const res = await request(app)
      .post("/api/external-trainings")
      .send({ institution: "HQ", type: "OFFLINE", start_date: "2026-01-01", end_date: "2026-01-03", hours: 16 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/training_name/);
  });

  it("400 when type is invalid", async () => {
    setAuthUser(USER);

    const res = await request(app)
      .post("/api/external-trainings")
      .send({ training_name: "Test", institution: "HQ", type: "INVALID", start_date: "2026-01-01", end_date: "2026-01-03", hours: 8 });

    expect(res.status).toBe(400);
  });

  it("400 when end_date is before start_date", async () => {
    setAuthUser(USER);

    const res = await request(app)
      .post("/api/external-trainings")
      .send({ training_name: "Test", institution: "HQ", type: "ONLINE", start_date: "2026-01-10", end_date: "2026-01-05", hours: 8 });

    expect(res.status).toBe(400);
  });

  it("201 USER creates own record (user_id from token, not body)", async () => {
    setAuthUser(USER);
    vi.mocked(prisma.external_trainings.create).mockResolvedValueOnce(makeRec() as any);

    const res = await request(app)
      .post("/api/external-trainings")
      .send({
        training_name: "Leadership Bootcamp",
        institution: "HQ Academy",
        type: "OFFLINE",
        start_date: "2026-03-01",
        end_date: "2026-03-03",
        hours: 24,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "rec-1");
    // The create call must use the USER's id, not an arbitrary body user_id
    const createData = vi.mocked(prisma.external_trainings.create).mock.calls[0]?.[0]?.data;
    expect(createData).toMatchObject({ user_id: USER.id });
  });

  it("400 when ADMIN omits user_id (required for admin creates)", async () => {
    setAuthUser(ADMIN);

    const res = await request(app)
      .post("/api/external-trainings")
      .send({ training_name: "Test", institution: "HQ", type: "OFFLINE", start_date: "2026-01-01", end_date: "2026-01-03", hours: 8 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/user_id/);
  });
});

// ── PUT /api/external-trainings/:id/approve ───────────────────────────────────

describe("PUT /api/external-trainings/:id/approve", () => {
  beforeEach(() => vi.resetAllMocks());

  it("403 when a non-ADMIN user attempts to approve", async () => {
    setAuthUser(USER);

    const res = await request(app).put("/api/external-trainings/rec-1/approve");

    expect(res.status).toBe(403);
    // Controller should not even be reached
    expect(vi.mocked(prisma.external_trainings.findUnique)).not.toHaveBeenCalled();
  });

  it("404 when record does not exist", async () => {
    setAuthUser(ADMIN);
    vi.mocked(prisma.external_trainings.findUnique).mockResolvedValueOnce(null);

    const res = await request(app).put("/api/external-trainings/no-such-id/approve");

    expect(res.status).toBe(404);
  });

  it("400 when certificate has not been submitted yet", async () => {
    setAuthUser(ADMIN);
    vi.mocked(prisma.external_trainings.findUnique).mockResolvedValueOnce(
      makeRec({ certificate_status: "NOT_SUBMITTED" }) as any
    );

    const res = await request(app).put("/api/external-trainings/rec-1/approve");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Certificate must be submitted/);
  });

  it("400 when record is not in PENDING status", async () => {
    setAuthUser(ADMIN);
    vi.mocked(prisma.external_trainings.findUnique).mockResolvedValueOnce(
      makeRec({ certificate_status: "SUBMITTED", approval_status: "APPROVED" }) as any
    );

    const res = await request(app).put("/api/external-trainings/rec-1/approve");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/PENDING/);
  });

  it("200 ADMIN approves a SUBMITTED + PENDING record", async () => {
    setAuthUser(ADMIN);
    vi.mocked(prisma.external_trainings.findUnique).mockResolvedValueOnce(
      makeRec({ certificate_status: "SUBMITTED", approval_status: "PENDING" }) as any
    );
    vi.mocked(prisma.external_trainings.update).mockResolvedValueOnce(
      makeRec({ approval_status: "APPROVED", approved_by: ADMIN.id }) as any
    );

    const res = await request(app).put("/api/external-trainings/rec-1/approve");

    expect(res.status).toBe(200);
    expect(res.body.approval_status).toBe("APPROVED");
    // Update must record who approved
    const updateData = vi.mocked(prisma.external_trainings.update).mock.calls[0]?.[0]?.data;
    expect(updateData).toMatchObject({ approval_status: "APPROVED", approved_by: ADMIN.id });
  });
});

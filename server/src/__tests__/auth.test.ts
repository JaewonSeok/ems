import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";

// ── Hoist mocks before any import ─────────────────────────────────────────────

// Bypass rate-limiting so repeated login requests don't get 429
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../config/prisma", () => ({
  prisma: {
    users: { findUnique: vi.fn() },
  },
}));

vi.mock("../utils/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

// ── Imports (resolved after mocks are hoisted) ────────────────────────────────

import app from "../app";
import { prisma } from "../config/prisma";
import { verifyPassword } from "../utils/password";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const dbUser = {
  id: "user-1",
  email: "user@test.com",
  name: "Test User",
  password_hash: "$2b$10$hashed",
  employee_id: "EMP001",
  department: "IT",
  team: "Dev",
  role: "USER" as const,
  is_active: true,
  is_first_login: false,
  position_title: null,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@test.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "secret" });

    expect(res.status).toBe(400);
  });

  it("returns 401 when user does not exist", async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "pw" });

    expect(res.status).toBe(401);
    expect(vi.mocked(prisma.users.findUnique)).toHaveBeenCalledOnce();
  });

  it("returns 401 when user is inactive", async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValueOnce({
      ...dbUser,
      is_active: false,
    } as typeof dbUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: dbUser.email, password: "pw" });

    expect(res.status).toBe(401);
    // verifyPassword should never be called for inactive users
    expect(vi.mocked(verifyPassword)).not.toHaveBeenCalled();
  });

  it("returns 401 when password is wrong", async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValueOnce(dbUser as any);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: dbUser.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("returns 200 with accessToken, refreshToken, and role on success", async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValueOnce(dbUser as any);
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: dbUser.email, password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      role: "USER",
    });
    expect(res.body.user).toMatchObject({ email: dbUser.email });
  });
});

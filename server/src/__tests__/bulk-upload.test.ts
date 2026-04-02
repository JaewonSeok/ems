import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import XLSX from "xlsx";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../config/prisma", () => ({
  prisma: {
    users: { findMany: vi.fn() },
    external_trainings: { create: vi.fn() },
    internal_trainings: { create: vi.fn() },
    internal_lectures: { create: vi.fn() },
    certifications: { create: vi.fn() },
  },
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import app from "../app";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN = { id: "admin-1", email: "admin@test.com", role: "ADMIN" as const };

function setAdmin() {
  vi.mocked(authMiddleware).mockImplementation((req: any, _res, next) => {
    req.user = ADMIN;
    next();
  });
}

/** Build an xlsx Buffer from a header row + optional data rows. */
function makeXlsx(headers: string[], rows: Array<Array<string | number>> = []): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
}

const EXT_HEADERS = [
  "사번", "교육명", "구분(오프라인/온라인)", "시작일", "종료일", "교육시간", "비용", "주관기관", "학점",
];

// ── POST /api/bulk-upload/:category ──────────────────────────────────────────

describe("POST /api/bulk-upload/external-training", () => {
  beforeEach(() => vi.resetAllMocks());

  it("400 when required headers are missing", async () => {
    setAdmin();

    const buf = makeXlsx(["사번", "교육명"]); // missing most required headers

    const res = await request(app)
      .post("/api/bulk-upload/external-training")
      .attach("file", buf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/필수 헤더/);
  });

  it("200 with totalRows 0 when file has headers but no data rows", async () => {
    setAdmin();

    const buf = makeXlsx(EXT_HEADERS); // headers only, no data

    const res = await request(app)
      .post("/api/bulk-upload/external-training")
      .attach("file", buf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(0);
    expect(res.body.createdCount).toBe(0);
    expect(res.body.failedCount).toBe(0);
    // findMany should not be called when there are no candidate rows
    expect(vi.mocked(prisma.users.findMany)).not.toHaveBeenCalled();
  });

  it("200 with failedRow when employee_id is not found in DB", async () => {
    setAdmin();
    vi.mocked(prisma.users.findMany).mockResolvedValueOnce([]); // no users found

    const buf = makeXlsx(EXT_HEADERS, [
      ["EMP999", "AI 교육", "오프라인", "2026-01-05", "2026-01-10", 40, 500000, "한국교육원", 5],
    ]);

    const res = await request(app)
      .post("/api/bulk-upload/external-training")
      .attach("file", buf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(1);
    expect(res.body.createdCount).toBe(0);
    expect(res.body.failedCount).toBe(1);
    expect(res.body.failedRows).toHaveLength(1);
    expect(res.body.failedRows[0].reason).toMatch(/사번/);
    expect(vi.mocked(prisma.external_trainings.create)).not.toHaveBeenCalled();
  });

  it("200 with createdCount 1 when employee_id resolves to a valid user", async () => {
    setAdmin();
    vi.mocked(prisma.users.findMany).mockResolvedValueOnce([
      { id: "user-1", employee_id: "EMP001" },
    ] as any);
    vi.mocked(prisma.external_trainings.create).mockResolvedValueOnce({} as any);

    const buf = makeXlsx(EXT_HEADERS, [
      ["EMP001", "AI 교육", "오프라인", "2026-01-05", "2026-01-10", 40, 500000, "한국교육원", 5],
    ]);

    const res = await request(app)
      .post("/api/bulk-upload/external-training")
      .attach("file", buf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(1);
    expect(res.body.createdCount).toBe(1);
    expect(res.body.failedCount).toBe(0);
    expect(res.body.failedRows).toHaveLength(0);
    expect(vi.mocked(prisma.external_trainings.create)).toHaveBeenCalledOnce();
  });
});

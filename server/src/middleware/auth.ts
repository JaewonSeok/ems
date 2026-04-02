import { NextFunction, Request, Response } from "express";
import { role_enum } from "@prisma/client";
import { prisma } from "../config/prisma";
import { verifyAccessToken } from "../utils/jwt";

export type AuthUser = {
  id: string;
  email: string;
  role: role_enum;
};

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  /** Populated when an ADMIN is impersonating another user. */
  originalAdmin?: AuthUser;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);

    const caller = await prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, is_active: true }
    });

    if (!caller || !caller.is_active) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = { id: caller.id, email: caller.email, role: caller.role };

    // ── Impersonation header ───────────────────────────────────────────────
    // Client skips this header for /auth/ endpoints, so it only arrives for
    // regular data routes where the admin wants to view as a target user.
    const impersonateId = req.headers["x-impersonate-user-id"];

    if (impersonateId && typeof impersonateId === "string" && caller.role === role_enum.ADMIN) {
      const target = await prisma.users.findUnique({
        where: { id: impersonateId },
        select: { id: true, email: true, role: true, is_active: true }
      });

      if (target && target.is_active && target.role !== role_enum.ADMIN) {
        req.originalAdmin = req.user;
        req.user = { id: target.id, email: target.email, role: target.role };
      }
    }

    // ── Write control during impersonation ────────────────────────────────
    // ADMIN이 직원 화면 보기 중일 때, 교육 CRUD(등록/수정/삭제)와
    // 수료증 업로드/삭제를 허용한다. req.user는 대상 직원으로 설정되어 있으므로
    // 컨트롤러에서 해당 직원의 데이터로 처리된다.
    // (impersonation 자체가 ADMIN 인증 후에만 가능하므로 보안상 안전함)
    if (req.originalAdmin && req.method !== "GET") {
      const allowedPaths = [
        "/external-trainings",
        "/internal-trainings",
        "/internal-lectures",
        "/certifications"
      ];
      const isAllowed = allowedPaths.some((p) => req.baseUrl.includes(p));
      if (!isAllowed) {
        return res.status(403).json({ message: "impersonation 중에는 교육 관련 기능만 사용 가능합니다." });
      }
    }

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

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

    // ── Read-only enforcement during impersonation ────────────────────────
    // Certificate upload/delete are allowed even during impersonation so that
    // admins can manage employee certificates while viewing the employee view.
    if (req.originalAdmin && req.method !== "GET") {
      const isCertificateEndpoint = req.path.includes("/certificate");
      if (!isCertificateEndpoint) {
        return res.status(403).json({ message: "impersonation 중에는 읽기만 가능합니다." });
      }
    }

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

import { NextFunction, Response } from "express";
import { role_enum } from "@prisma/client";
import { AuthenticatedRequest } from "./auth";

export function rbacMiddleware(allowedRoles: role_enum[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // impersonation 중이면 실제 ADMIN의 역할로 권한 체크
    const effectiveRole = req.originalAdmin?.role ?? req.user.role;
    if (!allowedRoles.includes(effectiveRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}

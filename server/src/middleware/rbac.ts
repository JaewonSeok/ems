import { NextFunction, Response } from "express";
import { role_enum } from "@prisma/client";
import { AuthenticatedRequest } from "./auth";

export function rbacMiddleware(allowedRoles: role_enum[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}

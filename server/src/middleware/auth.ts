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
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);

    const user = await prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, is_active: true }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await prisma.users.findUnique({ where: { email } });

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = createAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = createRefreshToken({ id: user.id, email: user.email, role: user.role });

    return res.status(200).json({
      accessToken,
      refreshToken,
      role: user.role,
      firstLogin: user.is_first_login,
      user: {
        id: user.id,
        email: user.email,
        employee_id: user.employee_id,
        name: user.name,
        department: user.department,
        team: user.team,
        role: user.role
      }
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.users.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, is_active: true }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const nextAccessToken = createAccessToken({ id: user.id, email: user.email, role: user.role });
    const nextRefreshToken = createRefreshToken({ id: user.id, email: user.email, role: user.role });

    return res.status(200).json({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("token") ? "Invalid refresh token" : "Internal server error";
    const statusCode = message === "Invalid refresh token" ? 401 : 500;
    return res.status(statusCode).json({ message });
  }
}

export async function logout(_req: Request, res: Response) {
  return res.status(200).json({ message: "Logged out" });
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

    if (!newPassword) {
      return res.status(400).json({ message: "newPassword is required" });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (!user || !user.is_active) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.is_first_login) {
      if (!currentPassword) {
        return res.status(400).json({ message: "currentPassword is required" });
      }

      const currentPasswordOk = await verifyPassword(currentPassword, user.password_hash);

      if (!currentPasswordOk) {
        return res.status(401).json({ message: "Invalid current password" });
      }
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: newPasswordHash,
        is_first_login: false
      }
    });

    return res.status(200).json({ message: "Password changed", firstLogin: false });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

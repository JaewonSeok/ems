import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

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
    const isJwtError = error instanceof Error && (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError" ||
      error.message.includes("token")
    );
    if (isJwtError) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function logout(_req: Request, res: Response) {
  return res.status(200).json({ message: "Logged out" });
}

export function googleLogin(_req: Request, res: Response) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ message: "Google OAuth is not configured" });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account"
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response) {
  const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:5173";
  const loginRedirect = `${frontendUrl}/login`;

  const redirectError = (error: string) =>
    res.redirect(`${loginRedirect}?error=${encodeURIComponent(error)}`);

  try {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error || !code) {
      return redirectError(error || "oauth_cancelled");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return redirectError("server_misconfigured");
    }

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!tokenRes.ok) {
      console.error("Google token exchange failed:", await tokenRes.text());
      return redirectError("token_exchange_failed");
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };

    if (!tokenData.access_token) {
      return redirectError("token_exchange_failed");
    }

    // Fetch user info
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userInfoRes.ok) {
      console.error("Google userinfo fetch failed:", await userInfoRes.text());
      return redirectError("userinfo_fetch_failed");
    }

    const googleUser = (await userInfoRes.json()) as { email?: string; name?: string };

    if (!googleUser.email) {
      return redirectError("userinfo_fetch_failed");
    }

    // Find user in DB
    const user = await prisma.users.findUnique({ where: { email: googleUser.email } });

    if (!user || !user.is_active) {
      return redirectError("user_not_found");
    }

    const accessToken = createAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = createRefreshToken({ id: user.id, email: user.email, role: user.role });

    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      role: user.role,
      userId: user.id,
      email: user.email,
      name: user.name,
      employee_id: user.employee_id,
      department: user.department,
      team: user.team,
      position_title: user.position_title ?? ""
    });

    return res.redirect(`${frontendUrl}/auth/google/callback?${params.toString()}`);
  } catch (err) {
    console.error("googleCallback error:", err);
    return redirectError("server_error");
  }
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

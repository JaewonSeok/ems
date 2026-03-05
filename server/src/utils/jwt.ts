import jwt from "jsonwebtoken";
import { role_enum } from "@prisma/client";

const ACCESS_EXPIRES_IN = "1h";
const REFRESH_EXPIRES_IN = "7d";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret";

export type TokenUser = {
  id: string;
  email: string;
  role: role_enum;
};

type AccessPayload = {
  sub: string;
  email: string;
  role: role_enum;
  tokenType: "access";
};

type RefreshPayload = {
  sub: string;
  email: string;
  role: role_enum;
  tokenType: "refresh";
};

export function createAccessToken(user: TokenUser) {
  const payload: AccessPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tokenType: "access"
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function createRefreshToken(user: TokenUser) {
  const payload: RefreshPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tokenType: "refresh"
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as AccessPayload;

  if (decoded.tokenType !== "access") {
    throw new Error("Invalid token type");
  }

  return decoded;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshPayload;

  if (decoded.tokenType !== "refresh") {
    throw new Error("Invalid token type");
  }

  return decoded;
}

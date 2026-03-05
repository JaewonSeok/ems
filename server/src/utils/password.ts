import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(rawPassword: string) {
  return bcrypt.hash(rawPassword, SALT_ROUNDS);
}

export async function verifyPassword(rawPassword: string, passwordHash: string) {
  return bcrypt.compare(rawPassword, passwordHash);
}

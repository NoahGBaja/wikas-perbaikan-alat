import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
export {
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENT_TEXT,
  validatePasswordStrength,
} from "./password-rules.ts";

const BCRYPT_SALT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function createPasswordResetToken() {
  const rawToken = randomBytes(32).toString("hex");

  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
  };
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_SALT_ROUNDS = 12;

export function validatePasswordStrength(password: string) {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push("Kata sandi minimal 8 karakter.");
  }

  if (!/[A-Za-z]/.test(password)) {
    errors.push("Kata sandi harus mengandung huruf.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Kata sandi harus mengandung angka.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Kata sandi harus mengandung simbol.");
  }

  return errors;
}

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

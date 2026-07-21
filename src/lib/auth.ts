import { createHash } from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import type { AppRole } from "@/src/lib/roles";

export const AUTH_COOKIE_NAME = "auth_token";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET belum diisi di file .env");
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("AUTH_SECRET production minimal 32 karakter.");
  }

  return secret;
}

const AUTH_SECRET = getAuthSecret();

const VALID_ROLES: AppRole[] = [
  "SUPER_ADMIN",
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "EXECUTIVE",
  "USER",
];

export type AuthTokenPayload = {
  userId: number;
  nama: string;
  role: AppRole;
  isSuperAdmin: boolean;
  sessionTag: string;
};

const revokedTokenHashes = new Map<string, number>();

function isValidRole(role: unknown): role is AppRole {
  return typeof role === "string" && VALID_ROLES.includes(role as AppRole);
}

function isAuthTokenPayload(value: string | JwtPayload): value is AuthTokenPayload {
  if (typeof value === "string") return false;

  return (
    typeof value.userId === "number" &&
    typeof value.nama === "string" &&
    isValidRole(value.role) &&
    (typeof value.isSuperAdmin === "boolean" ||
      typeof value.isSuperAdmin === "undefined") &&
    typeof value.sessionTag === "string"
  );
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function pruneRevokedTokens() {
  const now = Date.now();

  for (const [tokenHash, expiresAt] of revokedTokenHashes) {
    if (expiresAt <= now) {
      revokedTokenHashes.delete(tokenHash);
    }
  }
}

export function createAuthSessionTag(input: {
  passwordHash: string;
  role: AppRole;
  isSuperAdmin?: boolean | null;
}) {
  return createHash("sha256")
    .update(`${input.role}:${input.isSuperAdmin ? "1" : "0"}:${input.passwordHash}`)
    .digest("hex");
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: `${AUTH_COOKIE_MAX_AGE_SECONDS}s`,
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    pruneRevokedTokens();

    if (revokedTokenHashes.has(hashToken(token))) {
      return null;
    }

    const decoded = jwt.verify(token, AUTH_SECRET);

    if (!isAuthTokenPayload(decoded)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function revokeAuthToken(token: string) {
  try {
    const decoded = jwt.decode(token) as JwtPayload | string | null;
    const expiresAt =
      decoded && typeof decoded !== "string" && typeof decoded.exp === "number"
        ? decoded.exp * 1000
        : Date.now() + AUTH_COOKIE_MAX_AGE_SECONDS * 1000;

    revokedTokenHashes.set(hashToken(token), expiresAt);
    pruneRevokedTokens();
  } catch {
    // Token rusak tetap akan dihapus dari browser lewat cookie logout.
  }
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

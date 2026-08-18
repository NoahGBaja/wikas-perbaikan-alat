import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppRole } from "@/src/lib/roles";
import {
  AUTH_COOKIE_NAME,
  createAuthSessionTag,
  verifyAuthToken,
} from "@/src/lib/auth";
import {
  findUserByIdRaw,
  type SessionUserRow,
  type SessionUserWithPasswordRow,
} from "@/src/lib/raw-data";
import { isAdminRole } from "@/src/lib/roles";

export type SessionUser = Awaited<ReturnType<typeof getSessionUser>>;

function stripPasswordHash(user: SessionUserWithPasswordRow): SessionUserRow {
  return {
    id: user.id,
    nama: user.nama,
    jabatan: user.jabatan,
    nip: user.nip,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    categoryScope: user.categoryScope,
    sessionVersion: user.sessionVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function hasValidSession(
  user: SessionUserWithPasswordRow,
  sessionTag: string,
  sessionVersion: number,
) {
  return (
    user.sessionVersion === sessionVersion &&
    createAuthSessionTag({
      passwordHash: user.passwordHash,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    }) === sessionTag
  );
}

export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyAuthToken(token);

  if (!payload) {
    return null;
  }

  const user = await findUserByIdRaw(payload.userId, true);

  if (!user || !hasValidSession(user, payload.sessionTag, payload.sessionVersion)) {
    return null;
  }

  return stripPasswordHash(user);
});

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?expired=1");
  }

  return user;
}

export async function requireRole<RoleInput extends AppRole>(role: RoleInput) {
  const user = await requireSessionUser();

  if (user.role !== role) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return user as NonNullable<Awaited<ReturnType<typeof getSessionUser>>> & {
    role: RoleInput;
  };
}

export async function requireAdminUser() {
  const user = await requireSessionUser();

  if (!user.isSuperAdmin && !isAdminRole(user.role)) {
    redirect("/dashboard/user");
  }

  return user;
}

export async function requireUserRole() {
  const user = await requireSessionUser();

  if (user.role !== "USER") {
    redirect("/dashboard/admin");
  }

  return user;
}

export async function getApiSessionUser() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyAuthToken(token);

  if (!payload) {
    return null;
  }

  const user = await findUserByIdRaw(payload.userId, true);

  if (!user || !hasValidSession(user, payload.sessionTag, payload.sessionVersion)) {
    return null;
  }

  return user;
}

export function getDefaultRedirectForRole(role: AppRole) {
  if (role === "EXECUTIVE") {
    return "/dashboard/admin/statistik";
  }

  return isAdminRole(role) ? "/dashboard/admin" : "/dashboard/user";
}

export function getDefaultRedirectForUser(user: {
  role: AppRole;
  isSuperAdmin?: boolean | null;
}) {
  if (user.role === "EXECUTIVE") {
    return "/dashboard/admin/statistik";
  }

  return user.isSuperAdmin || isAdminRole(user.role)
    ? "/dashboard/admin"
    : "/dashboard/user";
}

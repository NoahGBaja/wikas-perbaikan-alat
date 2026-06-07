export const ADMIN_ROLES = [
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "ADMIN_6",
] as const;

export const ALL_ADMIN_ROLES = ["SUPER_ADMIN", ...ADMIN_ROLES] as const;

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN_1"
  | "ADMIN_2"
  | "ADMIN_3"
  | "ADMIN_4"
  | "ADMIN_5"
  | "ADMIN_6"
  | "USER";

export function isAdminRole(role?: string | null) {
  return !!role && ALL_ADMIN_ROLES.includes(role as any);
}

export function isSuperAdmin(role?: string | null) {
  return role === "SUPER_ADMIN";
}

export function isNormalAdmin(role?: string | null) {
  return !!role && ADMIN_ROLES.includes(role as any);
}

export function getAdminLevel(role?: string | null) {
  if (!role) return null;

  const match = role.match(/^ADMIN_(\d)$/);
  if (!match) return null;

  return Number(match[1]);
}
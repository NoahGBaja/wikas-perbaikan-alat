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

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super Admin",
  USER: "PJ Ruangan",
  ADMIN_1: "PJ Perbaikan",
  ADMIN_2: "PU",
  ADMIN_3: "BMN",
  ADMIN_4: "PPK",
  ADMIN_5: "PP",
  ADMIN_6: "IPP",
};

export function getRoleLabel(role?: string | null) {
  if (!role) return "-";

  return ROLE_LABELS[role as AppRole] || role;
}

export function isAdminRole(role?: string | null) {
  return !!role && ALL_ADMIN_ROLES.some((adminRole) => adminRole === role);
}

export function isSuperAdmin(role?: string | null) {
  return role === "SUPER_ADMIN";
}

export function isNormalAdmin(role?: string | null) {
  return !!role && ADMIN_ROLES.some((adminRole) => adminRole === role);
}

export function getAdminLevel(role?: string | null) {
  if (!role) return null;

  const match = role.match(/^ADMIN_(\d)$/);
  if (!match) return null;

  return Number(match[1]);
}

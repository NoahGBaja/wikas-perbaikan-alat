export const ADMIN_ROLES = [
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
] as const;

export const ALL_ADMIN_ROLES = ["SUPER_ADMIN", ...ADMIN_ROLES] as const;

export const CATEGORY_SCOPED_ROLES = ["ADMIN_1", "ADMIN_4"] as const;

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN_1"
  | "ADMIN_2"
  | "ADMIN_3"
  | "ADMIN_4"
  | "ADMIN_5"
  | "USER";

export type AppCategoryScope =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super Admin",
  USER: "PJ Ruangan",
  ADMIN_1: "PJ Perbaikan",
  ADMIN_2: "KTU",
  ADMIN_3: "BMN",
  ADMIN_4: "PPK",
  ADMIN_5: "PP",
};

export const CATEGORY_SCOPE_LABELS: Record<AppCategoryScope, string> = {
  FASILITAS_INVENTARIS: "Inventaris",
  IT_ELEKTRONIK: "Elektronik",
  LABORATORIUM: "Laboratorium",
};

export function getRoleLabel(role?: string | null) {
  if (!role) return "-";

  return ROLE_LABELS[role as AppRole] || role;
}

export function getCategoryScopeLabel(category?: string | null) {
  if (!category) return "-";

  return CATEGORY_SCOPE_LABELS[category as AppCategoryScope] || category;
}

export function isCategoryScopedRole(role?: string | null) {
  return (
    !!role &&
    CATEGORY_SCOPED_ROLES.some((scopedRole) => scopedRole === role)
  );
}

export function isAdminRole(role?: string | null) {
  return !!role && ALL_ADMIN_ROLES.some((adminRole) => adminRole === role);
}

export function hasAdminAccess(input?: {
  role?: string | null;
  isSuperAdmin?: boolean | null;
} | null) {
  return !!input && (!!input.isSuperAdmin || isAdminRole(input.role));
}

export function isSuperAdmin(input?: {
  role?: string | null;
  isSuperAdmin?: boolean | null;
} | string | null) {
  if (typeof input === "string" || input === null || input === undefined) {
    return input === "SUPER_ADMIN";
  }

  return !!input.isSuperAdmin || input.role === "SUPER_ADMIN";
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

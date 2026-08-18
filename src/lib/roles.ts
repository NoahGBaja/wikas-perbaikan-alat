export const ADMIN_ROLES = [
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
] as const;

export const ALL_ADMIN_ROLES = ["SUPER_ADMIN", ...ADMIN_ROLES, "EXECUTIVE"] as const;

export const CATEGORY_SCOPED_ROLES = ["ADMIN_1", "ADMIN_4"] as const;

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN_1"
  | "ADMIN_2"
  | "ADMIN_3"
  | "ADMIN_4"
  | "ADMIN_5"
  | "EXECUTIVE"
  | "USER";

export type AppCategoryScope =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Admin Utama",
  USER: "PJ Ruangan",
  ADMIN_1: "PJ Perbaikan",
  ADMIN_2: "K.TU",
  ADMIN_3: "BMN",
  ADMIN_4: "PPK",
  ADMIN_5: "PP",
  EXECUTIVE: "Kepala Balai",
};

export const CATEGORY_SCOPE_LABELS: Record<AppCategoryScope, string> = {
  FASILITAS_INVENTARIS: "Inventaris",
  IT_ELEKTRONIK: "Elektronik",
  LABORATORIUM: "Laboratorium",
};

export type WorkflowActionPresentation = {
  approveLabel: string;
  approveClassName: string;
  completeLabel?: string;
  completeClassName?: string;
  rejectLabel: string;
};

export type WorkflowDecisionAction = "ACC" | "TOLAK" | "SELESAI";

export function canRoleUseWorkflowAction(
  role: AppRole,
  action: WorkflowDecisionAction,
) {
  if (role === "ADMIN_1") {
    return action === "ACC" || action === "TOLAK" || action === "SELESAI";
  }

  if (role === "ADMIN_5") {
    return action === "TOLAK" || action === "SELESAI";
  }

  if (role === "ADMIN_2" || role === "ADMIN_3" || role === "ADMIN_4") {
    return action === "ACC" || action === "TOLAK";
  }

  return false;
}

export function isWorkflowDescriptionRequired(
  role: AppRole,
  action: WorkflowDecisionAction,
) {
  return (
    action === "TOLAK" ||
    action === "SELESAI" ||
    (action === "ACC" && role === "ADMIN_1")
  );
}

const WORKFLOW_ACTION_PRESENTATIONS: Partial<
  Record<AppRole, WorkflowActionPresentation>
> = {
  ADMIN_1: {
    approveLabel: "Kirim ke K.TU",
    approveClassName: "bg-sky-600 hover:bg-sky-500 focus-visible:ring-sky-300",
    completeLabel: "Selesaikan & Minta Konfirmasi Pelapor",
    completeClassName:
      "bg-teal-700 hover:bg-teal-600 focus-visible:ring-teal-300",
    rejectLabel: "Tolak & Hentikan Proses",
  },
  ADMIN_2: {
    approveLabel: "Setujui & Kirim ke BMN",
    approveClassName:
      "bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-indigo-300",
    rejectLabel: "Tolak & Hentikan Proses",
  },
  ADMIN_3: {
    approveLabel: "Verifikasi & Kirim ke PPK",
    approveClassName:
      "bg-amber-700 hover:bg-amber-600 focus-visible:ring-amber-300",
    rejectLabel: "Tolak & Hentikan Proses",
  },
  ADMIN_4: {
    approveLabel: "Setujui & Kirim ke PP",
    approveClassName:
      "bg-violet-600 hover:bg-violet-500 focus-visible:ring-violet-300",
    rejectLabel: "Tolak & Hentikan Proses",
  },
  ADMIN_5: {
    approveLabel: "Aksi Lanjut PP Tidak Tersedia",
    approveClassName:
      "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-300",
    completeLabel: "Kirim Bukti & Minta Konfirmasi Pelapor",
    completeClassName:
      "bg-blue-700 hover:bg-blue-600 focus-visible:ring-blue-300",
    rejectLabel: "Tolak & Hentikan Proses",
  },
};

const DEFAULT_ACTION_PRESENTATION: WorkflowActionPresentation = {
  approveLabel: "Setujui Tahap Ini",
  approveClassName:
    "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-300",
  rejectLabel: "Tolak & Hentikan Proses",
};

export function getWorkflowActionPresentation(
  role: AppRole,
): WorkflowActionPresentation {
  return WORKFLOW_ACTION_PRESENTATIONS[role] || DEFAULT_ACTION_PRESENTATION;
}

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

export function isReadOnlyExecutive(role?: string | null) {
  return role === "EXECUTIVE";
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

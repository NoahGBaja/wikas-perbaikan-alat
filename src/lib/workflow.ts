import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import {
  getCategoryScopeLabel,
  getRoleLabel,
  isCategoryScopedRole,
} from "@/src/lib/roles";

export type Role = AppRole;
export type WorkflowCategory = AppCategoryScope;

export type ReportStatus =
  | "MENUNGGU_ADMIN_1"
  | "MENUNGGU_ADMIN_2"
  | "MENUNGGU_ADMIN_3"
  | "MENUNGGU_ADMIN_4"
  | "MENUNGGU_ADMIN_5"
  | "DISETUJUI_FINAL"
  | "MENUNGGU_KONFIRMASI"
  | "TELAH_BERFUNGSI"
  | "TIDAK_DAPAT_DIGUNAKAN"
  | "DITOLAK";

export const WAITING_STATUSES = [
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
] as const;

export const FINAL_STATUSES = [
  "TELAH_BERFUNGSI",
  "TIDAK_DAPAT_DIGUNAKAN",
  "DITOLAK",
] as const;

export type ReportDecisionInput = "ACC" | "TOLAK";

export function getRequiredAdminRole(status: ReportStatus): Role | null {
  const map: Partial<Record<ReportStatus, Role>> = {
    MENUNGGU_ADMIN_1: "ADMIN_1",
    MENUNGGU_ADMIN_2: "ADMIN_2",
    MENUNGGU_ADMIN_3: "ADMIN_3",
    MENUNGGU_ADMIN_4: "ADMIN_4",
    MENUNGGU_ADMIN_5: "ADMIN_5",
  };

  return map[status] ?? null;
}

export function canAdminAccessReport(input: {
  role: Role;
  isSuperAdmin?: boolean | null;
  categoryScope?: WorkflowCategory | null;
  reportCategory: WorkflowCategory;
}) {
  if (input.isSuperAdmin || input.role === "SUPER_ADMIN") return true;

  if (!isCategoryScopedRole(input.role)) return true;

  return input.categoryScope === input.reportCategory;
}

export function canRoleDecide(
  role: Role,
  status: ReportStatus,
  reportCategory: WorkflowCategory,
  categoryScope?: WorkflowCategory | null
) {
  const requiredRole = getRequiredAdminRole(status);

  if (!requiredRole) return false;

  if (role === "SUPER_ADMIN" || role === "EXECUTIVE") return false;

  if (role !== requiredRole) return false;

  return canAdminAccessReport({
    role,
    isSuperAdmin: false,
    categoryScope,
    reportCategory,
  });
}

export function getNextApprovedStatus(status: ReportStatus): ReportStatus {
  const map: Partial<Record<ReportStatus, ReportStatus>> = {
    MENUNGGU_ADMIN_1: "MENUNGGU_ADMIN_2",
    MENUNGGU_ADMIN_2: "MENUNGGU_ADMIN_3",
    MENUNGGU_ADMIN_3: "MENUNGGU_ADMIN_4",
    MENUNGGU_ADMIN_4: "MENUNGGU_ADMIN_5",
    MENUNGGU_ADMIN_5: "MENUNGGU_KONFIRMASI",
  };

  const nextStatus = map[status];

  if (!nextStatus) {
    throw new Error("Status laporan sudah final atau tidak valid untuk diterima.");
  }

  return nextStatus;
}

export function getRejectedStatus(): ReportStatus {
  return "DITOLAK";
}

export function isWaitingStatus(status: ReportStatus) {
  return WAITING_STATUSES.some((waitingStatus) => waitingStatus === status);
}

export function isFinalStatus(status: ReportStatus) {
  return FINAL_STATUSES.some((finalStatus) => finalStatus === status);
}

export function getWorkflowMessage(
  role: Role,
  status: ReportStatus,
  reportCategory: WorkflowCategory,
  categoryScope?: WorkflowCategory | null
) {
  const requiredRole = getRequiredAdminRole(status);

  if (status === "DISETUJUI_FINAL" || status === "MENUNGGU_KONFIRMASI") {
    return "Laporan sudah selesai dan menunggu konfirmasi pelapor.";
  }

  if (status === "TELAH_BERFUNGSI") {
    return "Pelapor sudah mengonfirmasi barang telah berfungsi.";
  }

  if (status === "TIDAK_DAPAT_DIGUNAKAN") {
    return "Pelapor mengonfirmasi barang tidak dapat digunakan atau tidak dapat diperbaiki.";
  }

  if (status === "DITOLAK") {
    return "Laporan sudah ditolak dan alur berhenti permanen.";
  }

  if (role === "SUPER_ADMIN") {
    return "Admin Utama hanya memantau. Fitur penggantian keputusan belum diaktifkan.";
  }

  if (role === "EXECUTIVE") {
    return "Kepala Balai memiliki akses baca untuk pemantauan eksekutif.";
  }

  if (!requiredRole) {
    return "Status laporan tidak membutuhkan persetujuan.";
  }

  if (
    role === requiredRole &&
    !canAdminAccessReport({ role, categoryScope, reportCategory })
  ) {
    return `${getRoleLabel(role)} ini hanya bisa menangani kategori ${getCategoryScopeLabel(categoryScope)}. Laporan ini kategori ${getCategoryScopeLabel(reportCategory)}.`;
  }

  if (role !== requiredRole) {
    return `Belum giliran Anda. Laporan ini sedang menunggu ${getRoleLabel(requiredRole)}.`;
  }

  if (role === "ADMIN_1") {
    return "Giliran Anda untuk melanjutkan atau menyelesaikan laporan.";
  }

  if (role === "ADMIN_5") {
    return "Giliran PP untuk menerima, menolak, atau menyelesaikan laporan. Bukti wajib diunggah jika memilih Selesai.";
  }

  return "Giliran Anda untuk melakukan Terima atau Tolak.";
}

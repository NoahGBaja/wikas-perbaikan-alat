import type { AppRole } from "@/src/lib/roles";
import { getRoleLabel } from "@/src/lib/roles";

export type Role = AppRole;

export type ReportStatus =
  | "MENUNGGU_ADMIN_1"
  | "MENUNGGU_ADMIN_2"
  | "MENUNGGU_ADMIN_3"
  | "MENUNGGU_ADMIN_4"
  | "MENUNGGU_ADMIN_5"
  | "MENUNGGU_ADMIN_6"
  | "DISETUJUI_FINAL"
  | "DITOLAK";

export const WAITING_STATUSES = [
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
  "MENUNGGU_ADMIN_6",
] as const;

export const FINAL_STATUSES = ["DISETUJUI_FINAL", "DITOLAK"] as const;

export type ReportDecisionInput = "ACC" | "TOLAK";

export function getRequiredAdminRole(status: ReportStatus): Role | null {
  const map: Partial<Record<ReportStatus, Role>> = {
    MENUNGGU_ADMIN_1: "ADMIN_1",
    MENUNGGU_ADMIN_2: "ADMIN_2",
    MENUNGGU_ADMIN_3: "ADMIN_3",
    MENUNGGU_ADMIN_4: "ADMIN_4",
    MENUNGGU_ADMIN_5: "ADMIN_5",
    MENUNGGU_ADMIN_6: "ADMIN_6",
  };

  return map[status] ?? null;
}

export function canRoleDecide(role: Role, status: ReportStatus) {
  const requiredRole = getRequiredAdminRole(status);

  if (!requiredRole) return false;

  if (role === "SUPER_ADMIN") return false;

  return role === requiredRole;
}

export function getNextApprovedStatus(status: ReportStatus): ReportStatus {
  const map: Partial<Record<ReportStatus, ReportStatus>> = {
    MENUNGGU_ADMIN_1: "MENUNGGU_ADMIN_2",
    MENUNGGU_ADMIN_2: "MENUNGGU_ADMIN_3",
    MENUNGGU_ADMIN_3: "MENUNGGU_ADMIN_4",
    MENUNGGU_ADMIN_4: "MENUNGGU_ADMIN_5",
    MENUNGGU_ADMIN_5: "MENUNGGU_ADMIN_6",
    MENUNGGU_ADMIN_6: "DISETUJUI_FINAL",
  };

  const nextStatus = map[status];

  if (!nextStatus) {
    throw new Error("Status laporan sudah final atau tidak valid untuk ACC.");
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

export function getWorkflowMessage(role: Role, status: ReportStatus) {
  const requiredRole = getRequiredAdminRole(status);

  if (status === "DISETUJUI_FINAL") {
    return "Laporan sudah disetujui final.";
  }

  if (status === "DITOLAK") {
    return "Laporan sudah ditolak dan alur berhenti permanen.";
  }

  if (role === "SUPER_ADMIN") {
    return "Super Admin hanya monitoring. Fitur override belum diaktifkan.";
  }

  if (!requiredRole) {
    return "Status laporan tidak membutuhkan persetujuan.";
  }

  if (role !== requiredRole) {
    return `Belum giliran Anda. Laporan ini sedang menunggu ${getRoleLabel(requiredRole)}.`;
  }

  return "Giliran Anda untuk melakukan ACC atau TOLAK.";
}

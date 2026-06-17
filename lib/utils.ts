import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ReportKategori =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

export type ReportStatus =
  | "MENUNGGU_ADMIN_1"
  | "MENUNGGU_ADMIN_2"
  | "MENUNGGU_ADMIN_3"
  | "MENUNGGU_ADMIN_4"
  | "MENUNGGU_ADMIN_5"
  | "MENUNGGU_ADMIN_6"
  | "DISETUJUI_FINAL"
  | "DITOLAK";

export type ReportSeverity = "RINGAN" | "SEDANG" | "BERAT";

export function formatKategori(kategori: ReportKategori) {
  if (kategori === "FASILITAS_INVENTARIS") return "Fasilitas & Inventaris";
  if (kategori === "IT_ELEKTRONIK") return "IT & Elektronik";
  return "Laboratorium";
}

export function formatStatus(status: ReportStatus) {
  if (status === "MENUNGGU_ADMIN_1") return "Menunggu Admin 1";
  if (status === "MENUNGGU_ADMIN_2") return "Menunggu Admin 2";
  if (status === "MENUNGGU_ADMIN_3") return "Menunggu Admin 3";
  if (status === "MENUNGGU_ADMIN_4") return "Menunggu Admin 4";
  if (status === "MENUNGGU_ADMIN_5") return "Menunggu Admin 5";
  if (status === "MENUNGGU_ADMIN_6") return "Menunggu Admin 6";
  if (status === "DISETUJUI_FINAL") return "Disetujui Final";
  return "Ditolak";
}

export function formatSeverity(severity: ReportSeverity) {
  if (severity === "RINGAN") return "Ringan";
  if (severity === "SEDANG") return "Sedang";
  return "Berat";
}

export function getStatusClass(status: ReportStatus) {
  if (status.startsWith("MENUNGGU_ADMIN")) {
    return "border border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "DISETUJUI_FINAL") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "DITOLAK") {
    return "border border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export function getStatusDescription(status: ReportStatus) {
  if (status === "MENUNGGU_ADMIN_1") {
    return "Laporan baru masuk dan menunggu persetujuan Admin 1.";
  }

  if (status === "MENUNGGU_ADMIN_2") {
    return "Sudah disetujui Admin 1 dan menunggu persetujuan Admin 2.";
  }

  if (status === "MENUNGGU_ADMIN_3") {
    return "Sudah disetujui Admin 2 dan menunggu persetujuan Admin 3.";
  }

  if (status === "MENUNGGU_ADMIN_4") {
    return "Sudah disetujui Admin 3 dan menunggu persetujuan Admin 4.";
  }

  if (status === "MENUNGGU_ADMIN_5") {
    return "Sudah disetujui Admin 4 dan menunggu persetujuan Admin 5.";
  }

  if (status === "MENUNGGU_ADMIN_6") {
    return "Sudah disetujui Admin 5 dan menunggu persetujuan Admin 6.";
  }

  if (status === "DISETUJUI_FINAL") {
    return "Laporan sudah disetujui final oleh seluruh admin.";
  }

  return "Laporan ditolak dan alur berhenti permanen.";
}

export function isApprovedFinalStatus(status: ReportStatus) {
  return status === "DISETUJUI_FINAL";
}

export function isRejectedStatus(status: ReportStatus) {
  return status === "DITOLAK";
}

export function isWaitingApprovalStatus(status: ReportStatus) {
  return status.startsWith("MENUNGGU_ADMIN");
}

export function formatTanggal(value: string | Date | null) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

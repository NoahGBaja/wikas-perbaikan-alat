import { getRoleLabel } from "@/src/lib/roles";

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
  | "DISETUJUI_FINAL"
  | "MENUNGGU_KONFIRMASI"
  | "TELAH_BERFUNGSI"
  | "TIDAK_DAPAT_DIGUNAKAN"
  | "DITOLAK";

export type ReportSeverity = "RINGAN" | "SEDANG" | "BERAT";

export function formatKategori(kategori: ReportKategori) {
  if (kategori === "FASILITAS_INVENTARIS") return "Fasilitas & Inventaris";
  if (kategori === "IT_ELEKTRONIK") return "IT & Elektronik";
  return "Laboratorium";
}

export function formatStatus(status: ReportStatus) {
  if (status === "MENUNGGU_ADMIN_1") return `Menunggu ${getRoleLabel("ADMIN_1")}`;
  if (status === "MENUNGGU_ADMIN_2") return `Menunggu ${getRoleLabel("ADMIN_2")}`;
  if (status === "MENUNGGU_ADMIN_3") return `Menunggu ${getRoleLabel("ADMIN_3")}`;
  if (status === "MENUNGGU_ADMIN_4") return `Menunggu ${getRoleLabel("ADMIN_4")}`;
  if (status === "MENUNGGU_ADMIN_5") return `Menunggu ${getRoleLabel("ADMIN_5")}`;
  if (status === "DISETUJUI_FINAL") return "Disetujui Final";
  if (status === "MENUNGGU_KONFIRMASI") return "Menunggu Konfirmasi Pelapor";
  if (status === "TELAH_BERFUNGSI") return "Telah Berfungsi";
  if (status === "TIDAK_DAPAT_DIGUNAKAN") return "Tidak Dapat Digunakan";
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

  if (status === "DISETUJUI_FINAL" || status === "MENUNGGU_KONFIRMASI") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "TELAH_BERFUNGSI") {
    return "border border-green-200 bg-green-50 text-green-700";
  }

  if (status === "TIDAK_DAPAT_DIGUNAKAN") {
    return "border border-orange-200 bg-orange-50 text-orange-700";
  }

  if (status === "DITOLAK") {
    return "border border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export function getStatusDescription(status: ReportStatus) {
  if (status === "MENUNGGU_ADMIN_1") {
    return `Laporan baru masuk dan menunggu persetujuan ${getRoleLabel("ADMIN_1")}.`;
  }

  if (status === "MENUNGGU_ADMIN_2") {
    return `Sudah disetujui ${getRoleLabel("ADMIN_1")} dan menunggu persetujuan ${getRoleLabel("ADMIN_2")}.`;
  }

  if (status === "MENUNGGU_ADMIN_3") {
    return `Sudah disetujui ${getRoleLabel("ADMIN_2")} dan menunggu persetujuan ${getRoleLabel("ADMIN_3")}.`;
  }

  if (status === "MENUNGGU_ADMIN_4") {
    return `Sudah disetujui ${getRoleLabel("ADMIN_3")} dan menunggu persetujuan ${getRoleLabel("ADMIN_4")}.`;
  }

  if (status === "MENUNGGU_ADMIN_5") {
    return `Sudah disetujui ${getRoleLabel("ADMIN_4")} dan menunggu persetujuan ${getRoleLabel("ADMIN_5")}.`;
  }

  if (status === "DISETUJUI_FINAL") {
    return "Laporan sudah disetujui final oleh seluruh penanggung jawab.";
  }

  if (status === "MENUNGGU_KONFIRMASI") {
    return "Laporan sudah selesai dan menunggu konfirmasi pelapor.";
  }

  if (status === "TELAH_BERFUNGSI") {
    return "Pelapor mengonfirmasi barang telah diterima dan berfungsi.";
  }

  if (status === "TIDAK_DAPAT_DIGUNAKAN") {
    return "Pelapor mengonfirmasi barang tidak dapat digunakan atau tidak dapat diperbaiki.";
  }

  return "Laporan ditolak dan alur berhenti permanen.";
}

export function isApprovedFinalStatus(status: ReportStatus) {
  return (
    status === "DISETUJUI_FINAL" ||
    status === "MENUNGGU_KONFIRMASI" ||
    status === "TELAH_BERFUNGSI"
  );
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

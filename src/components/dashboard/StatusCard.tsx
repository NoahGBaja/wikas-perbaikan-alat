"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import StatusBadge from "./StatusBadge";
import {
  formatKategori,
  formatSeverity,
  formatTanggal,
  type ReportKategori,
  type ReportSeverity,
  type ReportStatus,
} from "@/lib/report-helpers";

export type StatusReportStatus = ReportStatus;

export type StatusReportItem = {
  id: number;
  namaPelapor?: string | null;
  nomorRuangan?: string | null;
  kodeUakpb?: string | null;
  kode?: string | null;
  kategori: ReportKategori;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  severity: ReportSeverity;
  fotoUrl: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  completionPhotoUrl?: string | null;
  status: StatusReportStatus;
  alasanPenolakan: string | null;
  assignedTechnician?: string | null;
  adminNotes?: string | null;
  completionNotes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  processedAt?: string | null;
  finishedAt?: string | null;
  histories?: {
    id: number;
    action: "ACC" | "TOLAK";
    fromStatus: StatusReportStatus;
    toStatus: StatusReportStatus;
    note: string | null;
    createdAt: string;
    admin: {
      nama: string;
      role: string;
    };
  }[];
};

type StatusCardProps = {
  report: StatusReportItem;
  onEdit?: (reportId: number) => void;
  onDelete?: (reportId: number) => void;
  deleting?: boolean;
};

function isWaitingStatus(status: StatusReportStatus) {
  return status.startsWith("MENUNGGU_ADMIN");
}

function getStatusUpdateLabel(report: StatusReportItem) {
  if (report.status === "DISETUJUI_FINAL") {
    return `Disetujui final pada ${formatTanggal(report.approvedAt || null)}`;
  }

  if (report.status === "DITOLAK") {
    return `Ditolak pada ${formatTanggal(report.rejectedAt || null)}`;
  }

  if (isWaitingStatus(report.status)) {
    return `Sedang menunggu approval ${report.status.replace("MENUNGGU_", "").replace("_", " ")}`;
  }

  return "Status laporan tidak diketahui";
}

export default function StatusCard({
  report,
  onEdit,
  onDelete,
  deleting = false,
}: StatusCardProps) {
  const canEditOrDelete = report.status === "MENUNGGU_ADMIN_1";
  const displayAttachmentUrl = report.attachmentUrl || report.fotoUrl;
  const isImageAttachment =
    !!displayAttachmentUrl &&
    (report.attachmentType?.startsWith("image/") || !!report.fotoUrl);

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.08] shadow-[0_20px_50px_rgba(2,6,23,0.18)]">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-slate-950/30 p-4 lg:border-b-0 lg:border-r">
          {displayAttachmentUrl && isImageAttachment ? (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={displayAttachmentUrl}
                alt={report.namaBarang}
                width={1200}
                height={900}
                className="h-full max-h-[320px] w-full object-cover"
                unoptimized
              />
            </div>
          ) : displayAttachmentUrl ? (
            <a
              href={displayAttachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-[240px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-center text-sm text-white/75 transition hover:bg-white/10"
            >
              <FileText className="mb-3 h-8 w-8 text-cyan-100" />
              <span className="font-semibold">Buka Lampiran</span>
              <span className="mt-1 max-w-[240px] truncate text-xs text-white/50">
                {report.attachmentName || "Dokumen PDF"}
              </span>
            </a>
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-white/50">
              Tidak ada lampiran
            </div>
          )}
        </div>

        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/70">
                Laporan #{String(report.id).padStart(4, "0")}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-white">
                {report.namaBarang}
              </h3>
              <p className="mt-2 text-sm text-white/65">
                Dikirim pada {formatTanggal(report.createdAt)}
              </p>
            </div>

            <div className="shrink-0">
              <StatusBadge status={report.status} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Nama Pelapor</p>
              <p className="mt-1 font-semibold text-white">
                {report.namaPelapor || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Nomor Ruangan</p>
              <p className="mt-1 font-semibold text-white">
                {report.nomorRuangan || report.lokasi}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Kode UAKPB</p>
              <p className="mt-1 font-semibold text-white">
                {report.kodeUakpb || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Kode</p>
              <p className="mt-1 font-semibold text-white">
                {report.kode || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Kategori</p>
              <p className="mt-1 font-semibold text-white">
                {formatKategori(report.kategori)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Lokasi</p>
              <p className="mt-1 font-semibold text-white">{report.lokasi}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Tingkat Kerusakan</p>
              <p className="mt-1 font-semibold text-white">
                {formatSeverity(report.severity)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/55">Update Status</p>
              <p className="mt-1 font-semibold text-white">
                {getStatusUpdateLabel(report)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-white/55">Deskripsi Kerusakan</p>
            <p className="mt-2 whitespace-pre-line leading-7 text-white/85">
              {report.deskripsi}
            </p>
          </div>

          {isWaitingStatus(report.status) ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="text-sm font-semibold text-amber-50">
                Sedang Menunggu Approval
              </p>
              <p className="mt-2 leading-7 text-amber-50/90">
                Laporan kamu sedang berada di tahap{" "}
                {report.status.replace("MENUNGGU_", "").replace("_", " ")}.
              </p>
            </div>
          ) : null}

          {report.status === "DITOLAK" && report.alasanPenolakan ? (
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
              <p className="text-sm font-semibold text-rose-100">
                Alasan Penolakan
              </p>
              <p className="mt-2 whitespace-pre-line leading-7 text-rose-50/90">
                {report.alasanPenolakan}
              </p>
            </div>
          ) : null}

          {report.status === "DISETUJUI_FINAL" ? (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">
                Laporan Disetujui Final
              </p>
              <p className="mt-2 leading-7 text-emerald-50/90">
                Laporan kamu sudah disetujui sampai Admin 6.
              </p>
            </div>
          ) : null}

          {report.histories?.length ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">
                Log Approval
              </p>
              <div className="mt-3 space-y-3">
                {report.histories.map((history) => (
                  <div
                    key={history.id}
                    className={[
                      "rounded-2xl border p-3 text-sm",
                      history.action === "TOLAK"
                        ? "border-rose-300/20 bg-rose-400/10 text-rose-50"
                        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-50",
                    ].join(" ")}
                  >
                    <p className="font-semibold">
                      {history.admin.nama} ({history.admin.role}){" "}
                      {history.action === "TOLAK" ? "menolak" : "menyetujui"}{" "}
                      laporan
                    </p>
                    <p className="mt-1 text-white/65">
                      {formatTanggal(history.createdAt)}
                    </p>
                    {history.note ? (
                      <p className="mt-2 whitespace-pre-line leading-6">
                        {history.note}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {canEditOrDelete ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onEdit?.(report.id)}
                className="rounded-2xl border border-cyan-300/18 bg-cyan-400/12 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/18"
              >
                Edit Laporan
              </button>

              <button
                type="button"
                onClick={() => onDelete?.(report.id)}
                disabled={deleting}
                className="rounded-2xl border border-rose-300/18 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Menghapus..." : "Hapus Laporan"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

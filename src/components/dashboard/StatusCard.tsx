"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import StatusBadge from "./StatusBadge";
import {
  formatKategori,
  formatStatus,
  formatTanggal,
  type ReportKategori,
  type ReportStatus,
} from "@/lib/report-helpers";
import { getRoleLabel } from "@/src/lib/roles";

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
    return `Sedang menunggu approval ${formatStatus(report.status)}`;
  }

  return "Status laporan tidak diketahui";
}

function getRejectingAdmin(report: StatusReportItem) {
  return [...(report.histories || [])]
    .reverse()
    .find((history) => history.action === "TOLAK")?.admin;
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
  const rejectingAdmin = getRejectingAdmin(report);

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          {displayAttachmentUrl && isImageAttachment ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
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
              className="flex h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center text-sm text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <FileText className="mb-3 h-8 w-8 text-blue-600" />
              <span className="font-semibold">Buka Lampiran</span>
              <span className="mt-1 max-w-[240px] truncate text-xs text-slate-500">
                {report.attachmentName || "Dokumen PDF"}
              </span>
            </a>
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Tidak ada lampiran
            </div>
          )}
        </div>

        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">
                Laporan #{String(report.id).padStart(4, "0")}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">
                {report.namaBarang}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Dikirim pada {formatTanggal(report.createdAt)}
              </p>
            </div>

            <div className="shrink-0">
              <StatusBadge status={report.status} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Nama Pelapor</p>
              <p className="mt-1 font-semibold text-slate-900">
                {report.namaPelapor || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Kode Ruangan</p>
              <p className="mt-1 font-semibold text-slate-900">
                {report.nomorRuangan || report.lokasi}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Kode UAKPB</p>
              <p className="mt-1 font-semibold text-slate-900">
                {report.kodeUakpb || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Kode</p>
              <p className="mt-1 font-semibold text-slate-900">
                {report.kode || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Kategori</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatKategori(report.kategori)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Lokasi</p>
              <p className="mt-1 font-semibold text-slate-900">{report.lokasi}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Update Status</p>
              <p className="mt-1 font-semibold text-slate-900">
                {getStatusUpdateLabel(report)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Deskripsi Kerusakan</p>
            <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">
              {report.deskripsi}
            </p>
          </div>

          {isWaitingStatus(report.status) ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Sedang Menunggu Approval
              </p>
              <p className="mt-2 leading-7 text-amber-700">
                Laporan kamu sedang berada di tahap{" "}
                {formatStatus(report.status)}.
              </p>
            </div>
          ) : null}

          {report.status === "DITOLAK" && report.alasanPenolakan ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-700">
                Alasan Penolakan
              </p>
              {rejectingAdmin ? (
                <p className="mt-2 text-sm font-semibold text-rose-800">
                  Ditolak oleh {rejectingAdmin.nama}{" "}
                  ({getRoleLabel(rejectingAdmin.role)})
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-line leading-7 text-rose-700">
                {report.alasanPenolakan}
              </p>
            </div>
          ) : null}

          {report.status === "DISETUJUI_FINAL" ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-700">
                Laporan Disetujui Final
              </p>
              <p className="mt-2 leading-7 text-emerald-700">
                Laporan kamu sudah disetujui sampai {getRoleLabel("ADMIN_5")}.
              </p>
            </div>
          ) : null}

          {report.histories?.length ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Log Approval
              </p>
              <div className="mt-3 space-y-3">
                {report.histories.map((history) => (
                  <div
                    key={history.id}
                    className={[
                      "rounded-2xl border p-3 text-sm",
                      history.action === "TOLAK"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                    ].join(" ")}
                  >
                    <p className="font-semibold">
                      {history.admin.nama} ({getRoleLabel(history.admin.role)}){" "}
                      {history.action === "TOLAK" ? "menolak" : "menyetujui"}{" "}
                      laporan
                    </p>
                    <p className="mt-1 text-slate-500">
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
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Edit Laporan
              </button>

              <button
                type="button"
                onClick={() => onDelete?.(report.id)}
                disabled={deleting}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Download, FileText, RotateCcw } from "lucide-react";
import StatusBadge from "./StatusBadge";
import {
  formatKategori,
  formatStatus,
  formatTanggal,
  type ReportKategori,
  type ReportStatus,
} from "@/lib/report-helpers";
import { getRoleLabel } from "@/src/lib/roles";
import { formatRupiah } from "@/src/lib/formatting";
import { formatTicketFallback } from "@/src/lib/tickets";
import { normalizeStoredItemCode } from "@/src/lib/item-code";
import {
  findAttachmentIdForReference,
  formatAttachmentFileSize,
  formatAttachmentPurpose,
  getReportAttachmentUrl,
} from "@/src/lib/report-attachment-urls";

export type StatusReportStatus = ReportStatus;

export type StatusReportItem = {
  id: number;
  ticket?: string | null;
  namaPelapor?: string | null;
  nomorRuangan?: string | null;
  namaRuangan?: string | null;
  kodeUakpb?: string | null;
  kode?: string | null;
  nup?: string | null;
  kategori: ReportKategori;
  subcategory?: string | null;
  itemType?: string | null;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  fotoUrl: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  attachments?: {
    id: number;
    url: string;
    fileType: string;
    fileName: string;
    fileSize: number;
    purpose?: "DAMAGE_EVIDENCE" | "COMPLETION_PROOF" | null;
    uploadedByName?: string | null;
    uploadedByRole?: string | null;
    createdAt?: string;
  }[];
  repairCost?: string | null;
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
  highlighted?: boolean;
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
    return `Sedang menunggu persetujuan ${formatStatus(report.status)}`;
  }

  if (report.status === "MENUNGGU_KONFIRMASI") {
    return "Menunggu konfirmasi kondisi barang dari pelapor";
  }

  if (report.status === "TELAH_BERFUNGSI") {
    return `Dikonfirmasi telah berfungsi pada ${formatTanggal(report.finishedAt || null)}`;
  }

  if (report.status === "TIDAK_DAPAT_DIGUNAKAN") {
    return `Dikonfirmasi tidak dapat digunakan pada ${formatTanggal(report.finishedAt || null)}`;
  }

  return "Status laporan tidak diketahui";
}

function getRejectingAdmin(report: StatusReportItem) {
  return [...(report.histories || [])]
    .reverse()
    .find((history) => history.action === "TOLAK")?.admin;
}

function isPdfUrl(url: string) {
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

export default function StatusCard({
  report,
  highlighted = false,
  onEdit,
  onDelete,
  deleting = false,
}: StatusCardProps) {
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [finalStatus, setFinalStatus] = useState<
    "TELAH_BERFUNGSI" | "TIDAK_DAPAT_DIGUNAKAN"
  >("TELAH_BERFUNGSI");
  const [confirmationDescription, setConfirmationDescription] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const canEditOrDelete = report.status === "MENUNGGU_ADMIN_1";
  const displayAttachmentUrl = report.attachmentUrl || report.fotoUrl;
  const displayAttachmentId = findAttachmentIdForReference(
    report.attachments,
    displayAttachmentUrl,
  );
  const protectedDisplayAttachmentUrl = displayAttachmentUrl
    ? getReportAttachmentUrl(
        report.id,
        displayAttachmentId || "legacy",
        { inline: true },
      )
    : null;
  const protectedCompletionUrl = report.completionPhotoUrl
    ? getReportAttachmentUrl(report.id, "completion", { inline: true })
    : null;
  const ticket = formatTicketFallback(report);
  const attachments =
    report.attachments && report.attachments.length > 0
      ? report.attachments
      : displayAttachmentUrl
        ? [
            {
              id: report.id,
              url: displayAttachmentUrl,
              fileType: report.attachmentType || "",
              fileName: report.attachmentName || "Lampiran laporan",
              fileSize: 0,
              purpose: "DAMAGE_EVIDENCE" as const,
              uploadedByName: report.namaPelapor || null,
              uploadedByRole: "USER",
              createdAt: report.createdAt,
              legacy: true,
            },
          ]
        : [];
  const isImageAttachment =
    !!displayAttachmentUrl &&
    (report.attachmentType?.startsWith("image/") || !!report.fotoUrl);
  const rejectingAdmin = getRejectingAdmin(report);

  async function submitConfirmation() {
    if (
      finalStatus === "TIDAK_DAPAT_DIGUNAKAN" &&
      !confirmationDescription.trim()
    ) {
      setConfirmMessage(
        "Deskripsi wajib diisi jika barang masih tidak dapat digunakan.",
      );
      return;
    }

    try {
      setConfirming(true);
      setConfirmMessage("");

      const res = await fetch(`/api/reports/${report.id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmed: confirmChecked,
          finalStatus,
          description: confirmationDescription,
        }),
      });
      const data = await res.json();

      setConfirmMessage(data.message || "Konfirmasi tersimpan.");

      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error("CONFIRM_REPORT_CLIENT_ERROR:", error);
      setConfirmMessage("Terjadi kesalahan saat menyimpan konfirmasi.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <article
      id={`report-${report.id}`}
      className={`scroll-mt-8 overflow-hidden rounded-[28px] border bg-white/90 shadow-sm transition ${
        highlighted
          ? "border-blue-400 ring-4 ring-blue-100"
          : "border-slate-200"
      }`}
    >
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          {protectedDisplayAttachmentUrl && isImageAttachment ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Image
                src={protectedDisplayAttachmentUrl}
                alt={report.namaBarang}
                width={1200}
                height={900}
                className="h-full max-h-[320px] w-full object-cover"
                unoptimized
              />
            </div>
          ) : protectedDisplayAttachmentUrl ? (
            <a
              href={protectedDisplayAttachmentUrl}
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
                Tiket {ticket}
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
              <p className="text-sm text-slate-500">Ruangan</p>
              <p className="mt-1 font-semibold text-slate-900">
                {report.namaRuangan || report.lokasi}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Kode: {report.nomorRuangan || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Nama Barang</p>
              <p className="mt-1 font-semibold text-slate-900">
                {report.namaBarang || report.kodeUakpb || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Kode Barang</p>
              <p className="mt-1 font-semibold text-slate-900">
                {normalizeStoredItemCode(
                  report.kode || "",
                  report.nup || "",
                ) || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Kategori</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatKategori(report.kategori)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {report.subcategory || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Lokasi</p>
              <p className="mt-1 font-semibold text-slate-900">{report.lokasi}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Pembaruan Status</p>
              <p className="mt-1 font-semibold text-slate-900">
                {getStatusUpdateLabel(report)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Biaya Perbaikan / Anggaran</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatRupiah(report.repairCost)}
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
                Sedang Menunggu Persetujuan
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

          {report.status === "MENUNGGU_KONFIRMASI" ? (
            <div className="mt-5 rounded-2xl border border-slate-300 bg-slate-100 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Konfirmasi Penerimaan Barang
              </p>
              <label className="mt-3 flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => setConfirmChecked(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-slate-600"
                />
                Saya mengonfirmasi barang telah diterima kembali.
              </label>
              <select
                value={finalStatus}
                onChange={(event) =>
                  setFinalStatus(
                    event.target.value as
                      | "TELAH_BERFUNGSI"
                      | "TIDAK_DAPAT_DIGUNAKAN",
                  )
                }
                className="mt-3 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="TELAH_BERFUNGSI">Telah Berfungsi</option>
                <option value="TIDAK_DAPAT_DIGUNAKAN">
                  Tidak Dapat Digunakan / Tidak Dapat Diperbaiki
                </option>
              </select>
              {finalStatus === "TIDAK_DAPAT_DIGUNAKAN" ? (
                <textarea
                  value={confirmationDescription}
                  onChange={(event) =>
                    setConfirmationDescription(event.target.value)
                  }
                  rows={4}
                  placeholder="Jelaskan kondisi barang yang masih bermasalah..."
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              ) : null}
              {confirmMessage ? (
                <p className="mt-3 text-sm text-slate-700">{confirmMessage}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void submitConfirmation()}
                disabled={confirming}
                className="mt-3 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-60"
              >
                {confirming ? "Menyimpan..." : "Kirim Konfirmasi"}
              </button>
            </div>
          ) : null}

          {report.status === "TIDAK_DAPAT_DIGUNAKAN" ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Barang masih belum dapat digunakan?
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Buat request baru memakai data laporan ini. Periksa kembali
                informasinya dan unggah lampiran kondisi terbaru sebelum mengirim.
              </p>
              <Link
                href={`/dashboard/user/report?repeat=${report.id}`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                <RotateCcw className="h-4 w-4" />
                Kirim Ulang Request
              </Link>
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                Unduh Lampiran
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.id}-${attachment.url}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      {formatAttachmentPurpose(attachment.purpose)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {attachment.fileName || `Lampiran ${index + 1}`}
                    </p>
                    <dl className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs leading-5">
                      <dt className="text-slate-500">Diunggah oleh</dt>
                      <dd className="font-semibold text-slate-800">
                        {attachment.uploadedByName || "Metadata lama tidak tersedia"}
                      </dd>
                      <dt className="text-slate-500">Peran</dt>
                      <dd className="font-semibold text-slate-800">
                        {attachment.uploadedByRole
                          ? getRoleLabel(attachment.uploadedByRole)
                          : "Tidak tersedia"}
                      </dd>
                      <dt className="text-slate-500">Waktu unggah</dt>
                      <dd className="font-semibold text-slate-800">
                        {attachment.createdAt
                          ? formatTanggal(attachment.createdAt)
                          : "Tidak tersedia"}
                      </dd>
                      <dt className="text-slate-500">Format</dt>
                      <dd className="break-all font-semibold text-slate-800">
                        {attachment.fileType || "Tidak tersedia"}
                      </dd>
                      <dt className="text-slate-500">Ukuran</dt>
                      <dd className="font-semibold text-slate-800">
                        {formatAttachmentFileSize(attachment.fileSize)}
                      </dd>
                    </dl>
                    <a
                      href={`/api/reports/${report.id}/attachments/${
                        "legacy" in attachment ? "legacy" : attachment.id
                      }/download`}
                      download
                      className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-600"
                    >
                      <Download className="h-4 w-4" />
                      Unduh lampiran
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {report.completionPhotoUrl ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                Bukti Penyelesaian
              </p>
              {isPdfUrl(report.completionPhotoUrl) ? (
                <a
                  href={protectedCompletionUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex min-h-28 flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-center text-sm text-emerald-700 transition hover:bg-emerald-100"
                >
                  <FileText className="mb-2 h-7 w-7" />
                  <span className="font-semibold">Buka Bukti PDF</span>
                </a>
              ) : (
                <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-100">
                  <Image
                    src={protectedCompletionUrl || ""}
                    alt="Bukti penyelesaian"
                    width={1200}
                    height={900}
                    className="max-h-[320px] w-full object-cover"
                    unoptimized
                  />
                </div>
              )}
            </div>
          ) : null}

          {report.histories?.length ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Log Persetujuan
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

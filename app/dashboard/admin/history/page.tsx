"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  XCircle,
  ArrowLeft,
  Clock3,
} from "lucide-react";
import {
  formatKategori,
  formatTanggal,
  formatSeverity,
  formatStatus,
  getStatusClass,
  type ReportKategori,
  type ReportSeverity,
  type ReportStatus,
} from "@/lib/report-helpers";
import type { AppRole } from "@/src/lib/roles";

type ReportHistoryItem = {
  id: number;
  action: "ACC" | "TOLAK";
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string | null;
  createdAt: string;
  admin: {
    id: number;
    nama: string;
    jabatan: string | null;
    nip: string | null;
    role: AppRole;
  };
};

type ReportItem = {
  id: number;
  kategori: ReportKategori;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  severity: ReportSeverity;
  fotoUrl: string | null;
  completionPhotoUrl?: string | null;
  status: ReportStatus;
  alasanPenolakan: string | null;
  assignedTechnician?: string | null;
  adminNotes?: string | null;
  completionNotes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  processedAt?: string | null;
  finishedAt?: string | null;
  histories?: ReportHistoryItem[];
  user: {
    id: number;
    nama: string;
    jabatan?: string | null;
    nip: string | null;
  };
};

function isHistoryStatus(status: ReportStatus) {
  return status === "DISETUJUI_FINAL" || status === "DITOLAK";
}

function isWaitingStatus(status: ReportStatus) {
  return status.startsWith("MENUNGGU_ADMIN");
}

export default function AdminHistoryPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadHistory() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/reports/admin", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Gagal memuat riwayat laporan.");
        return;
      }

      const filtered = (data.reports || []).filter((item: ReportItem) =>
        isHistoryStatus(item.status),
      );

      setReports(filtered);
    } catch (error) {
      console.error("LOAD_ADMIN_HISTORY_ERROR:", error);
      setMessage("Terjadi kesalahan saat memuat riwayat laporan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  const approvedFinalCount = reports.filter(
    (r) => r.status === "DISETUJUI_FINAL",
  ).length;
  const rejectedCount = reports.filter((r) => r.status === "DITOLAK").length;
  const waitingCount = reports.filter((r) => isWaitingStatus(r.status)).length;
  const totalCount = reports.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Admin Panel
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-5xl">
              Riwayat Laporan
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Arsip laporan yang sudah selesai dalam alur approval: disetujui
              final atau ditolak permanen.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard/admin")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600" />
            Kembali ke Dashboard
          </button>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Riwayat"
            value={totalCount}
            description="Laporan final dan ditolak."
            colorClass="text-blue-600"
          />

          <SummaryCard
            label="Disetujui Final"
            value={approvedFinalCount}
            description="Sudah melewati Admin 1 sampai Admin 6."
            colorClass="text-emerald-600"
          />

          <SummaryCard
            label="Ditolak"
            value={rejectedCount}
            description="Ditolak oleh salah satu admin."
            colorClass="text-rose-600"
          />

          <SummaryCard
            label="Masih Berjalan"
            value={waitingCount}
            description="Tidak ditampilkan di arsip final."
            colorClass="text-amber-600"
          />
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white/90 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-2xl font-bold text-slate-900">
              Arsip Laporan
            </h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-slate-600">
              Memuat riwayat laporan...
            </div>
          ) : reports.length === 0 ? (
            <div className="px-6 py-8 text-slate-600">
              Belum ada riwayat laporan final.
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold tracking-wide text-blue-700">
                          LP-{String(report.id).padStart(4, "0")}
                        </span>

                        <span
                          className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold tracking-[0.16em] ${getStatusClass(
                            report.status,
                          )}`}
                        >
                          {formatStatus(report.status)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-bold text-slate-900">
                        {report.namaBarang}
                      </h3>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <InfoBox label="Pelapor">
                          <p className="mt-1 font-semibold text-slate-900">
                            {report.user.nama}
                          </p>
                          {report.user.jabatan ? (
                            <p className="mt-1 text-sm text-slate-500">
                              {report.user.jabatan}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm text-slate-500">
                            NIP: {report.user.nip || "-"}
                          </p>
                        </InfoBox>

                        <InfoBox label="Kategori">
                          {formatKategori(report.kategori)}
                        </InfoBox>

                        <InfoBox label="Lokasi">{report.lokasi}</InfoBox>

                        <InfoBox label="Tingkat Kerusakan">
                          {formatSeverity(report.severity)}
                        </InfoBox>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">
                          Deskripsi Kerusakan
                        </p>
                        <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">
                          {report.deskripsi}
                        </p>
                      </div>

                      {report.status === "DITOLAK" && report.alasanPenolakan ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                          <p className="text-sm font-semibold text-rose-700">
                            Alasan Penolakan
                          </p>
                          <p className="mt-2 text-rose-700">
                            {report.alasanPenolakan}
                          </p>
                        </div>
                      ) : null}

                      {report.adminNotes ? (
                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-semibold text-blue-700">
                            Catatan Admin Terakhir
                          </p>
                          <p className="mt-2 whitespace-pre-line text-blue-700">
                            {report.adminNotes}
                          </p>
                        </div>
                      ) : null}

                      {report.histories?.length ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Riwayat Approval
                          </p>
                          <div className="mt-3 space-y-3">
                            {report.histories.map((history) => (
                              <div
                                key={history.id}
                                className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                              >
                                <p className="font-semibold text-slate-900">
                                  {history.admin.nama} ({history.admin.role}) •{" "}
                                  {history.action}
                                </p>
                                <p className="mt-1 text-slate-500">
                                  {formatStatus(history.fromStatus)} →{" "}
                                  {formatStatus(history.toStatus)}
                                </p>
                                {history.note ? (
                                  <p className="mt-2 whitespace-pre-line text-slate-700">
                                    {history.note}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs text-slate-400">
                                  {formatTanggal(history.createdAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full lg:max-w-[320px]">
                      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="mb-3 text-sm text-slate-500">
                          Foto Barang
                        </p>

                        {report.fotoUrl ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200">
                            <Image
                              src={report.fotoUrl}
                              alt={report.namaBarang}
                              width={1200}
                              height={800}
                              className="w-full object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                            Tidak ada foto
                          </div>
                        )}

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <CalendarDays className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">
                                Tanggal Laporan
                              </p>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatTanggal(report.createdAt)}
                              </p>
                            </div>
                          </div>

                          {report.approvedAt ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <div>
                                <p className="text-xs text-emerald-600">
                                  Disetujui Final
                                </p>
                                <p className="text-sm font-semibold text-emerald-700">
                                  {formatTanggal(report.approvedAt)}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {report.rejectedAt ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                              <XCircle className="h-4 w-4 text-rose-600" />
                              <div>
                                <p className="text-xs text-rose-600">
                                  Ditolak
                                </p>
                                <p className="text-sm font-semibold text-rose-700">
                                  {formatTanggal(report.rejectedAt)}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {!report.approvedAt && !report.rejectedAt ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                              <Clock3 className="h-4 w-4 text-amber-600" />
                              <div>
                                <p className="text-xs text-amber-600">
                                  Status
                                </p>
                                <p className="text-sm font-semibold text-amber-700">
                                  {formatStatus(report.status)}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {report.status === "DISETUJUI_FINAL" ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                              <div>
                                <p className="text-xs text-emerald-600">
                                  Final
                                </p>
                                <p className="text-sm font-semibold text-emerald-700">
                                  Approval selesai.
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  colorClass,
}: {
  label: string;
  value: number;
  description: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-5xl font-extrabold ${colorClass}`}>{value}</p>
      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InfoBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-1 font-semibold text-slate-900">{children}</div>
    </div>
  );
}
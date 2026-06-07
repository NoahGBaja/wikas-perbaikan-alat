"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  History,
  KeyRound,
  LogOut,
  UserCog,
  X,
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
import { canRoleDecide, getWorkflowMessage } from "@/src/lib/workflow";

type AdminDashboardProps = {
  currentUser: {
    id: number;
    nama: string;
    jabatan: string | null;
    nip: string | null;
    role: AppRole;
  };
  title?: string;
};

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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isWaitingStatus(status: ReportStatus) {
  return status.startsWith("MENUNGGU_ADMIN");
}

export default function AdminDashboard({
  currentUser,
  title = "Dashboard Laporan Kerusakan Barang & Alat",
}: AdminDashboardProps) {
  const router = useRouter();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      const res = await fetch("/api/reports/admin", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Gagal memuat laporan.");
        return;
      }

      setReports(data.reports || []);
    } catch (error) {
      console.error("LOAD_ADMIN_REPORTS_ERROR:", error);
      setMessage("Terjadi kesalahan saat memuat laporan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleLogout() {
    const res = await fetch("/api/logout", { method: "POST" });

    if (!res.ok) {
      setMessage("Logout gagal.");
      return;
    }

    router.push("/login");
    router.refresh();
  }

  function openReportDetail(report: ReportItem) {
    setSelectedReport(report);
    setDecisionNote(report.adminNotes || report.alasanPenolakan || "");
    setMessage("");
  }

  function closeReportDetail() {
    setSelectedReport(null);
    setDecisionNote("");
  }

  async function submitDecision(action: "ACC" | "TOLAK") {
    if (!selectedReport) return;

    if (action === "TOLAK" && !decisionNote.trim()) {
      setMessage("Alasan penolakan wajib diisi.");
      return;
    }

    try {
      setSubmitLoading(true);

      const res = await fetch(`/api/reports/${selectedReport.id}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          note: decisionNote,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Gagal memperbarui status laporan.");
        return;
      }

      setMessage(data.message || "Status laporan berhasil diperbarui.");
      closeReportDetail();
      await loadReports();
    } catch (error) {
      console.error("SUBMIT_DECISION_ERROR:", error);
      setMessage("Terjadi kesalahan saat memperbarui status laporan.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const summary = useMemo(
    () => ({
      total: reports.length,
      menunggu: reports.filter((report) => isWaitingStatus(report.status)).length,
      final: reports.filter((report) => report.status === "DISETUJUI_FINAL").length,
      ditolak: reports.filter((report) => report.status === "DITOLAK").length,
      giliranSaya: reports.filter((report) =>
        canRoleDecide(currentUser.role, report.status),
      ).length,
    }),
    [reports, currentUser.role],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Admin Panel
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Semua admin dapat melihat laporan. Tombol ACC/TOLAK hanya aktif
              untuk admin yang sesuai dengan status approval saat ini.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin/history")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <History className="h-4 w-4 text-blue-600" />
              Riwayat
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/admin/statistik")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Statistik
            </button>

            {currentUser.role === "SUPER_ADMIN" ? (
              <button
                type="button"
                onClick={() => router.push("/dashboard/admin/users")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
              >
                <UserCog className="h-4 w-4 text-blue-600" />
                Kelola User
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => router.push("/dashboard/account")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <KeyRound className="h-4 w-4 text-blue-600" />
              Akun
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-3 font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm xl:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Admin Aktif
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 font-semibold text-blue-700">
                {getInitials(currentUser.nama) || "AD"}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{currentUser.nama}</p>
                <p className="text-sm text-slate-500">
                  {currentUser.jabatan || "Admin Sistem"}
                </p>
                <p className="text-xs text-slate-400">
                  {currentUser.role} • NIP: {currentUser.nip || "-"}
                </p>
              </div>
            </div>
          </div>

          {[
            ["Total", summary.total, "Semua laporan.", "text-blue-600"],
            ["Menunggu", summary.menunggu, "Masih dalam approval.", "text-amber-600"],
            [
              "Giliran Saya",
              summary.giliranSaya,
              "Butuh keputusan Anda.",
              "text-emerald-600",
            ],
            ["Final", summary.final, "Disetujui semua admin.", "text-purple-600"],
            ["Ditolak", summary.ditolak, "Alur berhenti permanen.", "text-rose-600"],
          ].map(([label, value, description, numberColor]) => (
            <div
              key={String(label)}
              className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                {label}
              </p>
              <p className={`mt-3 text-5xl font-extrabold ${numberColor}`}>
                {value}
              </p>
              <p className="mt-3 text-sm text-slate-500">{description}</p>
            </div>
          ))}
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white/90 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-2xl font-bold text-slate-900">Laporan Masuk</h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-slate-600">Memuat laporan...</div>
          ) : reports.length === 0 ? (
            <div className="px-6 py-8 text-slate-600">
              Belum ada laporan masuk.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      ID
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Pelapor
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Barang
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Kategori
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Status
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Giliran
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {reports.map((report) => {
                    const canDecide = canRoleDecide(
                      currentUser.role,
                      report.status,
                    );

                    return (
                      <tr
                        key={report.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50/50"
                      >
                        <td className="px-6 py-5">
                          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold tracking-wide text-blue-700">
                            LP-{String(report.id).padStart(4, "0")}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-semibold text-slate-900">
                            {report.user.nama}
                          </p>
                          <p className="text-sm text-slate-500">
                            NIP: {report.user.nip || "-"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {report.namaBarang}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {formatKategori(report.kategori)}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold tracking-[0.16em] ${getStatusClass(
                              report.status,
                            )}`}
                          >
                            {formatStatus(report.status)}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          {canDecide ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              Giliran Anda
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            <CalendarDays className="h-4 w-4 text-slate-400" />
                            {formatTanggal(report.createdAt)}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => openReportDetail(report)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedReport ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            onClick={closeReportDetail}
          >
            <div
              className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Detail Laporan
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {getWorkflowMessage(currentUser.role, selectedReport.status)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeReportDetail}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.9fr]">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold tracking-wide text-blue-700">
                        LP-{String(selectedReport.id).padStart(4, "0")}
                      </span>

                      <span
                        className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold tracking-[0.16em] ${getStatusClass(
                          selectedReport.status,
                        )}`}
                      >
                        {formatStatus(selectedReport.status)}
                      </span>
                    </div>

                    <h4 className="mt-4 text-2xl font-bold text-slate-900">
                      {selectedReport.namaBarang}
                    </h4>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <InfoBox label="Pelapor">
                        <p className="mt-1 font-semibold text-slate-900">
                          {selectedReport.user.nama}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          NIP: {selectedReport.user.nip || "-"}
                        </p>
                      </InfoBox>

                      <InfoBox label="Kategori">
                        {formatKategori(selectedReport.kategori)}
                      </InfoBox>

                      <InfoBox label="Severity">
                        {formatSeverity(selectedReport.severity)}
                      </InfoBox>

                      <InfoBox label="Lokasi">
                        {selectedReport.lokasi}
                      </InfoBox>

                      <InfoBox label="Tanggal">
                        {formatTanggal(selectedReport.createdAt)}
                      </InfoBox>

                      <InfoBox label="Status">
                        {formatStatus(selectedReport.status)}
                      </InfoBox>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Deskripsi Kerusakan
                      </p>
                      <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">
                        {selectedReport.deskripsi}
                      </p>
                    </div>

                    {selectedReport.alasanPenolakan ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-sm font-semibold text-rose-700">
                          Alasan Penolakan
                        </p>
                        <p className="mt-2 text-rose-700">
                          {selectedReport.alasanPenolakan}
                        </p>
                      </div>
                    ) : null}

                    {selectedReport.adminNotes ? (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-700">
                          Catatan Admin Terakhir
                        </p>
                        <p className="mt-2 whitespace-pre-line text-blue-700">
                          {selectedReport.adminNotes}
                        </p>
                      </div>
                    ) : null}

                    {selectedReport.histories?.length ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">
                          Riwayat Approval
                        </p>
                        <div className="mt-3 space-y-3">
                          {selectedReport.histories.map((history) => (
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
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-sm text-slate-500">Foto Barang</p>
                    {selectedReport.fotoUrl ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <Image
                          src={selectedReport.fotoUrl}
                          alt={selectedReport.namaBarang}
                          width={1200}
                          height={800}
                          className="w-full object-cover"
                          preload
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                        Tidak ada foto awal
                      </div>
                    )}
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">Keputusan Admin</p>

                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        {getWorkflowMessage(currentUser.role, selectedReport.status)}
                      </div>

                      {canRoleDecide(currentUser.role, selectedReport.status) ? (
                        <>
                          <textarea
                            value={decisionNote}
                            onChange={(event) => setDecisionNote(event.target.value)}
                            rows={5}
                            placeholder="Catatan admin / alasan penolakan..."
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void submitDecision("ACC")}
                              disabled={submitLoading}
                              className="rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {submitLoading ? "Memproses..." : "ACC"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void submitDecision("TOLAK")}
                              disabled={submitLoading}
                              className="rounded-2xl bg-rose-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-rose-400 disabled:opacity-60"
                            >
                              {submitLoading ? "Memproses..." : "TOLAK"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          Tombol ACC/TOLAK tidak tersedia untuk role Anda pada
                          status laporan ini.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
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
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Database,
  Download,
  FileText,
  History,
  KeyRound,
  LogOut,
  UserCog,
  X,
} from "lucide-react";
import {
  formatKategori,
  formatTanggal,
  formatStatus,
  getStatusClass,
  type ReportKategori,
  type ReportStatus,
} from "@/lib/report-helpers";
import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import { getCategoryScopeLabel, getRoleLabel } from "@/src/lib/roles";
import { canRoleDecide, getWorkflowMessage } from "@/src/lib/workflow";
import { formatRupiah } from "@/src/lib/formatting";
import { formatTicketFallback } from "@/src/lib/tickets";
import NotificationBell from "@/src/components/notifications/NotificationBell";
import {
  FeedbackBanner,
  showError,
  showSuccess,
  toFeedback,
  type FeedbackMessage,
} from "@/src/components/ui/feedback";

type AdminDashboardProps = {
  currentUser: {
    id: number;
    nama: string;
    jabatan: string | null;
    nip: string | null;
    role: AppRole;
    isSuperAdmin: boolean;
    categoryScope: AppCategoryScope | null;
  };
  title?: string;
};

const REPORT_PAGE_SIZE = 50;
const MAX_COMPLETION_PROOF_SIZE = 2 * 1024 * 1024;
const ALLOWED_COMPLETION_PROOF_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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
    categoryScope: AppCategoryScope | null;
  };
};

type ReportItem = {
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
  }[];
  repairCost?: string | null;
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

const DEFAULT_MESSAGE_TEMPLATES = [
  { label: "Persetujuan", value: "Laporan diterima dan dapat dilanjutkan ke tahap berikutnya." },
  { label: "Penolakan", value: "Laporan ditolak karena data atau kondisi belum memenuhi persyaratan." },
  { label: "Catatan", value: "Mohon lengkapi informasi tambahan agar proses dapat dilanjutkan." },
  { label: "Penyelesaian", value: "Perbaikan telah selesai dilakukan. Mohon pelapor melakukan konfirmasi penerimaan barang." },
];

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

function getRejectingAdmin(report: ReportItem) {
  return [...(report.histories || [])]
    .reverse()
    .find((history) => history.action === "TOLAK")?.admin;
}

function isPdfUrl(url: string) {
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

export default function AdminDashboard({
  currentUser,
  title = "Dasbor Laporan Kerusakan Barang & Alat",
}: AdminDashboardProps) {
  const router = useRouter();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionRepairCost, setDecisionRepairCost] = useState("");
  const [completionProof, setCompletionProof] = useState<File | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [visibleReportLimit, setVisibleReportLimit] = useState(REPORT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState("SEMUA");
  const [categoryFilter, setCategoryFilter] = useState("SEMUA");
  const [subcategoryFilter, setSubcategoryFilter] = useState("SEMUA");
  const [picFilter, setPicFilter] = useState("SEMUA");
  const [budgetFilter, setBudgetFilter] = useState("SEMUA");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [messageTemplates, setMessageTemplates] = useState(DEFAULT_MESSAGE_TEMPLATES);

  async function loadReports() {
    try {
      setLoading(true);
      const res = await fetch("/api/reports/admin", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        const text = data.message || "Gagal memuat laporan.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal memuat laporan", text);
        return;
      }

      setReports(data.reports || []);
      setVisibleReportLimit(REPORT_PAGE_SIZE);
    } catch (error) {
      console.error("LOAD_ADMIN_REPORTS_ERROR:", error);
      const text = "Terjadi kesalahan saat memuat laporan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal memuat laporan", text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  useEffect(() => {
    async function loadMessageTemplates() {
      try {
        const res = await fetch("/api/master-data", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok || !Array.isArray(data.messageTemplates)) return;

        setMessageTemplates(
          data.messageTemplates.map((template: { title: string; body: string }) => ({
            label: template.title,
            value: template.body,
          })),
        );
      } catch (error) {
        console.error("LOAD_MESSAGE_TEMPLATES_ERROR:", error);
      }
    }

    void loadMessageTemplates();
  }, []);

  async function handleLogout() {
    const res = await fetch("/api/logout", { method: "POST" });

    if (!res.ok) {
      const text = "Keluar gagal.";
      setMessage(toFeedback(text, "error"));
      showError("Keluar gagal", text);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  function openReportDetail(report: ReportItem) {
    setSelectedReport(report);
    setDecisionNote(report.adminNotes || report.alasanPenolakan || "");
    setDecisionRepairCost(report.repairCost || "");
    setCompletionProof(null);
    setMessage(null);
  }

  function closeReportDetail() {
    setSelectedReport(null);
    setDecisionNote("");
    setDecisionRepairCost("");
    setCompletionProof(null);
  }

  async function submitDecision(action: "ACC" | "TOLAK" | "SELESAI") {
    if (!selectedReport) return;

    if (action === "TOLAK" && !decisionNote.trim()) {
      const text = "Alasan penolakan wajib diisi.";
      setMessage(toFeedback(text, "error"));
      showError("Catatan wajib diisi", text);
      return;
    }

    if (action === "SELESAI" && !decisionNote.trim()) {
      const text = "Deskripsi penyelesaian wajib diisi.";
      setMessage(toFeedback(text, "error"));
      showError("Deskripsi wajib diisi", text);
      return;
    }

    if (
      action === "SELESAI" &&
      completionProof &&
      !ALLOWED_COMPLETION_PROOF_TYPES.has(completionProof.type)
    ) {
      const text = "Bukti penyelesaian harus berupa JPG, PNG, WEBP, atau PDF.";
      setMessage(toFeedback(text, "error"));
      showError("Bukti tidak valid", text);
      return;
    }

    if (
      action === "SELESAI" &&
      completionProof &&
      completionProof.size > MAX_COMPLETION_PROOF_SIZE
    ) {
      const text = "Bukti penyelesaian maksimal 2MB.";
      setMessage(toFeedback(text, "error"));
      showError("Bukti terlalu besar", text);
      return;
    }

    try {
      setSubmitLoading(true);

      const requestInit: RequestInit = {
        method: "POST",
      };

      if (action === "SELESAI") {
        const formData = new FormData();
        formData.set("action", action);
        formData.set("note", decisionNote);
        formData.set("proof", completionProof!);
        if (currentUser.role === "ADMIN_5") {
          formData.set("repairCost", decisionRepairCost.replace(/\D/g, ""));
        }
        requestInit.body = formData;
      } else {
        requestInit.headers = {
          "Content-Type": "application/json",
        };
        requestInit.body = JSON.stringify({
          action,
          note: decisionNote,
          repairCost:
            currentUser.role === "ADMIN_5"
              ? decisionRepairCost.replace(/\D/g, "")
              : undefined,
        });
      }

      const res = await fetch(`/api/reports/${selectedReport.id}/decide`, {
        ...requestInit,
      });

      const data = await res.json();

      if (!res.ok) {
        const text = data.message || "Gagal memperbarui status laporan.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal memperbarui laporan", text);
        return;
      }

      const text = data.message || "Status laporan berhasil diperbarui.";
      setMessage(toFeedback(text, "success"));
      showSuccess("Laporan diperbarui", text);
      closeReportDetail();
      await loadReports();
    } catch (error) {
      console.error("SUBMIT_DECISION_ERROR:", error);
      const text = "Terjadi kesalahan saat memperbarui status laporan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal memperbarui laporan", text);
    } finally {
      setSubmitLoading(false);
    }
  }

  const summary = useMemo(
    () => ({
      total: reports.length,
      menunggu: reports.filter((report) => isWaitingStatus(report.status)).length,
      final: reports.filter((report) =>
        ["MENUNGGU_KONFIRMASI", "TELAH_BERFUNGSI"].includes(report.status),
      ).length,
      ditolak: reports.filter((report) => report.status === "DITOLAK").length,
    }),
    [reports],
  );

  const selectedReportRejectingAdmin = selectedReport
    ? getRejectingAdmin(selectedReport)
    : null;
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter !== "SEMUA" && report.status !== statusFilter) return false;
      if (categoryFilter !== "SEMUA" && report.kategori !== categoryFilter) return false;
      if (subcategoryFilter !== "SEMUA" && (report.subcategory || "-") !== subcategoryFilter) return false;
      if (picFilter !== "SEMUA" && String(report.user.id) !== picFilter) return false;

      const createdAt = new Date(report.createdAt);
      if (dateFrom && createdAt < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && createdAt > new Date(`${dateTo}T23:59:59`)) return false;

      const budget = Number(report.repairCost || 0);
      if (budgetFilter === "BELOW_5" && !(budget < 5000000)) return false;
      if (budgetFilter === "BETWEEN_5_10" && !(budget >= 5000000 && budget <= 10000000)) return false;
      if (budgetFilter === "ABOVE_10" && !(budget > 10000000)) return false;

      return true;
    });
  }, [budgetFilter, categoryFilter, dateFrom, dateTo, picFilter, reports, statusFilter, subcategoryFilter]);
  const visibleReports = useMemo(
    () => filteredReports.slice(0, visibleReportLimit),
    [filteredReports, visibleReportLimit],
  );
  const hiddenReportCount = Math.max(filteredReports.length - visibleReports.length, 0);
  const subcategoryOptions = Array.from(new Set(reports.map((report) => report.subcategory || "-")));
  const picOptions = Array.from(
    new Map(reports.map((report) => [report.user.id, report.user])).values(),
  );
  const isExecutive = currentUser.role === "EXECUTIVE";

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-8 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Panel Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              {isExecutive
                ? "Akses Kepala Balai hanya untuk melihat tren dan ringkasan laporan."
                : "Semua admin dapat melihat laporan. Tombol tindakan hanya aktif untuk admin yang sesuai dengan tahap persetujuan saat ini."}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <NotificationBell />

            <button
              type="button"
              onClick={() => router.push("/dashboard/admin/history")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <History className="h-4 w-4 text-blue-600" />
              Riwayat
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/admin/statistik")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Statistik
            </button>

            {currentUser.isSuperAdmin || currentUser.role === "SUPER_ADMIN" ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/admin/master-data")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
                >
                  <Database className="h-4 w-4 text-blue-600" />
                  Master Data
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/admin/users")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
                >
                  <UserCog className="h-4 w-4 text-blue-600" />
                  Kelola Pengguna
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => router.push("/dashboard/account")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <KeyRound className="h-4 w-4 text-blue-600" />
              Akun
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-3 font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </header>

        <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-blue-50/40 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-sm font-semibold text-blue-700">
                  {getInitials(currentUser.nama) || "AD"}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {currentUser.nama}
                  </p>
                  <p className="text-sm text-slate-500">
                    {getRoleLabel(currentUser.role)} - NIP:{" "}
                    {currentUser.nip || "-"}
                  </p>
                  {currentUser.categoryScope ? (
                    <p className="mt-1 text-xs font-medium text-blue-600">
                      Kategori: {getCategoryScopeLabel(currentUser.categoryScope)}
                    </p>
                  ) : null}
                </div>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 lg:grid-cols-4 lg:divide-y-0">
            {[
              {
                label: "Total",
                value: summary.total,
                valueClass: "text-blue-700",
                dotClass: "bg-blue-500",
              },
              {
                label: "Menunggu",
                value: summary.menunggu,
                valueClass: "text-amber-700",
                dotClass: "bg-amber-500",
              },
              {
                label: "Final",
                value: summary.final,
                valueClass: "text-indigo-700",
                dotClass: "bg-indigo-500",
              },
              {
                label: "Ditolak",
                value: summary.ditolak,
                valueClass: "text-rose-700",
                dotClass: "bg-rose-500",
              },
            ].map((item) => (
              <div key={item.label} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${item.dotClass}`} />
                  <p className="text-sm text-slate-500">{item.label}</p>
                </div>
                <p className={`mt-1 text-2xl font-semibold ${item.valueClass}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <FeedbackBanner message={message} className="mb-6" />

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="SEMUA">Semua Status</option>
              {[
                "MENUNGGU_ADMIN_1",
                "MENUNGGU_ADMIN_2",
                "MENUNGGU_ADMIN_3",
                "MENUNGGU_ADMIN_4",
                "MENUNGGU_ADMIN_5",
                "MENUNGGU_KONFIRMASI",
                "TELAH_BERFUNGSI",
                "TIDAK_DAPAT_DIGUNAKAN",
                "DITOLAK",
              ].map((status) => (
                <option key={status} value={status}>{formatStatus(status as ReportStatus)}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="SEMUA">Semua Kategori</option>
              <option value="FASILITAS_INVENTARIS">Inventaris</option>
              <option value="IT_ELEKTRONIK">IT & Elektronik</option>
              <option value="LABORATORIUM">Laboratorium</option>
            </select>
            <select value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="SEMUA">Semua Subkategori</option>
              {subcategoryOptions.map((subcategory) => (
                <option key={subcategory} value={subcategory}>{subcategory}</option>
              ))}
            </select>
            <select value={picFilter} onChange={(event) => setPicFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="SEMUA">Semua PJ</option>
              {picOptions.map((user) => (
                <option key={user.id} value={user.id}>{user.nama}</option>
              ))}
            </select>
            <select value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="SEMUA">Semua Anggaran</option>
              <option value="BELOW_5">Di bawah Rp5.000.000</option>
              <option value="BETWEEN_5_10">Rp5.000.000 - Rp10.000.000</option>
              <option value="ABOVE_10">Di atas Rp10.000.000</option>
            </select>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/30 px-6 py-5">
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
                  <tr className="border-b border-blue-100 bg-blue-50/40 text-slate-600">
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Tiket
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
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleReports.map((report) => (
                      <tr
                        key={report.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50/50"
                      >
                        <td className="px-6 py-5">
                          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold tracking-wide text-blue-700">
                            {formatTicketFallback(report)}
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
                  ))}
                </tbody>
              </table>
              {hiddenReportCount > 0 ? (
                <div className="border-t border-slate-100 bg-white p-4 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleReportLimit(
                        (current) => current + REPORT_PAGE_SIZE,
                      )
                    }
                    className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Tampilkan {Math.min(REPORT_PAGE_SIZE, hiddenReportCount)}{" "}
                    laporan lagi
                  </button>
                </div>
              ) : null}
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
                    {getWorkflowMessage(
                      currentUser.role,
                      selectedReport.status,
                      selectedReport.kategori,
                      currentUser.categoryScope,
                    )}
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold tracking-wide text-blue-700">
                        {formatTicketFallback(selectedReport)}
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

                      <InfoBox label="Nama Pelapor">
                        {selectedReport.namaPelapor || selectedReport.user.nama}
                      </InfoBox>

                      <InfoBox label="Kode Ruangan">
                        {selectedReport.namaRuangan || selectedReport.lokasi}
                        <p className="mt-1 text-xs text-slate-500">
                          Kode: {selectedReport.nomorRuangan || "-"}
                        </p>
                      </InfoBox>

                      <InfoBox label="Nama Barang">
                        {selectedReport.namaBarang || selectedReport.kodeUakpb || "-"}
                      </InfoBox>

                      <InfoBox label="Kode Barang">
                        {selectedReport.kode || "-"}
                      </InfoBox>

                      <InfoBox label="NUP">
                        {selectedReport.nup || "-"}
                      </InfoBox>

                      <InfoBox label="Subkategori">
                        {selectedReport.subcategory || "-"}
                      </InfoBox>

                      <InfoBox label="Tipe Barang">
                        {selectedReport.itemType || "-"}
                      </InfoBox>

                      <InfoBox label="Biaya Perbaikan / Anggaran">
                        {formatRupiah(selectedReport.repairCost)}
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
                        {selectedReportRejectingAdmin ? (
                          <p className="mt-2 text-sm font-semibold text-rose-800">
                            Ditolak oleh {selectedReportRejectingAdmin.nama}{" "}
                            ({getRoleLabel(selectedReportRejectingAdmin.role)})
                          </p>
                        ) : null}
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
                          Riwayat Persetujuan
                        </p>
                        <div className="mt-3 space-y-3">
                          {selectedReport.histories.map((history) => (
                            <div
                              key={history.id}
                              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                            >
                              <p className="font-semibold text-slate-900">
                                {history.admin.nama}{" "}
                                ({getRoleLabel(history.admin.role)}) -{" "}
                                {history.action}
                              </p>
                              <p className="mt-1 text-slate-500">
                                {formatStatus(history.fromStatus)} -{" "}
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

                    <div className="mt-4">
                      <a
                        href={`/api/reports/${selectedReport.id}/pdf`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <Download className="h-4 w-4" />
                        Ekspor PDF
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-sm text-slate-500">Lampiran</p>
                    {(selectedReport.attachmentUrl || selectedReport.fotoUrl) &&
                    (selectedReport.attachmentType?.startsWith("image/") ||
                      selectedReport.fotoUrl) ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <Image
                          src={selectedReport.attachmentUrl || selectedReport.fotoUrl || ""}
                          alt={selectedReport.namaBarang}
                          width={1200}
                          height={800}
                          className="w-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : selectedReport.attachmentUrl ? (
                      <a
                        href={selectedReport.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FileText className="mb-3 h-8 w-8" />
                        <span className="font-semibold">Buka Lampiran PDF</span>
                        <span className="mt-1 max-w-full truncate text-xs">
                          {selectedReport.attachmentName || "Dokumen laporan"}
                        </span>
                      </a>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                        Tidak ada lampiran
                      </div>
                    )}
                    {selectedReport.attachments?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedReport.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            download
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {attachment.fileName}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {selectedReport.completionPhotoUrl ? (
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                      <p className="mb-3 text-sm text-slate-500">
                        Bukti Penyelesaian
                      </p>
                      {isPdfUrl(selectedReport.completionPhotoUrl) ? (
                        <a
                          href={selectedReport.completionPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <FileText className="mb-3 h-8 w-8" />
                          <span className="font-semibold">
                            Buka Bukti PDF
                          </span>
                        </a>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border border-emerald-100">
                          <Image
                            src={selectedReport.completionPhotoUrl}
                            alt="Bukti penyelesaian"
                            width={1200}
                            height={800}
                            className="w-full object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">Keputusan Admin</p>

                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        {getWorkflowMessage(
                          currentUser.role,
                          selectedReport.status,
                          selectedReport.kategori,
                          currentUser.categoryScope,
                        )}
                      </div>

                      {!isExecutive && canRoleDecide(
                        currentUser.role,
                        selectedReport.status,
                        selectedReport.kategori,
                        currentUser.categoryScope,
                      ) ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {messageTemplates.map((template) => (
                              <button
                                key={template.label}
                                type="button"
                                onClick={() => setDecisionNote(template.value)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                              >
                                {template.label}
                              </button>
                            ))}
                          </div>

                          <textarea
                            value={decisionNote}
                            onChange={(event) => setDecisionNote(event.target.value)}
                            rows={5}
                            placeholder="Catatan admin / alasan penolakan..."
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />

                          {currentUser.role === "ADMIN_5" ? (
                            <label className="grid gap-2 text-sm font-semibold text-slate-700">
                              Biaya Perbaikan / Anggaran PP
                              <input
                                value={
                                  decisionRepairCost
                                    ? formatRupiah(decisionRepairCost.replace(/\D/g, ""))
                                    : ""
                                }
                                onChange={(event) =>
                                  setDecisionRepairCost(
                                    event.target.value.replace(/\D/g, ""),
                                  )
                                }
                                inputMode="numeric"
                                placeholder="Rp0"
                                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                          ) : null}

                          {true ? (
                            <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
                              <span className="block font-semibold text-slate-900">
                                Bukti penyelesaian (opsional)
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                Dipakai saat klik Selesai. Format JPG,
                                PNG, WEBP, atau PDF. Maksimal 2MB.
                              </span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(event) =>
                                  setCompletionProof(event.target.files?.[0] || null)
                                }
                                className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-slate-600"
                              />
                              {completionProof ? (
                                <span className="mt-2 block text-xs font-medium text-slate-700">
                                  Dipilih: {completionProof.name}
                                </span>
                              ) : null}
                            </label>
                          ) : null}

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void submitDecision("ACC")}
                              disabled={submitLoading}
                              className="rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {submitLoading
                                ? "Memproses..."
                                : currentUser.role === "ADMIN_1"
                                  ? "Lanjut"
                                  : "Terima"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void submitDecision("SELESAI")}
                              disabled={submitLoading}
                              className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60"
                            >
                              {submitLoading ? "Memproses..." : "Selesai"}
                            </button>

                            {currentUser.role !== "ADMIN_1" ? (
                              <button
                                type="button"
                                onClick={() => void submitDecision("TOLAK")}
                                disabled={submitLoading}
                                className="rounded-2xl bg-rose-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-rose-400 disabled:opacity-60"
                              >
                                {submitLoading ? "Memproses..." : "Tolak"}
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          Tombol tindakan belum tersedia untuk peran Anda pada
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

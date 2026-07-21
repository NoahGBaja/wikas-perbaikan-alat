"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Filter,
  KeyRound,
  RefreshCcw,
  Users,
} from "lucide-react";
import MonthlyStatsCards from "@/src/components/dashboard/MonthlyStatsCards";
import MonthlyReporterTable from "@/src/components/dashboard/MonthlyReporterTable";
import UserDashboardLogoutButton from "@/src/components/dashboard/UserDashboardLogoutButton";
import {
  FeedbackBanner,
  showError,
  toFeedback,
  type FeedbackMessage,
} from "@/src/components/ui/feedback";
import { getRoleLabel } from "@/src/lib/roles";
import type { ReportStatus } from "@/lib/report-helpers";
import type { MonthlyStatsResponse } from "@/src/lib/monthly-report-stats-types";

type AdminStatistikPageClientProps = {
  initialStats: MonthlyStatsResponse;
  canReturnToDashboard?: boolean;
};

const MONTH_OPTIONS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const STATUS_OPTIONS = [
  { value: "SEMUA", label: "Semua Status" },
  { value: "MENUNGGU_ADMIN_1", label: `Menunggu ${getRoleLabel("ADMIN_1")}` },
  { value: "MENUNGGU_ADMIN_2", label: `Menunggu ${getRoleLabel("ADMIN_2")}` },
  { value: "MENUNGGU_ADMIN_3", label: `Menunggu ${getRoleLabel("ADMIN_3")}` },
  { value: "MENUNGGU_ADMIN_4", label: `Menunggu ${getRoleLabel("ADMIN_4")}` },
  { value: "MENUNGGU_ADMIN_5", label: `Menunggu ${getRoleLabel("ADMIN_5")}` },
  { value: "DISETUJUI_FINAL", label: "Disetujui Final" },
  { value: "DITOLAK", label: "Ditolak" },
] as const;

export default function AdminStatistikPageClient({
  initialStats,
  canReturnToDashboard = true,
}: AdminStatistikPageClientProps) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const defaultMonth = initialStats.monthNumber;
  const defaultYear = initialStats.year;
  const defaultStatus = initialStats.selectedStatus;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | "SEMUA">(
    defaultStatus,
  );
  const [activeDisplay, setActiveDisplay] = useState<"TABLE" | "SUMMARY">(
    "SUMMARY",
  );
  const [stats, setStats] = useState<MonthlyStatsResponse | null>(initialStats);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isPending, startStatsTransition] = useTransition();

  const yearOptions = useMemo(() => {
    const startYear = 2020;
    const endYear = Math.max(currentYear + 4, defaultYear + 2);

    return Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index,
    );
  }, [currentYear, defaultYear]);

  async function loadStats(
    month: number,
    year: number,
    status: ReportStatus | "SEMUA",
  ) {
    const hasExistingStats = stats !== null;

    try {
      if (hasExistingStats) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage(null);

      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });

      if (status !== "SEMUA") {
        params.set("status", status);
      }

      const res = await fetch(
        `/api/reports/stats/monthly?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        const text = data.message || "Gagal memuat statistik bulanan.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal memuat statistik", text);

        if (!hasExistingStats) {
          setStats(null);
        }

        return;
      }

      startStatsTransition(() => {
        setStats(data);
      });
    } catch (error) {
      console.error("LOAD_MONTHLY_STATS_ERROR:", error);
      const text = "Terjadi kesalahan saat memuat statistik bulanan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal memuat statistik", text);

      if (!hasExistingStats) {
        setStats(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleApplyFilter() {
    void loadStats(selectedMonth, selectedYear, selectedStatus);
  }

  function handleResetFilter() {
    setSelectedMonth(defaultMonth);
    setSelectedYear(defaultYear);
    setSelectedStatus(defaultStatus);
    void loadStats(defaultMonth, defaultYear, defaultStatus);
  }

  function handleExport() {
    const params = new URLSearchParams({
      month: String(selectedMonth),
      year: String(selectedYear),
    });

    if (selectedStatus !== "SEMUA") {
      params.set("status", selectedStatus);
    }

    window.location.href = `/api/reports/stats/monthly/export?${params.toString()}`;
    setShowExportModal(false);
  }

  const isRefreshingStats = refreshing || isPending;
  const isBusy = loading || refreshing || isPending;
  const showInitialLoader = loading && !stats;
  const activeMonthLabel =
    stats?.month ??
    MONTH_OPTIONS.find((month) => month.value === selectedMonth)?.label ??
    "Periode terpilih";

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              <BarChart3 className="h-4 w-4" />
              Statistik Laporan
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950 md:text-4xl">
              Ringkasan Eksekutif
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Kondisi menyeluruh penanganan laporan, biaya perbaikan, dan
              progres penyelesaian pada periode aktif.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            {canReturnToDashboard ? (
              <button
                type="button"
                onClick={() => router.push("/dashboard/admin")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
              >
                <ArrowLeft className="h-4 w-4 text-blue-600" />
                Kembali ke Dasbor
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => router.push("/dashboard/account")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <KeyRound className="h-4 w-4 text-blue-600" />
              Akun
            </button>

            <UserDashboardLogoutButton className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-3 font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70" />

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              disabled={isBusy || !stats}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              Ekspor XLSX
            </button>
          </div>
        </div>

        {showExportModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <h2 className="text-xl font-bold text-slate-950">Filter Ekspor</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ekspor akan memakai filter statistik yang sedang dipilih:
                bulan, tahun, dan status.
              </p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>Bulan: {MONTH_OPTIONS.find((item) => item.value === selectedMonth)?.label}</p>
                <p>Tahun: {selectedYear}</p>
                <p>
                  Status:{" "}
                  {STATUS_OPTIONS.find((item) => item.value === selectedStatus)?.label ||
                    "Semua Status"}
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Mulai Ekspor
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showInitialLoader ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
            Memuat statistik bulanan...
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <section className="space-y-6">
              <div
                className={
                  activeDisplay === "SUMMARY"
                    ? "mx-auto block w-full max-w-5xl"
                    : "hidden"
                }
              >
                <MonthlyStatsCards
                  monthLabel={stats.month}
                  summary={stats.summary}
                  categories={stats.categories.items}
                  statusBreakdown={stats.statusBreakdown}
                />
              </div>

              <div
                className={activeDisplay === "TABLE" ? "block min-w-0" : "hidden"}
              >
                <MonthlyReporterTable
                  reporterStats={stats.reporterStats}
                  totalReports={stats.summary.totalReports}
                  monthLabel={stats.month}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-blue-100 bg-blue-50/30 p-5">
                <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
                  Filter Statistik
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950 md:text-3xl">
                  Rekap Pelapor {activeMonthLabel}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Pilih bulan, tahun, dan status, lalu tampilkan data yang ingin
                  kamu lihat.
                </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  disabled={isBusy}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={isBusy}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as ReportStatus | "SEMUA")
                  }
                  disabled={isBusy}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleApplyFilter}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Filter className="h-4 w-4" />
                  Terapkan
                </button>

                <button
                  type="button"
                  onClick={handleResetFilter}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCcw className="h-4 w-4 text-slate-500" />
                  Atur Ulang
                </button>

              </div>

              {isRefreshingStats ? (
                <div className="mx-5 mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Memperbarui statistik...
                </div>
              ) : null}

              <FeedbackBanner message={message} className="mx-5 mt-4" />

              <div className="flex flex-col gap-3 p-5 pt-0 sm:flex-row">
                <p className="flex items-center text-sm font-semibold text-slate-500">
                  Tampilan:
                </p>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setActiveDisplay("SUMMARY")}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      activeDisplay === "SUMMARY"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Panel Ringkasan
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDisplay("TABLE")}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      activeDisplay === "TABLE"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Rekap Pelapor
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
            Data statistik tidak tersedia.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Filter,
  RefreshCcw,
  Users,
} from "lucide-react";
import MonthlyStatsCards from "@/src/components/dashboard/MonthlyStatsCards";
import MonthlyReporterTable from "@/src/components/dashboard/MonthlyReporterTable";
import type { ReportStatus } from "@/lib/report-helpers";
import type { MonthlyStatsResponse } from "@/src/lib/monthly-report-stats-types";

type AdminStatistikPageClientProps = {
  initialStats: MonthlyStatsResponse;
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
  { value: "MENUNGGU_ADMIN_1", label: "Menunggu Admin 1" },
  { value: "MENUNGGU_ADMIN_2", label: "Menunggu Admin 2" },
  { value: "MENUNGGU_ADMIN_3", label: "Menunggu Admin 3" },
  { value: "MENUNGGU_ADMIN_4", label: "Menunggu Admin 4" },
  { value: "MENUNGGU_ADMIN_5", label: "Menunggu Admin 5" },
  { value: "MENUNGGU_ADMIN_6", label: "Menunggu Admin 6" },
  { value: "DISETUJUI_FINAL", label: "Disetujui Final" },
  { value: "DITOLAK", label: "Ditolak" },
] as const;

export default function AdminStatistikPageClient({
  initialStats,
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
    "TABLE",
  );
  const [stats, setStats] = useState<MonthlyStatsResponse | null>(initialStats);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
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

      setMessage("");

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
        setMessage(data.message || "Gagal memuat statistik bulanan.");

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
      setMessage("Terjadi kesalahan saat memuat statistik bulanan.");

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
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              <BarChart3 className="h-4 w-4" />
              Statistik Laporan
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950 md:text-4xl">
              Statistik Laporan
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Lihat performa laporan berdasarkan bulan, tahun, status, dan
              aktivitas pelapor.
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

        {showInitialLoader ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
            Memuat statistik bulanan...
          </div>
        ) : stats ? (
          <div className="space-y-6">
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
                  Reset
                </button>
              </div>

              {isRefreshingStats ? (
                <div className="mx-5 mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Memperbarui statistik...
                </div>
              ) : null}

              {message ? (
                <div className="mx-5 mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {message}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 p-5 pt-0 sm:flex-row">
                <p className="flex items-center text-sm font-semibold text-slate-500">
                  Tampilan:
                </p>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
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
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div
                className={activeDisplay === "TABLE" ? "block min-w-0" : "hidden"}
              >
                <MonthlyReporterTable
                  reporterStats={stats.reporterStats}
                  totalReports={stats.summary.totalReports}
                  monthLabel={stats.month}
                />
              </div>

              <div
                className={
                  activeDisplay === "SUMMARY"
                    ? "mx-auto block w-full max-w-5xl"
                    : "hidden"
                }
              >
                <MonthlyStatsCards
                  monthLabel={stats.month}
                  selectedStatus={stats.selectedStatus}
                  summary={stats.summary}
                  categories={stats.categories.items}
                  statusBreakdown={stats.statusBreakdown}
                />
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

"use client";

import { memo, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Users,
  XCircle,
} from "lucide-react";
import { formatRupiah } from "@/src/lib/formatting";

type MonthlySummary = {
  totalReports: number;
  totalUniqueReporters: number;
  totalWaiting: number;
  totalApproved: number;
  totalRejected: number;
  totalReopened: number;
  totalOngoing: number;
  totalProcessed: number;
  totalFinished: number;
  totalExpenses: number;
  averageCompletionDays: number;
};

type CategoryItem = {
  key: string;
  label: string;
  total: number;
};

type StatusItem = {
  key: string;
  label: string;
  total: number;
};

type MonthlyStatsCardsProps = {
  monthLabel: string;
  summary: MonthlySummary;
  categories: CategoryItem[];
  statusBreakdown: StatusItem[];
};

type StatTileProps = {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  accentClass: string;
  valueClass?: string;
};

function StatTile({
  title,
  value,
  description,
  icon,
  accentClass,
  valueClass = "text-slate-900",
}: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${accentClass}`}
        >
          {icon}
        </div>
        <p
          className={`text-2xl font-black tracking-[-0.04em] sm:text-3xl ${valueClass}`}
        >
          {value}
        </p>
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function getStatusDotClass(statusKey: string) {
  if (statusKey === "DISETUJUI_FINAL" || statusKey === "DISETUJUI") {
    return "bg-emerald-500";
  }

  if (statusKey === "DITOLAK") {
    return "bg-rose-500";
  }

  if (statusKey.startsWith("MENUNGGU") || statusKey === "MENUNGGU") {
    return "bg-amber-500";
  }

  if (statusKey === "DIPROSES") {
    return "bg-cyan-500";
  }

  return "bg-blue-500";
}

function getStatusBarClass(statusKey: string) {
  if (statusKey === "DISETUJUI_FINAL" || statusKey === "DISETUJUI") {
    return "bg-emerald-500";
  }

  if (statusKey === "DITOLAK") {
    return "bg-rose-500";
  }

  if (statusKey.startsWith("MENUNGGU") || statusKey === "MENUNGGU") {
    return "bg-amber-500";
  }

  if (statusKey === "DIPROSES") {
    return "bg-cyan-500";
  }

  return "bg-blue-500";
}

function MonthlyStatsCards({
  monthLabel,
  summary,
  categories,
  statusBreakdown,
}: MonthlyStatsCardsProps) {
  const totalStatus = statusBreakdown.reduce((sum, item) => sum + item.total, 0);

  const maxCategory =
    categories.length > 0
      ? Math.max(...categories.map((item) => item.total), 1)
      : 1;

  const approvalRate =
    summary.totalReports > 0
      ? Math.round((summary.totalApproved / summary.totalReports) * 100)
      : 0;

  const dominantStatus =
    statusBreakdown.length > 0
      ? [...statusBreakdown].sort((a, b) => b.total - a.total)[0]
      : null;
  const completionRate =
    summary.totalReports > 0
      ? Math.round((summary.totalFinished / summary.totalReports) * 100)
      : 0;
  const needsAttention = summary.totalOngoing > 0 || summary.totalReopened > 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">
          Panel Ringkasan
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
          Ringkasan {monthLabel}
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Gambaran menyeluruh periode aktif untuk membantu Kepala Balai melihat
          beban kerja, progres, biaya, dan bagian yang perlu perhatian.
        </p>

        <div
          className={`mt-5 border-l-4 px-4 py-3 ${
            needsAttention
              ? "border-amber-500 bg-amber-50 text-amber-900"
              : "border-emerald-500 bg-emerald-50 text-emerald-900"
          }`}
        >
          <p className="font-semibold">
            {needsAttention ? "Perlu perhatian" : "Kondisi terkendali"}
          </p>
          <p className="mt-1 text-sm leading-6">
            {needsAttention
              ? `${summary.totalOngoing} laporan masih berjalan dan ${summary.totalReopened} laporan dibuka kembali.`
              : "Tidak ada laporan berjalan atau laporan yang dibuka kembali pada periode ini."}
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile
          title="Total Laporan"
          value={summary.totalReports}
          description="Semua laporan pada periode aktif."
          icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
          accentClass="border-blue-100 bg-blue-50"
          valueClass="text-blue-600"
        />

        <StatTile
          title="Pelapor Unik"
          value={summary.totalUniqueReporters}
          description="Pegawai berbeda yang melapor."
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          accentClass="border-emerald-100 bg-emerald-50"
          valueClass="text-emerald-600"
        />

        <StatTile
          title="Disetujui"
          value={summary.totalApproved}
          description="Laporan yang lolos verifikasi."
          icon={<BadgeCheck className="h-5 w-5 text-emerald-600" />}
          accentClass="border-emerald-100 bg-emerald-50"
          valueClass="text-emerald-600"
        />

        <StatTile
          title="Ditolak"
          value={summary.totalRejected}
          description="Laporan yang tidak dilanjutkan."
          icon={<XCircle className="h-5 w-5 text-rose-600" />}
          accentClass="border-rose-100 bg-rose-50"
          valueClass="text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          value={summary.totalOngoing}
          label="Berjalan"
          colorClass="text-amber-600"
        />

        <MiniStat
          icon={<Activity className="h-5 w-5 text-cyan-600" />}
          value={summary.totalReopened}
          label="Dibuka Kembali"
          colorClass="text-cyan-600"
        />

        <MiniStat
          icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
          value={summary.totalFinished}
          label="Selesai"
          colorClass="text-blue-600"
        />
      </div>

      <div className="border-l-4 border-blue-500 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">
          Tingkat penyelesaian {completionRate}%
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {summary.totalFinished} dari {summary.totalReports} laporan pada
          periode aktif telah selesai.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MiniStat
          icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
          value={formatRupiah(summary.totalExpenses)}
          label="Total Biaya"
          colorClass="text-emerald-600"
        />

        <MiniStat
          icon={<Clock3 className="h-5 w-5 text-indigo-600" />}
          value={`${summary.averageCompletionDays} hari`}
          label="Rata-rata Waktu Selesai"
          colorClass="text-indigo-600"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Komposisi Kategori
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Laporan per Kategori
            </h3>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
            <LayoutGrid className="h-5 w-5 text-blue-600" />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
              Belum ada data kategori pada periode ini.
            </div>
          ) : (
            categories.map((item, index) => {
              const width =
                maxCategory > 0 ? (item.total / maxCategory) * 100 : 0;

              const barClass =
                index === 0
                  ? "bg-emerald-500"
                  : index === 1
                    ? "bg-amber-500"
                    : "bg-blue-500";

              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">
                      {item.label}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {item.total}
                    </span>
                  </div>

                  <div className="mt-2 h-2.5 rounded-full bg-slate-100">
                    <div
                      className={`h-2.5 rounded-full ${barClass}`}
                      style={{
                        width: `${Math.max(width, item.total > 0 ? 10 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Distribusi Status
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Ringkasan Progres
            </h3>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Persetujuan
            </p>
            <p className="mt-1 text-xl font-black tracking-[-0.03em] text-emerald-700 sm:text-2xl">
              {approvalRate}%
            </p>
          </div>
        </div>

        {dominantStatus ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Status Dominan
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {dominantStatus.label}
            </p>
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {statusBreakdown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
              Belum ada distribusi status pada periode ini.
            </div>
          ) : (
            statusBreakdown.map((item) => {
              const percent =
                totalStatus > 0
                  ? Math.round((item.total / totalStatus) * 100)
                  : 0;

              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full ${getStatusDotClass(
                          item.key,
                        )}`}
                      />
                      <span className="font-medium text-slate-700">
                        {item.label}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {item.total}
                      </p>
                      <p className="text-xs text-slate-500">{percent}%</p>
                    </div>
                  </div>

                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${getStatusBarClass(
                        item.key,
                      )}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  icon,
  value,
  label,
  colorClass,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {icon}
      <p
        className={`mt-3 text-2xl font-black tracking-[-0.03em] ${colorClass}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

export default memo(MonthlyStatsCards);

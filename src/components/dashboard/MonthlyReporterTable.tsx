"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CircleUserRound,
  Hash,
  Search,
} from "lucide-react";
import {
  formatStatus,
  getStatusClass,
  formatTanggal,
  type ReportStatus,
} from "@/lib/report-helpers";

type ReporterStatItem = {
  userId: number;
  nama: string;
  nip: string | null;
  totalReports: number;
  lastStatus: ReportStatus;
  topCategory: string;
  latestReportAt: string;
};

type MonthlyReporterTableProps = {
  reporterStats: ReporterStatItem[];
  totalReports: number;
  monthLabel: string;
};

type ReporterSortOption =
  | "TOTAL_DESC"
  | "TOTAL_ASC"
  | "NAME_ASC"
  | "NAME_DESC"
  | "LATEST_DESC"
  | "LATEST_ASC";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function MonthlyReporterTable({
  reporterStats,
  totalReports,
  monthLabel,
}: MonthlyReporterTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<ReporterSortOption>("TOTAL_DESC");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  const visibleReporterStats = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    const filtered = normalizedSearch
      ? reporterStats.filter((item) => {
          const haystack = [item.nama, item.nip || "", item.topCategory].join(
            " ",
          );

          return haystack.toLowerCase().includes(normalizedSearch);
        })
      : reporterStats;

    return [...filtered].sort((a, b) => {
      if (sortBy === "TOTAL_ASC" || sortBy === "TOTAL_DESC") {
        const delta = a.totalReports - b.totalReports;

        if (delta !== 0) {
          return sortBy === "TOTAL_ASC" ? delta : -delta;
        }

        return a.nama.localeCompare(b.nama, "id");
      }

      if (sortBy === "NAME_ASC" || sortBy === "NAME_DESC") {
        const delta = a.nama.localeCompare(b.nama, "id");

        if (delta !== 0) {
          return sortBy === "NAME_ASC" ? delta : -delta;
        }

        return b.totalReports - a.totalReports;
      }

      const aTime = Date.parse(a.latestReportAt);
      const bTime = Date.parse(b.latestReportAt);
      const delta = aTime - bTime;

      if (delta !== 0) {
        return sortBy === "LATEST_ASC" ? delta : -delta;
      }

      return b.totalReports - a.totalReports;
    });
  }, [reporterStats, debouncedSearchTerm, sortBy]);

  if (reporterStats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
        Belum ada data laporan pada {monthLabel}.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50/30 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">
              Rekap Bulanan
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950">
              Daftar Pelapor
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Statistik pelapor untuk periode {monthLabel}.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row xl:min-w-[520px]">
            <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari nama, NIP, atau kategori"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 md:min-w-[220px]">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as ReporterSortOption)
                }
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
              >
                <option value="TOTAL_DESC">Laporan terbanyak</option>
                <option value="TOTAL_ASC">Laporan tersedikit</option>
                <option value="NAME_ASC">Nama A-Z</option>
                <option value="NAME_DESC">Nama Z-A</option>
                <option value="LATEST_DESC">Aktivitas terbaru</option>
                <option value="LATEST_ASC">Aktivitas terlama</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Total pelapor: {reporterStats.length}
          </div>

          <p className="text-sm text-slate-500">
            Menampilkan {visibleReporterStats.length} dari{" "}
            {reporterStats.length} pelapor
          </p>
        </div>
      </div>

      {visibleReporterStats.length === 0 ? (
        <div className="px-6 py-10 text-center text-slate-600">
          Tidak ada pelapor yang cocok dengan pencarian saat ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/40 text-slate-600">
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Rank
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Nama
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  NIP
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Jumlah
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Kategori Terbanyak
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Persentase
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Status Terakhir
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Laporan Terakhir
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleReporterStats.map((item, index) => {
                const initials = getInitials(item.nama);

                const contribution =
                  totalReports > 0
                    ? Math.round((item.totalReports / totalReports) * 100)
                    : 0;

                return (
                  <tr
                    key={item.userId}
                    className="border-b border-slate-100 transition duration-200 hover:bg-blue-50/50"
                  >
                    <td className="px-6 py-5">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-sm font-bold text-amber-700">
                        #{index + 1}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex min-w-[220px] items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
                          {initials ? (
                            <span className="text-sm font-bold text-blue-700">
                              {initials}
                            </span>
                          ) : (
                            <CircleUserRound className="h-6 w-6 text-blue-600" />
                          )}
                        </div>

                        <p className="font-semibold text-slate-900">
                          {item.nama}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-slate-400" />
                        <span>{item.nip || "-"}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold tracking-wide text-blue-700">
                        {item.totalReports} laporan
                      </span>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {item.topCategory}
                    </td>

                    <td className="min-w-[180px] px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-500">Kontribusi</span>
                          <span className="font-semibold text-slate-900">
                            {contribution}%
                          </span>
                        </div>

                        <div className="h-2.5 rounded-full bg-slate-100">
                          <div
                            className="h-2.5 rounded-full bg-blue-500"
                            style={{ width: `${contribution}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold tracking-[0.16em] ${getStatusClass(
                          item.lastStatus,
                        )}`}
                      >
                        {formatStatus(item.lastStatus)}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {formatTanggal(item.latestReportAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default memo(MonthlyReporterTable);

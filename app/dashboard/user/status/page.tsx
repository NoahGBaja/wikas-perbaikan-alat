"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusList from "@/src/components/dashboard/StatusList";
import type {
  StatusReportItem,
  StatusReportStatus,
} from "@/src/components/dashboard/StatusCard";

type StatusFilter = "SEMUA" | "PENDING" | "DISETUJUI_FINAL" | "DITOLAK";

const FILTERS: StatusFilter[] = [
  "SEMUA",
  "PENDING",
  "DISETUJUI_FINAL",
  "DITOLAK",
];

function formatFilterLabel(filter: StatusFilter) {
  const labels: Record<StatusFilter, string> = {
    SEMUA: "SEMUA",
    PENDING: "PENDING",
    DISETUJUI_FINAL: "DISETUJUI FINAL",
    DITOLAK: "DITOLAK",
  };

  return labels[filter];
}

function isWaitingStatus(status: StatusReportStatus) {
  return status.startsWith("MENUNGGU_ADMIN");
}

export default function UserStatusPage() {
  const router = useRouter();
  const [reports, setReports] = useState<StatusReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("SEMUA");

  async function loadReports() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/reports", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Gagal memuat status laporan.");
        return;
      }

      setReports(data.reports || []);
    } catch (error) {
      console.error("LOAD_USER_STATUS_ERROR:", error);
      setMessage("Terjadi kesalahan saat memuat status laporan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleDeleteReport(reportId: number) {
    const confirmed = window.confirm(
      "Hapus laporan ini? Aksi ini hanya tersedia saat laporan masih menunggu Admin 1."
    );

    if (!confirmed) return;

    try {
      setDeletingReportId(reportId);
      setMessage("");

      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Gagal menghapus laporan.");
        return;
      }

      setMessage(data.message || "Laporan berhasil dihapus.");
      await loadReports();
    } catch (error) {
      console.error("DELETE_REPORT_ERROR:", error);
      setMessage("Terjadi kesalahan saat menghapus laporan.");
    } finally {
      setDeletingReportId(null);
    }
  }

  const filteredReports = useMemo(() => {
    if (filter === "SEMUA") return reports;
    if (filter === "PENDING") {
      return reports.filter((item) => isWaitingStatus(item.status));
    }

    return reports.filter((item) => item.status === filter);
  }, [filter, reports]);

  const totalReports = reports.length;
  const waitingReports = reports.filter((r) => isWaitingStatus(r.status)).length;
  const approvedReports = reports.filter(
    (r) => r.status === "DISETUJUI_FINAL"
  ).length;
  const rejectedReports = reports.filter((r) => r.status === "DITOLAK").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Dashboard Pegawai
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">
              Cek Status Laporan
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Lihat posisi laporan kamu dalam alur persetujuan Admin 1 sampai
              Admin 6.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <button
              type="button"
              onClick={() => router.push("/dashboard/user")}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              Kembali
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/user/report")}
              className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              Buat Laporan Baru
            </button>
          </div>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Total Laporan
            </p>
            <p className="mt-3 text-5xl font-extrabold text-blue-600">
              {totalReports}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Semua laporan milik kamu.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Menunggu
            </p>
            <p className="mt-3 text-5xl font-extrabold text-amber-600">
              {waitingReports}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Masih dalam proses approval.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Disetujui Final
            </p>
            <p className="mt-3 text-5xl font-extrabold text-emerald-600">
              {approvedReports}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Sudah disetujui sampai Admin 6.
            </p>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Ditolak
            </p>
            <p className="mt-3 text-5xl font-extrabold text-rose-600">
              {rejectedReports}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Perlu cek alasan penolakan.
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/30 p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {FILTERS.map((item) => {
              const active = filter === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={[
                    "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                    active
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {formatFilterLabel(item)}
                </button>
              );
            })}
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-10 text-center text-slate-600 shadow-sm">
            Memuat status laporan...
          </div>
        ) : (
          <StatusList
            reports={filteredReports}
            deletingReportId={deletingReportId}
            onEdit={(reportId) =>
              router.push(`/dashboard/user/report/${reportId}`)
            }
            onDelete={(reportId) => void handleDeleteReport(reportId)}
          />
        )}
      </div>
    </div>
  );
}

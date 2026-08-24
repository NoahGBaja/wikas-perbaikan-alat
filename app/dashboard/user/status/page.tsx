"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import StatusList from "@/src/components/dashboard/StatusList";
import {
  FeedbackBanner,
  showError,
  showSuccess,
  toFeedback,
  type FeedbackMessage,
} from "@/src/components/ui/feedback";
import { getRoleLabel } from "@/src/lib/roles";
import StatusCard, {
  type StatusReportItem,
} from "@/src/components/dashboard/StatusCard";

type StatusFilter =
  | "SEMUA"
  | "PENDING"
  | "MENUNGGU_KONFIRMASI"
  | "TELAH_BERFUNGSI"
  | "TIDAK_DAPAT_DIGUNAKAN"
  | "DITOLAK";

const FILTERS: StatusFilter[] = [
  "SEMUA",
  "PENDING",
  "MENUNGGU_KONFIRMASI",
  "TELAH_BERFUNGSI",
  "TIDAK_DAPAT_DIGUNAKAN",
  "DITOLAK",
];
const STATUS_PAGE_SIZE = 8;

function formatFilterLabel(filter: StatusFilter) {
  const labels: Record<StatusFilter, string> = {
    SEMUA: "SEMUA",
    PENDING: "PENDING",
    MENUNGGU_KONFIRMASI: "PERLU KONFIRMASI",
    TELAH_BERFUNGSI: "TELAH BERFUNGSI",
    TIDAK_DAPAT_DIGUNAKAN: "TIDAK DAPAT DIGUNAKAN",
    DITOLAK: "DITOLAK",
  };

  return labels[filter];
}

export default function UserStatusPage() {
  const router = useRouter();
  const reportRequestId = useRef(0);
  const [reports, setReports] = useState<StatusReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportTotal, setReportTotal] = useState(0);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [reportSummary, setReportSummary] = useState({
    total: 0,
    menunggu: 0,
    telahBerfungsi: 0,
    ditolak: 0,
  });
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("SEMUA");
  const [focusedReportId, setFocusedReportId] = useState<number | null>(null);
  const [focusedReportOverride, setFocusedReportOverride] =
    useState<StatusReportItem | null>(null);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);

  async function loadReports(options?: { append?: boolean }) {
    const append = options?.append === true;
    const requestId = ++reportRequestId.current;

    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setMessage(null);

      const params = new URLSearchParams({
        limit: String(STATUS_PAGE_SIZE),
        offset: String(append ? reports.length : 0),
      });
      if (filter !== "SEMUA") params.set("status", filter);

      const res = await fetch(`/api/reports?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (requestId !== reportRequestId.current) return;

      if (!res.ok) {
        const text = data.message || "Gagal memuat status laporan.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal memuat status laporan", text);
        return;
      }

      const nextReports = Array.isArray(data.reports) ? data.reports : [];
      setReports((current) => (append ? [...current, ...nextReports] : nextReports));
      setReportTotal(Number(data.total || 0));
      setHasMoreReports(data.hasMore === true);
      if (data.summary) {
        setReportSummary({
          total: Number(data.summary.total || 0),
          menunggu: Number(data.summary.menunggu || 0),
          telahBerfungsi: Number(data.summary.telahBerfungsi || 0),
          ditolak: Number(data.summary.ditolak || 0),
        });
      }
    } catch (error) {
      console.error("LOAD_USER_STATUS_ERROR:", error);
      const text = "Terjadi kesalahan saat memuat status laporan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal memuat status laporan", text);
    } finally {
      if (requestId === reportRequestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  const loadReportsForEffect = useEffectEvent(loadReports);

  useEffect(() => {
    void loadReportsForEffect();
  }, [filter]);

  useEffect(() => {
    const rawReportId = new URLSearchParams(window.location.search).get("report");
    const reportId = Number(rawReportId);

    if (Number.isInteger(reportId) && reportId > 0) {
      setFocusedReportId(reportId);
      setFilter("SEMUA");
    }
  }, []);

  async function handleDeleteReport(reportId: number) {
    const confirmed = window.confirm(
      `Hapus laporan ini? Aksi ini hanya tersedia saat laporan masih menunggu ${getRoleLabel("ADMIN_1")}.`
    );

    if (!confirmed) return;

    try {
      setDeletingReportId(reportId);
      setMessage(null);

      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        const text = data.message || "Gagal menghapus laporan.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal menghapus laporan", text);
        return;
      }

      const text = data.message || "Laporan berhasil dihapus.";
      setMessage(toFeedback(text, "success"));
      showSuccess("Laporan dihapus", text);
      await loadReports();
    } catch (error) {
      console.error("DELETE_REPORT_ERROR:", error);
      const text = "Terjadi kesalahan saat menghapus laporan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal menghapus laporan", text);
    } finally {
      setDeletingReportId(null);
    }
  }

  const visibleReports = reports;
  const hiddenReportsCount = Math.max(reportTotal - reports.length, 0);
  const focusedReport = useMemo(
    () =>
      reports.find((report) => report.id === focusedReportId) ||
      focusedReportOverride,
    [focusedReportId, focusedReportOverride, reports],
  );

  useEffect(() => {
    if (
      !focusedReportId ||
      reports.some((report) => report.id === focusedReportId)
    ) {
      setFocusedReportOverride(null);
      return;
    }

    let cancelled = false;

    void fetch(`/api/reports/${focusedReportId}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!cancelled && response.ok && data.report) {
          setFocusedReportOverride(data.report as StatusReportItem);
        }
      })
      .catch((error) => {
        console.error("LOAD_FOCUSED_REPORT_ERROR:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [focusedReportId, reports]);

  useEffect(() => {
    if (focusedReport) {
      setNotificationModalOpen(true);
    }
  }, [focusedReport]);

  useEffect(() => {
    if (!focusedReportId) return;

    const reportElement = document.getElementById(`report-${focusedReportId}`);

    if (reportElement) {
      reportElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedReportId, visibleReports]);

  const totalReports = reportSummary.total;
  const waitingReports = reportSummary.menunggu;
  const approvedReports = reportSummary.telahBerfungsi;
  const rejectedReports = reportSummary.ditolak;

  function closeNotificationModal() {
    setNotificationModalOpen(false);
    setFocusedReportId(null);
    setFocusedReportOverride(null);
    router.replace("/dashboard/user/status", { scroll: false });
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
        <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Dasbor Pegawai
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">
              Cek Status Laporan
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Lihat posisi laporan kamu dalam alur persetujuan{" "}
              {getRoleLabel("ADMIN_1")} sampai {getRoleLabel("ADMIN_5")}.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => window.location.assign("/dashboard/user")}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              Kembali
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/user/report")}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-500"
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
              Masih dalam proses persetujuan.
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
              Sudah disetujui sampai {getRoleLabel("ADMIN_5")}.
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

        <FeedbackBanner message={message} className="mb-6" />

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-10 text-center text-slate-600 shadow-sm">
            Memuat status laporan...
          </div>
        ) : (
          <>
            <StatusList
              reports={visibleReports}
              highlightedReportId={focusedReportId}
              deletingReportId={deletingReportId}
              onEdit={(reportId) =>
                router.push(`/dashboard/user/report/${reportId}`)
              }
              onDelete={(reportId) => void handleDeleteReport(reportId)}
            />

            {hiddenReportsCount > 0 ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadReports({ append: true })}
                  disabled={loadingMore || !hasMoreReports}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                >
                  {loadingMore
                    ? "Memuat..."
                    : `Tampilkan ${Math.min(hiddenReportsCount, STATUS_PAGE_SIZE)} laporan lagi`}
                </button>
              </div>
            ) : null}
          </>
        )}
        </div>
      </div>

      {notificationModalOpen && focusedReport ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 sm:items-center sm:p-4"
          onClick={closeNotificationModal}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-report-title"
            className="flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-3xl sm:border sm:border-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-blue-600">
                  Detail Laporan
                </p>
                <h2
                  id="notification-report-title"
                  className="mt-1 break-words text-xl font-bold text-slate-950"
                >
                  {focusedReport.namaBarang}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeNotificationModal}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Tutup detail laporan"
                title="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <StatusCard
                report={focusedReport}
                highlighted
                deleting={deletingReportId === focusedReport.id}
                onEdit={(reportId) =>
                  router.push(`/dashboard/user/report/${reportId}`)
                }
                onDelete={(reportId) => void handleDeleteReport(reportId)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  Search,
  X,
  XCircle,
} from "lucide-react";
import {
  formatKategori,
  formatTanggal,
  formatStatus,
  getStatusClass,
  type ReportKategori,
  type ReportStatus,
} from "@/lib/report-helpers";
import {
  ADMIN_ROLES,
  getCategoryScopeLabel,
  getRoleLabel,
  type AppCategoryScope,
  type AppRole,
} from "@/src/lib/roles";

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
  namaPelapor?: string | null;
  nomorRuangan?: string | null;
  kodeUakpb?: string | null;
  kode?: string | null;
  kategori: ReportKategori;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  fotoUrl: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  status: ReportStatus;
  alasanPenolakan: string | null;
  adminNotes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  histories?: ReportHistoryItem[];
  user: {
    id: number;
    nama: string;
    jabatan?: string | null;
    nip: string | null;
    role: AppRole;
  };
};

type UserSearchResult = {
  id: number;
  nama: string;
  nip: string | null;
  role: AppRole;
};

const HISTORY_PAGE_SIZE = 50;
const CATEGORY_FILTER_OPTIONS: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];
const EXPORT_FIELD_OPTIONS = [
  { key: "id", label: "ID Laporan" },
  { key: "namaPelapor", label: "Nama Pelapor" },
  { key: "nipPelapor", label: "NIP Pelapor" },
  { key: "kategori", label: "Jenis Perbaikan" },
  { key: "namaBarang", label: "Nama Barang" },
  { key: "kodeRuangan", label: "Kode Ruangan" },
  { key: "lokasi", label: "Lokasi" },
  { key: "kodeUakpb", label: "Kode UAKPB" },
  { key: "kode", label: "Kode" },
  { key: "status", label: "Status" },
  { key: "declinedBy", label: "Ditolak Oleh" },
  { key: "alasanPenolakan", label: "Alasan Penolakan" },
  { key: "adminNotes", label: "Catatan Admin" },
  { key: "createdAt", label: "Tanggal Dibuat" },
  { key: "finishedAt", label: "Tanggal Final" },
  { key: "attachmentUrl", label: "Lampiran" },
  { key: "approvalHistory", label: "Riwayat Approval" },
] as const;
type ExportFieldKey = (typeof EXPORT_FIELD_OPTIONS)[number]["key"];
const DEFAULT_EXPORT_FIELDS = EXPORT_FIELD_OPTIONS.map((field) => field.key);

function isHistoryStatus(status: ReportStatus) {
  return status === "DISETUJUI_FINAL" || status === "DITOLAK";
}

function getFinalDate(report: ReportItem) {
  return report.rejectedAt || report.approvedAt || report.createdAt;
}

function isPdfAttachment(report: ReportItem) {
  return report.attachmentType === "application/pdf";
}

function getRejectingAdmin(report: ReportItem) {
  return [...(report.histories || [])]
    .reverse()
    .find((history) => history.action === "TOLAK")?.admin;
}

function formatUserSearchLabel(user: UserSearchResult) {
  return `${user.nama}${user.nip ? ` - ${user.nip}` : ""}`;
}

export default function AdminHistoryPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "SEMUA" | "DISETUJUI_FINAL" | "DITOLAK"
  >("SEMUA");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  const [selectedExportUser, setSelectedExportUser] =
    useState<UserSearchResult | null>(null);
  const [userSearchResults, setUserSearchResults] = useState<
    UserSearchResult[]
  >([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<
    AppCategoryScope | "SEMUA"
  >("SEMUA");
  const [rejectedByRoleFilter, setRejectedByRoleFilter] = useState<
    AppRole | "SEMUA"
  >("SEMUA");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(HISTORY_PAGE_SIZE);
  const [showExportFilters, setShowExportFilters] = useState(false);
  const [selectedExportFields, setSelectedExportFields] =
    useState<ExportFieldKey[]>(DEFAULT_EXPORT_FIELDS);

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

      setReports((data.reports || []).filter((item: ReportItem) =>
        isHistoryStatus(item.status),
      ));
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setVisibleLimit(HISTORY_PAGE_SIZE);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUserQuery(userQuery);
      setVisibleLimit(HISTORY_PAGE_SIZE);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [userQuery]);

  useEffect(() => {
    if (selectedExportUser && userQuery !== formatUserSearchLabel(selectedExportUser)) {
      setSelectedExportUser(null);
    }
  }, [selectedExportUser, userQuery]);

  useEffect(() => {
    const query = debouncedUserQuery.trim();

    if (query.length < 2 || selectedExportUser) {
      setUserSearchResults([]);
      setUserSearchLoading(false);
      return;
    }

    let cancelled = false;

    async function searchUsers() {
      try {
        setUserSearchLoading(true);

        const params = new URLSearchParams({ q: query, limit: "8" });
        const res = await fetch(`/api/admin/users/search?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (cancelled) return;

        setUserSearchResults(res.ok ? data.users || [] : []);
      } catch (error) {
        console.error("SEARCH_EXPORT_USERS_ERROR:", error);

        if (!cancelled) {
          setUserSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setUserSearchLoading(false);
        }
      }
    }

    void searchUsers();

    return () => {
      cancelled = true;
    };
  }, [debouncedUserQuery, selectedExportUser]);

  useEffect(() => {
    setVisibleLimit(HISTORY_PAGE_SIZE);
  }, [
    statusFilter,
    debouncedUserQuery,
    selectedExportUser,
    categoryFilter,
    rejectedByRoleFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  async function handleExportExcel() {
    try {
      setExporting(true);
      setMessage("");

      const params = new URLSearchParams();

      if (debouncedSearchTerm.trim()) params.set("q", debouncedSearchTerm.trim());
      if (statusFilter !== "SEMUA") params.set("status", statusFilter);
      if (selectedExportUser) {
        params.set("userId", String(selectedExportUser.id));
      } else if (debouncedUserQuery.trim()) {
        params.set("userQuery", debouncedUserQuery.trim());
      }
      if (categoryFilter !== "SEMUA") params.set("category", categoryFilter);
      if (rejectedByRoleFilter !== "SEMUA") {
        params.set("rejectedByRole", rejectedByRoleFilter);
      }
      if (dateFromFilter) params.set("dateFrom", dateFromFilter);
      if (dateToFilter) params.set("dateTo", dateToFilter);
      params.set("fields", selectedExportFields.join(","));

      const query = params.toString();
      const res = await fetch(`/api/reports/export${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.message || "Gagal mengekspor riwayat laporan.");
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || "riwayat-laporan.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("EXPORT_ADMIN_HISTORY_ERROR:", error);
      setMessage("Terjadi kesalahan saat mengekspor riwayat laporan.");
    } finally {
      setExporting(false);
    }
  }

  const visibleReports = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "SEMUA" || report.status === statusFilter;
      const normalizedUserQuery = debouncedUserQuery.trim().toLowerCase();
      const matchesUser =
        selectedExportUser
          ? report.user.id === selectedExportUser.id
          : !normalizedUserQuery ||
        [report.user.nama, report.user.nip]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedUserQuery);
      const matchesCategory =
        categoryFilter === "SEMUA" || report.kategori === categoryFilter;
      const rejectingAdmin = getRejectingAdmin(report);
      const matchesRejectedByRole =
        rejectedByRoleFilter === "SEMUA" ||
        rejectingAdmin?.role === rejectedByRoleFilter;
      const finalDate = new Date(getFinalDate(report));
      const matchesDateFrom =
        !dateFromFilter || finalDate >= new Date(`${dateFromFilter}T00:00:00`);
      const matchesDateTo =
        !dateToFilter || finalDate <= new Date(`${dateToFilter}T23:59:59`);

      if (
        !matchesStatus ||
        !matchesUser ||
        !matchesCategory ||
        !matchesRejectedByRole ||
        !matchesDateFrom ||
        !matchesDateTo
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        report.id,
        report.namaBarang,
        report.user.nama,
        report.user.nip,
        report.namaPelapor,
        report.nomorRuangan,
        report.kodeUakpb,
        report.kode,
        report.lokasi,
        formatKategori(report.kategori),
        getCategoryScopeLabel(report.kategori),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [
    reports,
    debouncedSearchTerm,
    statusFilter,
    debouncedUserQuery,
    selectedExportUser,
    categoryFilter,
    rejectedByRoleFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const approvedFinalCount = reports.filter(
    (report) => report.status === "DISETUJUI_FINAL",
  ).length;
  const rejectedCount = reports.filter(
    (report) => report.status === "DITOLAK",
  ).length;
  const pagedReports = useMemo(
    () => visibleReports.slice(0, visibleLimit),
    [visibleReports, visibleLimit],
  );
  const hiddenReportCount = Math.max(
    visibleReports.length - pagedReports.length,
    0,
  );
  const activeExportFilterCount = [
    selectedExportUser || debouncedUserQuery.trim(),
    categoryFilter !== "SEMUA",
    rejectedByRoleFilter !== "SEMUA",
    dateFromFilter,
    dateToFilter,
    selectedExportFields.length !== EXPORT_FIELD_OPTIONS.length,
  ].filter(Boolean).length;
  const allExportFieldsSelected =
    selectedExportFields.length === EXPORT_FIELD_OPTIONS.length;

  function toggleExportField(field: ExportFieldKey) {
    setSelectedExportFields((current) => {
      if (current.includes(field)) {
        return current.length > 1
          ? current.filter((selectedField) => selectedField !== field)
          : current;
      }

      return [...current, field];
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-8 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Admin Panel
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">
              Riwayat Laporan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Arsip laporan yang sudah disetujui final atau ditolak.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4 text-blue-600" />
              Kembali
            </button>

            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Mengekspor..." : "Export Excel"}
            </button>
          </div>
        </div>

        <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard
            label="Total Riwayat"
            value={reports.length}
            description="Semua arsip final."
            colorClass="text-blue-600"
          />
          <SummaryCard
            label="Disetujui Final"
            value={approvedFinalCount}
            description={`Lolos ${getRoleLabel("ADMIN_1")} sampai ${getRoleLabel("ADMIN_5")}.`}
            colorClass="text-emerald-600"
          />
          <SummaryCard
            label="Ditolak"
            value={rejectedCount}
            description="Ditolak oleh admin."
            colorClass="text-rose-600"
          />
        </section>

        {message ? (
          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/30 px-5 py-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Arsip Laporan
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Menampilkan {pagedReports.length} dari{" "}
                    {visibleReports.length} laporan.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row xl:min-w-[720px]">
                  <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus:ring-blue-100">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Cari ID, pelapor, barang, kode"
                      className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    {searchTerm !== debouncedSearchTerm ? (
                      <span className="shrink-0 text-xs font-medium text-slate-400">
                        Menunggu...
                      </span>
                    ) : null}
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as
                          | "SEMUA"
                          | "DISETUJUI_FINAL"
                          | "DITOLAK",
                      )
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:min-w-[190px]"
                  >
                    <option value="SEMUA">Semua Status</option>
                    <option value="DISETUJUI_FINAL">Disetujui Final</option>
                    <option value="DITOLAK">Ditolak</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowExportFilters((current) => !current)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                  >
                    <Filter className="h-4 w-4" />
                    Filter Export
                    {activeExportFilterCount > 0 ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                        {activeExportFilterCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>

              {showExportFilters ? (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="relative">
                    <label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={userQuery}
                      onChange={(event) => setUserQuery(event.target.value)}
                      placeholder="Cari nama/NIP user"
                      className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    {selectedExportUser ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExportUser(null);
                          setUserQuery("");
                        }}
                        className="shrink-0 text-xs font-semibold text-rose-600"
                      >
                        Hapus
                      </button>
                    ) : userQuery !== debouncedUserQuery ? (
                      <span className="shrink-0 text-xs font-medium text-slate-400">
                        Menunggu...
                      </span>
                    ) : null}
                    </label>

                    {debouncedUserQuery.trim().length >= 2 &&
                    !selectedExportUser ? (
                      <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        {userSearchLoading ? (
                          <div className="px-3 py-2 text-sm text-slate-500">
                            Mencari user...
                          </div>
                        ) : userSearchResults.length > 0 ? (
                          userSearchResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setSelectedExportUser(user);
                                setUserQuery(formatUserSearchLabel(user));
                                setUserSearchResults([]);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-blue-50"
                            >
                              <span className="block font-semibold text-slate-800">
                                {user.nama}
                              </span>
                              <span className="text-xs text-slate-500">
                                NIP: {user.nip || "-"} -{" "}
                                {getRoleLabel(user.role)}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-rose-600">
                            Tidak ada user cocok.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value as AppCategoryScope | "SEMUA",
                      )
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="SEMUA">Semua Kategori</option>
                    {CATEGORY_FILTER_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {formatKategori(category)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={rejectedByRoleFilter}
                    onChange={(event) =>
                      setRejectedByRoleFilter(
                        event.target.value as AppRole | "SEMUA",
                      )
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="SEMUA">Penolak: Semua</option>
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={dateFromFilter}
                    onChange={(event) => setDateFromFilter(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    aria-label="Tanggal final mulai"
                  />

                  <input
                    type="date"
                    value={dateToFilter}
                    onChange={(event) => setDateToFilter(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    aria-label="Tanggal final akhir"
                  />

                  <div className="md:col-span-2 xl:col-span-5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-800">
                          Field Export
                        </p>

                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                          <input
                            type="checkbox"
                            checked={allExportFieldsSelected}
                            onChange={(event) =>
                              setSelectedExportFields(
                                event.target.checked
                                  ? DEFAULT_EXPORT_FIELDS
                                  : ["id"],
                              )
                            }
                            className="h-4 w-4 accent-blue-600"
                          />
                          Pilih Semua
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {EXPORT_FIELD_OPTIONS.map((field) => (
                          <label
                            key={field.key}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={selectedExportFields.includes(field.key)}
                              onChange={() => toggleExportField(field.key)}
                              className="h-4 w-4 accent-blue-600"
                            />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-slate-600">
              Memuat riwayat laporan...
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="px-5 py-8 text-slate-600">
              Tidak ada riwayat laporan yang cocok.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1060px] text-left">
                <thead>
                  <tr className="border-b border-blue-100 bg-blue-50/40 text-slate-600">
                    <TableHead>ID</TableHead>
                    <TableHead>Pelapor</TableHead>
                    <TableHead>Barang</TableHead>
                    <TableHead>Kode Ruangan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal Final</TableHead>
                    <TableHead align="right">Aksi</TableHead>
                  </tr>
                </thead>

                <tbody>
                  {pagedReports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-slate-100 transition hover:bg-blue-50/50"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-bold tracking-wide text-blue-700">
                          LP-{String(report.id).padStart(4, "0")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {report.namaPelapor || report.user.nama}
                        </p>
                        <p className="text-xs text-slate-500">
                          NIP: {report.user.nip || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-[220px] truncate font-semibold text-slate-800">
                          {report.namaBarang}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatKategori(report.kategori)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {report.nomorRuangan || report.lokasi || "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold tracking-[0.12em] ${getStatusClass(
                            report.status,
                          )}`}
                        >
                          {formatStatus(report.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {formatTanggal(getFinalDate(report))}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReport(report)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
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
                      setVisibleLimit((current) => current + HISTORY_PAGE_SIZE)
                    }
                    className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Tampilkan {Math.min(HISTORY_PAGE_SIZE, hiddenReportCount)}{" "}
                    laporan lagi
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {selectedReport ? (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      ) : null}
    </div>
  );
}

function ReportDetailModal({
  report,
  onClose,
}: {
  report: ReportItem;
  onClose: () => void;
}) {
  const mainAttachmentUrl = report.attachmentUrl || report.fotoUrl;
  const rejectingAdmin = getRejectingAdmin(report);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-bold tracking-wide text-blue-700">
                LP-{String(report.id).padStart(4, "0")}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold tracking-[0.12em] ${getStatusClass(
                  report.status,
                )}`}
              >
                {formatStatus(report.status)}
              </span>
            </div>
            <h3 className="mt-3 text-2xl font-bold text-slate-950">
              {report.namaBarang}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {formatKategori(report.kategori)} -{" "}
              {formatTanggal(report.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Tutup detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoBox label="Pelapor">
                {report.namaPelapor || report.user.nama}
              </InfoBox>
              <InfoBox label="NIP">{report.user.nip || "-"}</InfoBox>
              <InfoBox label="Kode Ruangan">
                {report.nomorRuangan || report.lokasi || "-"}
              </InfoBox>
              <InfoBox label="Kode UAKPB">{report.kodeUakpb || "-"}</InfoBox>
              <InfoBox label="Kode">{report.kode || "-"}</InfoBox>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Deskripsi Kerusakan
              </p>
              <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">
                {report.deskripsi}
              </p>
            </div>

            {report.status === "DITOLAK" && report.alasanPenolakan ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">
                  Alasan Penolakan
                </p>
                {rejectingAdmin ? (
                  <p className="mt-2 text-sm font-semibold text-rose-800">
                    Ditolak oleh {rejectingAdmin.nama}{" "}
                    ({getRoleLabel(rejectingAdmin.role)})
                  </p>
                ) : null}
                <p className="mt-2 whitespace-pre-line text-rose-700">
                  {report.alasanPenolakan}
                </p>
              </div>
            ) : null}

            {report.adminNotes ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">
                  Catatan Admin Terakhir
                </p>
                <p className="mt-2 whitespace-pre-line text-blue-700">
                  {report.adminNotes}
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                Riwayat Approval
              </p>
              {report.histories?.length ? (
                <div className="mt-3 space-y-3">
                  {report.histories.map((history) => (
                    <div
                      key={history.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-slate-900">
                          {history.admin.nama} ({getRoleLabel(history.admin.role)})
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatTanggal(history.createdAt)}
                        </p>
                      </div>
                      <p className="mt-1 text-slate-600">
                        {history.action}: {formatStatus(history.fromStatus)} -{" "}
                        {formatStatus(history.toStatus)}
                      </p>
                      {history.note ? (
                        <p className="mt-2 whitespace-pre-line text-slate-700">
                          {history.note}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Belum ada log approval.
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">
                Lampiran
              </p>
              {mainAttachmentUrl ? (
                isPdfAttachment(report) ? (
                  <a
                    href={mainAttachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    <FileText className="h-5 w-5 text-blue-600" />
                    {report.attachmentName || "Buka PDF"}
                  </a>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <Image
                      src={mainAttachmentUrl}
                      alt={report.namaBarang}
                      width={1000}
                      height={700}
                      className="max-h-[420px] w-full object-contain"
                      unoptimized
                    />
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Tidak ada lampiran
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <TimelineItem
                icon={<CalendarDays className="h-4 w-4 text-slate-500" />}
                label="Tanggal Laporan"
                value={formatTanggal(report.createdAt)}
              />
              {report.approvedAt ? (
                <TimelineItem
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  label="Disetujui Final"
                  value={formatTanggal(report.approvedAt)}
                />
              ) : null}
              {report.rejectedAt ? (
                <TimelineItem
                  icon={<XCircle className="h-4 w-4 text-rose-600" />}
                  label="Ditolak"
                  value={formatTanggal(report.rejectedAt)}
                />
              ) : null}
            </div>
          </aside>
        </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-extrabold ${colorClass}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 font-semibold text-slate-900">{children}</div>
    </div>
  );
}

function TimelineItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      {icon}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

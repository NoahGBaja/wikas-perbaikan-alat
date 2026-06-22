import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { listReportsRaw } from "@/src/lib/raw-data";
import { getApiSessionUser } from "@/src/lib/session";
import {
  ADMIN_ROLES,
  getCategoryScopeLabel,
  getRoleLabel,
  hasAdminAccess,
  type AppCategoryScope,
  type AppRole,
} from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";
import {
  formatKategori,
  formatStatus,
  formatTanggal,
  type ReportStatus,
} from "@/lib/report-helpers";

function isHistoryStatus(status: ReportStatus) {
  return status === "DISETUJUI_FINAL" || status === "DITOLAK";
}

const EXPORTABLE_ROLES: AppRole[] = ["USER", ...ADMIN_ROLES, "SUPER_ADMIN"];
const EXPORTABLE_CATEGORIES: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];
const EXPORT_COLUMNS = [
  { header: "ID Laporan", key: "id", width: 14 },
  { header: "Nama Pelapor", key: "namaPelapor", width: 24 },
  { header: "NIP Pelapor", key: "nipPelapor", width: 22 },
  { header: "Jenis Perbaikan", key: "kategori", width: 24 },
  { header: "Nama Barang", key: "namaBarang", width: 24 },
  { header: "Kode Ruangan", key: "kodeRuangan", width: 18 },
  { header: "Lokasi", key: "lokasi", width: 22 },
  { header: "Kode UAKPB", key: "kodeUakpb", width: 20 },
  { header: "Kode", key: "kode", width: 18 },
  { header: "Status", key: "status", width: 20 },
  { header: "Ditolak Oleh", key: "declinedBy", width: 28 },
  { header: "Alasan Penolakan", key: "alasanPenolakan", width: 36 },
  { header: "Catatan Admin", key: "adminNotes", width: 36 },
  { header: "Tanggal Dibuat", key: "createdAt", width: 18 },
  { header: "Tanggal Final", key: "finishedAt", width: 18 },
  { header: "Lampiran", key: "attachmentUrl", width: 34 },
  { header: "Riwayat Approval", key: "approvalHistory", width: 80 },
] as const;
type ExportColumnKey = (typeof EXPORT_COLUMNS)[number]["key"];
const EXPORT_COLUMN_KEYS = EXPORT_COLUMNS.map((column) => column.key);

type ReportExportFilter = {
  search: string;
  status: ReportStatus | "SEMUA";
  userId: number | null;
  userQuery: string;
  category: AppCategoryScope | "SEMUA";
  rejectedByRole: AppRole | "SEMUA";
  dateFrom: Date | null;
  dateTo: Date | null;
  fields: ExportColumnKey[];
};

function parseDateStart(value: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00.000`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseUserId(value: string | null) {
  if (!value) return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDateEnd(value: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRole(value: string | null): AppRole | "SEMUA" {
  if (!value || value === "SEMUA") return "SEMUA";

  return EXPORTABLE_ROLES.includes(value as AppRole)
    ? (value as AppRole)
    : "SEMUA";
}

function parseCategory(value: string | null): AppCategoryScope | "SEMUA" {
  if (!value || value === "SEMUA") return "SEMUA";

  return EXPORTABLE_CATEGORIES.includes(value as AppCategoryScope)
    ? (value as AppCategoryScope)
    : "SEMUA";
}

function parseStatus(value: string | null): ReportStatus | "SEMUA" {
  if (!value || value === "SEMUA") return "SEMUA";
  if (value === "DISETUJUI_FINAL" || value === "DITOLAK") return value;

  return "SEMUA";
}

function parseExportFilter(req: Request): ReportExportFilter {
  const url = new URL(req.url);
  const requestedFields = (url.searchParams.get("fields") || "")
    .split(",")
    .map((field) => field.trim())
    .filter((field): field is ExportColumnKey =>
      EXPORT_COLUMN_KEYS.includes(field as ExportColumnKey),
    );

  return {
    search: (url.searchParams.get("q") || "").trim().toLowerCase(),
    status: parseStatus(url.searchParams.get("status")),
    userId: parseUserId(url.searchParams.get("userId")),
    userQuery: (url.searchParams.get("userQuery") || "").trim().toLowerCase(),
    category: parseCategory(url.searchParams.get("category")),
    rejectedByRole: parseRole(url.searchParams.get("rejectedByRole")),
    dateFrom: parseDateStart(url.searchParams.get("dateFrom")),
    dateTo: parseDateEnd(url.searchParams.get("dateTo")),
    fields: requestedFields.length > 0 ? requestedFields : [...EXPORT_COLUMN_KEYS],
  };
}

function getFinalDateValue(
  report: Awaited<ReturnType<typeof listReportsRaw>>[number],
) {
  return report.rejectedAt || report.approvedAt || report.createdAt;
}

function reportMatchesFilter(
  report: Awaited<ReturnType<typeof listReportsRaw>>[number],
  filter: ReportExportFilter,
) {
  if (filter.status !== "SEMUA" && report.status !== filter.status) return false;
  if (filter.userId && report.user.id !== filter.userId) return false;
  if (
    !filter.userId &&
    filter.userQuery &&
    ![report.user.nama, report.user.nip]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(filter.userQuery)
  ) {
    return false;
  }
  if (filter.category !== "SEMUA" && report.kategori !== filter.category) {
    return false;
  }

  if (filter.rejectedByRole !== "SEMUA") {
    const rejectingAdmin = report.histories
      .slice()
      .reverse()
      .find((history) => history.action === "TOLAK")?.admin;

    if (rejectingAdmin?.role !== filter.rejectedByRole) return false;
  }

  const finalDate = getFinalDateValue(report);

  if (filter.dateFrom && finalDate < filter.dateFrom) return false;
  if (filter.dateTo && finalDate > filter.dateTo) return false;

  if (filter.search) {
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

    if (!haystack.includes(filter.search)) return false;
  }

  return true;
}

function getHistorySummary(
  histories: Awaited<ReturnType<typeof listReportsRaw>>[number]["histories"],
) {
  if (histories.length === 0) return "-";

  return histories
    .map((history) => {
      const note = history.note ? ` | Catatan: ${history.note}` : "";

      return `${formatTanggal(history.createdAt)} - ${history.admin.nama} (${getRoleLabel(history.admin.role)}) ${history.action}: ${formatStatus(history.fromStatus)} -> ${formatStatus(history.toStatus)}${note}`;
    })
    .join("\n");
}

function getDeclinedBy(
  report: Awaited<ReturnType<typeof listReportsRaw>>[number],
) {
  const rejection = report.histories.find(
    (history) => history.action === "TOLAK",
  );

  if (!rejection) return "-";

  return `${rejection.admin.nama} (${getRoleLabel(rejection.admin.role)})`;
}

function createFileName() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);

  return `riwayat-laporan-${datePart}.xlsx`;
}

export async function GET(req: Request) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const filter = parseExportFilter(req);
    const reports = (await listReportsRaw()).filter(
      (report) =>
        isHistoryStatus(report.status) &&
        canAdminAccessReport({
          role: authUser.role,
          isSuperAdmin: authUser.isSuperAdmin,
          categoryScope: authUser.categoryScope,
          reportCategory: report.kategori,
        }) &&
        reportMatchesFilter(report, filter),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "WIKAS Perbaikan Alat";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Riwayat Laporan", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = EXPORT_COLUMNS.filter((column) =>
      filter.fields.includes(column.key),
    );

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF6FF" },
    };

    for (const report of reports) {
      const finishedAt = report.approvedAt || report.rejectedAt || null;

      worksheet.addRow({
        id: `LP-${String(report.id).padStart(4, "0")}`,
        namaPelapor: report.namaPelapor || report.user.nama,
        nipPelapor: report.user.nip || "-",
        kategori: formatKategori(report.kategori),
        namaBarang: report.namaBarang,
        kodeRuangan: report.nomorRuangan || "-",
        lokasi: report.lokasi,
        kodeUakpb: report.kodeUakpb || "-",
        kode: report.kode || "-",
        status: formatStatus(report.status),
        declinedBy: getDeclinedBy(report),
        alasanPenolakan: report.alasanPenolakan || "-",
        adminNotes: report.adminNotes || "-",
        createdAt: formatTanggal(report.createdAt),
        finishedAt: formatTanggal(finishedAt),
        attachmentUrl: report.attachmentUrl || report.fotoUrl || "-",
        approvalHistory: getHistorySummary(report.histories),
      });
    }

    worksheet.eachRow((row, rowNumber) => {
      row.alignment = {
        vertical: "top",
        wrapText: true,
      };

      if (rowNumber > 1) {
        row.height = 48;
      }
    });

    worksheet.autoFilter = {
      from: "A1",
      to: `${worksheet.getColumn(filter.fields.length).letter}1`,
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${createFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("EXPORT_REPORT_HISTORY_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal mengekspor riwayat laporan." },
      { status: 500 },
    );
  }
}

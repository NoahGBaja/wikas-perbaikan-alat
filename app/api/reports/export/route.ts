import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import {
  iterateReportsRaw,
  type ReportPageFilters,
  type ReportRow,
} from "@/src/lib/raw-data";
import { getApiSessionUser } from "@/src/lib/session";
import {
  ADMIN_ROLES,
  getCategoryScopeLabel,
  getRoleLabel,
  hasAdminAccess,
  isSuperAdmin as hasSuperAdminAccess,
  type AppCategoryScope,
  type AppRole,
} from "@/src/lib/roles";
import { canAdminAccessReport, getRequiredAdminRole } from "@/src/lib/workflow";
import {
  formatKategori,
  formatStatus,
  formatTanggal,
  type ReportStatus,
} from "@/lib/report-helpers";
import { formatTicketFallback } from "@/src/lib/tickets";
import { normalizeStoredItemCode } from "@/src/lib/item-code";
import {
  IN_PROGRESS_STATUS_FILTER,
  isInProgressStatus,
} from "@/src/lib/report-status-filters";
import { isRateLimited } from "@/src/lib/rate-limit";

export const runtime = "nodejs";

const EXPORTABLE_ROLES: AppRole[] = ["USER", ...ADMIN_ROLES, "SUPER_ADMIN", "EXECUTIVE"];
const EXPORTABLE_CATEGORIES: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];
const EXPORTABLE_STATUSES: ReportStatus[] = [
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
  "DISETUJUI_FINAL",
  "MENUNGGU_KONFIRMASI",
  "TELAH_BERFUNGSI",
  "TIDAK_DAPAT_DIGUNAKAN",
  "DITOLAK",
];
const EXPORT_COLUMNS = [
  { header: "Tiket", key: "id", width: 22 },
  { header: "Nama Pelapor", key: "namaPelapor", width: 24 },
  { header: "NIP Pelapor", key: "nipPelapor", width: 22 },
  { header: "Jenis Perbaikan", key: "kategori", width: 24 },
  { header: "Subkategori", key: "subcategory", width: 20 },
  { header: "Nama Barang", key: "namaBarang", width: 24 },
  { header: "Kode Ruangan", key: "kodeRuangan", width: 18 },
  { header: "Lokasi", key: "lokasi", width: 22 },
  { header: "Nama Barang", key: "kodeUakpb", width: 20 },
  { header: "Kode Barang", key: "kode", width: 24 },
  { header: "Biaya Perbaikan / Anggaran", key: "repairCost", width: 26 },
  { header: "Status", key: "status", width: 20 },
  { header: "Ditolak Oleh", key: "declinedBy", width: 28 },
  { header: "Alasan Penolakan", key: "alasanPenolakan", width: 36 },
  { header: "Catatan Admin", key: "adminNotes", width: 36 },
  { header: "Tanggal Dibuat", key: "createdAt", width: 18 },
  { header: "Tanggal Final", key: "finishedAt", width: 18 },
  { header: "Lampiran", key: "attachmentUrl", width: 34 },
  { header: "Riwayat Persetujuan", key: "approvalHistory", width: 80 },
] as const;
type ExportColumnKey = (typeof EXPORT_COLUMNS)[number]["key"];
const EXPORT_COLUMN_KEYS = EXPORT_COLUMNS.map((column) => column.key);

type ReportExportFilter = {
  search: string;
  status:
    | ReportStatus
    | "SEMUA"
    | typeof IN_PROGRESS_STATUS_FILTER
    | "TIDAK_VALID";
  historyOnly: boolean;
  userId: number | null;
  userQuery: string;
  category: AppCategoryScope | "SEMUA";
  subcategory: string;
  room: string;
  responsibleRole: AppRole | "SEMUA";
  processState:
    | "SEMUA"
    | "UNFINISHED"
    | "COMPLETED"
    | "ACCEPTED"
    | "REJECTED"
    | "ONGOING";
  rejectedByRole: AppRole | "SEMUA";
  budget: "SEMUA" | "BELOW_5" | "BETWEEN_5_10" | "ABOVE_10" | "CUSTOM";
  budgetMin: number | null;
  budgetMax: number | null;
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

function parseStatus(
  value: string | null,
):
  | ReportStatus
  | "SEMUA"
  | typeof IN_PROGRESS_STATUS_FILTER
  | "TIDAK_VALID" {
  if (!value || value === "SEMUA") return "SEMUA";
  if (value === IN_PROGRESS_STATUS_FILTER || value === "BERJALAN") {
    return IN_PROGRESS_STATUS_FILTER;
  }

  return EXPORTABLE_STATUSES.includes(value as ReportStatus)
    ? (value as ReportStatus)
    : "TIDAK_VALID";
}

function parseNumber(value: string | null) {
  if (!value) return null;

  const parsed = Number(value.replace(/\D/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function parseBudget(value: string | null): ReportExportFilter["budget"] {
  if (
    value === "BELOW_5" ||
    value === "BETWEEN_5_10" ||
    value === "ABOVE_10" ||
    value === "CUSTOM"
  ) {
    return value;
  }

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
    historyOnly: url.searchParams.get("historyOnly") === "true",
    userId: parseUserId(url.searchParams.get("userId")),
    userQuery: (url.searchParams.get("userQuery") || "").trim().toLowerCase(),
    category: parseCategory(url.searchParams.get("category")),
    subcategory: (url.searchParams.get("subcategory") || "").trim(),
    room: (url.searchParams.get("room") || "").trim().toLowerCase(),
    responsibleRole: parseRole(url.searchParams.get("responsibleRole")),
    processState:
      url.searchParams.get("processState") === "UNFINISHED" ||
      url.searchParams.get("processState") === "COMPLETED" ||
      url.searchParams.get("processState") === "ACCEPTED" ||
      url.searchParams.get("processState") === "REJECTED" ||
      url.searchParams.get("processState") === "ONGOING"
        ? (url.searchParams.get("processState") as ReportExportFilter["processState"])
        : "SEMUA",
    rejectedByRole: parseRole(url.searchParams.get("rejectedByRole")),
    budget: parseBudget(url.searchParams.get("budget")),
    budgetMin: parseNumber(url.searchParams.get("budgetMin")),
    budgetMax: parseNumber(url.searchParams.get("budgetMax")),
    dateFrom: parseDateStart(url.searchParams.get("dateFrom")),
    dateTo: parseDateEnd(url.searchParams.get("dateTo")),
    fields: requestedFields.length > 0 ? requestedFields : [...EXPORT_COLUMN_KEYS],
  };
}

function reportMatchesFilter(
  report: ReportRow,
  filter: ReportExportFilter,
) {
  if (filter.status === "TIDAK_VALID") return false;
  if (
    filter.status === IN_PROGRESS_STATUS_FILTER &&
    !isInProgressStatus(report.status)
  ) {
    return false;
  }
  if (
    filter.status !== "SEMUA" &&
    filter.status !== IN_PROGRESS_STATUS_FILTER &&
    report.status !== filter.status
  ) {
    return false;
  }
  if (
    filter.historyOnly &&
    filter.status === "SEMUA" &&
    report.status !== "DISETUJUI_FINAL" &&
    report.status !== "DITOLAK"
  ) {
    return false;
  }
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
  if (filter.subcategory && report.subcategory !== filter.subcategory) {
    return false;
  }
  if (
    filter.room &&
    ![report.namaRuangan, report.nomorRuangan, report.lokasi]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(filter.room)
  ) {
    return false;
  }
  if (
    filter.responsibleRole !== "SEMUA" &&
    getRequiredAdminRole(report.status) !== filter.responsibleRole
  ) {
    return false;
  }

  if (
    filter.processState === "UNFINISHED" &&
    ["TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN", "DITOLAK"].includes(report.status)
  ) {
    return false;
  }
  if (
    filter.processState === "COMPLETED" &&
    !["TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN"].includes(report.status)
  ) {
    return false;
  }
  if (filter.processState === "ACCEPTED" && report.status !== "TELAH_BERFUNGSI") {
    return false;
  }
  if (filter.processState === "REJECTED" && report.status !== "DITOLAK") {
    return false;
  }
  if (
    filter.processState === "ONGOING" &&
    !isInProgressStatus(report.status)
  ) {
    return false;
  }

  if (filter.rejectedByRole !== "SEMUA") {
    const rejectingAdmin = report.histories
      .slice()
      .reverse()
      .find((history) => history.action === "TOLAK")?.admin;

    if (rejectingAdmin?.role !== filter.rejectedByRole) return false;
  }

  const reportDate = report.createdAt;

  if (filter.dateFrom && reportDate < filter.dateFrom) return false;
  if (filter.dateTo && reportDate > filter.dateTo) return false;

  const repairCost = Number(report.repairCost || 0);
  if (filter.budget === "BELOW_5" && !(repairCost < 5000000)) return false;
  if (filter.budget === "BETWEEN_5_10" && !(repairCost >= 5000000 && repairCost <= 10000000)) return false;
  if (filter.budget === "ABOVE_10" && !(repairCost > 10000000)) return false;
  if (filter.budget === "CUSTOM") {
    if (filter.budgetMin !== null && repairCost < filter.budgetMin) return false;
    if (filter.budgetMax !== null && repairCost > filter.budgetMax) return false;
  }

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
      report.nup,
      report.ticket,
      report.subcategory,
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
  histories: ReportRow["histories"],
) {
  if (histories.length === 0) return "-";

  return histories
    .map((history) => {
      const note = history.note ? ` | Catatan: ${history.note}` : "";

      const actionLabel = history.action === "TOLAK" ? "Tolak" : "Terima";

      return `${formatTanggal(history.createdAt)} - ${history.admin.nama} (${getRoleLabel(history.admin.role)}) ${actionLabel}: ${formatStatus(history.fromStatus)} -> ${formatStatus(history.toStatus)}${note}`;
    })
    .join("\n");
}

function getDeclinedBy(
  report: ReportRow,
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportErrorResponse(req: Request, message: string, status = 500) {
  const accept = req.headers.get("accept") || "";

  if (accept.includes("text/html")) {
    const safeMessage = escapeHtml(message);

    return new NextResponse(
      `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ekspor Gagal</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    section { max-width: 520px; width: 100%; border: 1px solid #fecdd3; background: #fff1f2; border-radius: 16px; padding: 24px; box-shadow: 0 12px 30px rgba(15,23,42,.08); }
    h1 { margin: 0; font-size: 24px; }
    p { line-height: 1.6; color: #9f1239; }
    a { display: inline-flex; margin-top: 12px; background: #2563eb; color: white; padding: 10px 14px; border-radius: 10px; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>Ekspor gagal</h1>
      <p>${safeMessage}</p>
      <a href="/dashboard/admin">Kembali ke Dasbor</a>
    </section>
  </main>
</body>
</html>`,
      {
        status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json({ message }, { status });
}

export async function GET(req: Request) {
  let temporaryFilePath: string | null = null;

  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return exportErrorResponse(req, "Sesi masuk tidak ditemukan. Silakan masuk kembali.", 401);
    }

    if (!hasAdminAccess(authUser)) {
      return exportErrorResponse(req, "Anda tidak memiliki akses untuk mengekspor laporan.", 403);
    }

    if (
      await isRateLimited(`report-export:user:${authUser.id}`, {
        limit: 5,
        windowMs: 10 * 60 * 1000,
      })
    ) {
      return exportErrorResponse(
        req,
        "Terlalu banyak permintaan ekspor. Coba lagi beberapa menit.",
        429,
      );
    }

    const filter = parseExportFilter(req);
    if (filter.status === "TIDAK_VALID") {
      return exportErrorResponse(req, "Filter status tidak valid.", 400);
    }

    const canSeeAllCategories = hasSuperAdminAccess(authUser);
    const databaseFilters: ReportPageFilters = {
      userId: filter.userId || undefined,
      userQuery: !filter.userId ? filter.userQuery || undefined : undefined,
      accessCategory: canSeeAllCategories
        ? undefined
        : authUser.categoryScope || undefined,
      category: filter.category === "SEMUA" ? undefined : filter.category,
      status:
        filter.status !== "SEMUA" &&
        filter.status !== IN_PROGRESS_STATUS_FILTER
          ? filter.status
          : undefined,
      inProgress: filter.status === IN_PROGRESS_STATUS_FILTER || undefined,
      subcategory: filter.subcategory || undefined,
      search: filter.search || undefined,
      rejectedByRole:
        filter.rejectedByRole === "SEMUA"
          ? undefined
          : filter.rejectedByRole,
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      budget:
        filter.budget === "BELOW_5" ||
        filter.budget === "BETWEEN_5_10" ||
        filter.budget === "ABOVE_10"
          ? filter.budget
          : undefined,
    };

    const exportDirectory = path.join(process.cwd(), ".data", "exports");
    await mkdir(exportDirectory, { recursive: true });
    temporaryFilePath = path.join(exportDirectory, `${randomUUID()}.xlsx`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: temporaryFilePath,
      useStyles: true,
      useSharedStrings: true,
    });
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

    for await (const reports of iterateReportsRaw({
      filters: databaseFilters,
      batchSize: 250,
    })) {
      for (const report of reports) {
        if (
          !canAdminAccessReport({
            role: authUser.role,
            isSuperAdmin: canSeeAllCategories,
            categoryScope: canSeeAllCategories ? null : authUser.categoryScope,
            reportCategory: report.kategori,
          }) ||
          !reportMatchesFilter(report, filter)
        ) {
          continue;
        }

        const finishedAt = report.approvedAt || report.rejectedAt || null;
        const repairCost = report.repairCost ? Number(report.repairCost) : null;

        const row = worksheet.addRow({
        id: formatTicketFallback(report),
        namaPelapor: report.namaPelapor || report.user.nama,
        nipPelapor: report.user.nip || "-",
        kategori: formatKategori(report.kategori),
        subcategory: report.subcategory || "-",
        namaBarang: report.namaBarang,
        kodeRuangan: report.nomorRuangan || "-",
        lokasi: report.namaRuangan || report.lokasi,
        kodeUakpb: report.namaBarang || report.kodeUakpb || "-",
        kode:
          normalizeStoredItemCode(report.kode || "", report.nup || "") || "-",
        repairCost,
        status: formatStatus(report.status),
        declinedBy: getDeclinedBy(report),
        alasanPenolakan: report.alasanPenolakan || "-",
        adminNotes: report.adminNotes || "-",
        createdAt: formatTanggal(report.createdAt),
        finishedAt: formatTanggal(finishedAt),
        attachmentUrl: report.attachments.length
          ? report.attachments.map((attachment) => attachment.url).join("\n")
          : report.attachmentUrl || report.fotoUrl || "-",
        approvalHistory: getHistorySummary(report.histories),
      });

        const repairCostColumnIndex = worksheet.columns.findIndex(
          (column) => column.key === "repairCost",
        ) + 1;

        if (repairCostColumnIndex > 0 && repairCost !== null) {
          row.getCell(repairCostColumnIndex).numFmt = '"Rp"#,##0;[Red]-"Rp"#,##0';
        }

        row.alignment = { vertical: "top", wrapText: true };
        row.height = 48;
        row.commit();
      }
    }

    worksheet.autoFilter = {
      from: "A1",
      to: `${worksheet.getColumn(filter.fields.length).letter}1`,
    };

    worksheet.commit();
    await workbook.commit();

    const completedFilePath = temporaryFilePath;
    temporaryFilePath = null;
    const nodeStream = createReadStream(completedFilePath);
    nodeStream.once("close", () => {
      void unlink(completedFilePath).catch((error) => {
        console.error("EXPORT_TEMP_FILE_CLEANUP_ERROR:", error);
      });
    });

    return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${createFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (temporaryFilePath) {
      await unlink(temporaryFilePath).catch(() => undefined);
    }
    console.error("EXPORT_REPORT_HISTORY_ERROR:", error);

    return exportErrorResponse(
      req,
      "Gagal mengekspor laporan. Coba ulangi dari dasbor, atau cek filter yang dipilih.",
      500,
    );
  }
}

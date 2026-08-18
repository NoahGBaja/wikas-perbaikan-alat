import { NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import { protectReportAttachmentReferences } from "@/src/lib/report-attachment-urls";
import {
  getReportSummaryRaw,
  listReportsPageRaw,
  type ReportKategori,
} from "@/src/lib/raw-data";
import {
  hasAdminAccess,
  isCategoryScopedRole,
  isSuperAdmin as hasSuperAdminAccess,
  type AppRole,
} from "@/src/lib/roles";
import type { ReportStatus } from "@/src/lib/workflow";

const VALID_STATUSES: ReportStatus[] = [
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
const VALID_CATEGORIES: ReportKategori[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];
const VALID_REJECTING_ROLES: AppRole[] = [
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
];

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(req: Request) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json(
        { message: "Sesi masuk tidak ditemukan." },
        { status: 401 },
      );
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const url = new URL(req.url);
    const requestedCategory = url.searchParams.get("category");
    const category = VALID_CATEGORIES.includes(requestedCategory as ReportKategori)
      ? (requestedCategory as ReportKategori)
      : undefined;
    const statusValue = url.searchParams.get("status");
    const status = VALID_STATUSES.includes(statusValue as ReportStatus)
      ? (statusValue as ReportStatus)
      : undefined;
    const rejectedRoleValue = url.searchParams.get("rejectedByRole");
    const rejectedByRole = VALID_REJECTING_ROLES.includes(
      rejectedRoleValue as AppRole,
    )
      ? (rejectedRoleValue as AppRole)
      : undefined;
    const requestedUserId = positiveInteger(url.searchParams.get("userId"), 0);
    const accessCategory =
      !hasSuperAdminAccess(authUser) && isCategoryScopedRole(authUser.role)
        ? (authUser.categoryScope as ReportKategori | null)
        : null;
    const allowedCategory = accessCategory
      ? category === accessCategory || !category
        ? accessCategory
        : undefined
      : category;

    if (accessCategory && category && category !== accessCategory) {
      return NextResponse.json({
        reports: [],
        total: 0,
        limit: positiveInteger(url.searchParams.get("limit"), 12),
        offset: positiveInteger(url.searchParams.get("offset"), 0),
        hasMore: false,
        summary: await getReportSummaryRaw({ accessCategory }),
      });
    }

    const scopeFilters = {
      ...(accessCategory ? { accessCategory } : {}),
    };
    const filters = {
      ...scopeFilters,
      ...(allowedCategory ? { category: allowedCategory } : {}),
      ...(status ? { status } : {}),
      ...(statusValue === "DALAM_PROSES" ? { inProgress: true } : {}),
      ...(url.searchParams.get("subcategory")
        ? { subcategory: url.searchParams.get("subcategory") || undefined }
        : {}),
      ...(url.searchParams.get("q")
        ? { search: url.searchParams.get("q") || undefined }
        : {}),
      ...(url.searchParams.get("userQuery")
        ? { userQuery: url.searchParams.get("userQuery") || undefined }
        : {}),
      ...(requestedUserId > 0 ? { userId: requestedUserId } : {}),
      ...(rejectedByRole ? { rejectedByRole } : {}),
      ...(parseDate(url.searchParams.get("dateFrom"))
        ? { dateFrom: parseDate(url.searchParams.get("dateFrom")) }
        : {}),
      ...(parseDate(url.searchParams.get("dateTo"), true)
        ? { dateTo: parseDate(url.searchParams.get("dateTo"), true) }
        : {}),
      ...(["BELOW_5", "BETWEEN_5_10", "ABOVE_10"].includes(
        url.searchParams.get("budget") || "",
      )
        ? {
            budget: url.searchParams.get("budget") as
              | "BELOW_5"
              | "BETWEEN_5_10"
              | "ABOVE_10",
          }
        : {}),
    };

    const [page, summary] = await Promise.all([
      listReportsPageRaw({
        filters,
        take: positiveInteger(url.searchParams.get("limit"), 12),
        skip: positiveInteger(url.searchParams.get("offset"), 0),
      }),
      getReportSummaryRaw(scopeFilters),
    ]);

    return NextResponse.json({
      ...page,
      reports: page.reports.map(protectReportAttachmentReferences),
      summary,
    });
  } catch (error) {
    console.error("ADMIN_REPORTS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}

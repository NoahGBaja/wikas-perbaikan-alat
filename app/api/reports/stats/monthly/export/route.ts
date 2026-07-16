import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { formatStatus, formatTanggal } from "@/lib/report-helpers";
import { getMonthlyReportStats } from "@/src/lib/monthly-report-stats";
import { getApiSessionUser } from "@/src/lib/session";
import {
  hasAdminAccess,
  isCategoryScopedRole,
  isSuperAdmin as hasSuperAdminAccess,
} from "@/src/lib/roles";

function createFileName(month: string) {
  const normalizedMonth = month
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

  return `statistik-laporan-${normalizedMonth || "bulanan"}.xlsx`;
}

function applyHeaderStyle(worksheet: ExcelJS.Worksheet) {
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
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const canSeeAllCategories = hasSuperAdminAccess(authUser);
    const stats = await getMonthlyReportStats({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
      status: searchParams.get("status"),
      categoryScope: !canSeeAllCategories && isCategoryScopedRole(authUser.role)
        ? authUser.categoryScope
        : null,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "WIKAS Perbaikan Alat";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet("Ringkasan", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    summarySheet.columns = [
      { header: "Metrik", key: "metric", width: 32 },
      { header: "Nilai", key: "value", width: 18 },
    ];

    applyHeaderStyle(summarySheet);

    summarySheet.addRows([
      { metric: "Periode", value: stats.month },
      {
        metric: "Filter Status",
        value:
          stats.selectedStatus === "SEMUA"
            ? "Semua Status"
            : formatStatus(stats.selectedStatus),
      },
      { metric: "Total Laporan", value: stats.summary.totalReports },
      { metric: "Total Pelapor Unik", value: stats.summary.totalUniqueReporters },
      { metric: "Total Menunggu", value: stats.summary.totalWaiting },
      { metric: "Total Disetujui Final", value: stats.summary.totalApproved },
      { metric: "Total Ditolak", value: stats.summary.totalRejected },
      {
        metric: "Pelapor Teratas",
        value: stats.topReporter
          ? `${stats.topReporter.nama} (${stats.topReporter.totalReports})`
          : "-",
      },
    ]);

    const reporterSheet = workbook.addWorksheet("Rekap Pelapor", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    reporterSheet.columns = [
      { header: "ID Pengguna", key: "userId", width: 12 },
      { header: "Nama Pelapor", key: "nama", width: 28 },
      { header: "NIP", key: "nip", width: 22 },
      { header: "Total Laporan", key: "totalReports", width: 16 },
      { header: "Status Terakhir", key: "lastStatus", width: 30 },
      { header: "Jenis Terbanyak", key: "topCategory", width: 24 },
      { header: "Laporan Terakhir", key: "latestReportAt", width: 24 },
    ];

    applyHeaderStyle(reporterSheet);

    for (const reporter of stats.reporterStats) {
      reporterSheet.addRow({
        userId: reporter.userId,
        nama: reporter.nama,
        nip: reporter.nip || "-",
        totalReports: reporter.totalReports,
        lastStatus: formatStatus(reporter.lastStatus),
        topCategory: reporter.topCategory,
        latestReportAt: formatTanggal(reporter.latestReportAt),
      });
    }

    const breakdownSheet = workbook.addWorksheet("Breakdown", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    breakdownSheet.columns = [
      { header: "Jenis", key: "type", width: 18 },
      { header: "Label", key: "label", width: 32 },
      { header: "Total", key: "total", width: 14 },
    ];

    applyHeaderStyle(breakdownSheet);

    for (const category of stats.categories.items) {
      breakdownSheet.addRow({
        type: "Kategori",
        label: category.label,
        total: category.total,
      });
    }

    for (const status of stats.statusBreakdown) {
      breakdownSheet.addRow({
        type: "Status",
        label: status.label,
        total: status.total,
      });
    }

    for (const worksheet of workbook.worksheets) {
      worksheet.eachRow((row) => {
        row.alignment = {
          vertical: "top",
          wrapText: true,
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${createFileName(stats.month)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("EXPORT_MONTHLY_REPORT_STATS_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal mengekspor statistik bulanan." },
      { status: 500 },
    );
  }
}

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { listReportsRaw } from "@/src/lib/raw-data";
import { getApiSessionUser } from "@/src/lib/session";
import { getRoleLabel, isAdminRole } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";
import {
  formatKategori,
  formatSeverity,
  formatStatus,
  formatTanggal,
  type ReportStatus,
} from "@/lib/report-helpers";

function isHistoryStatus(status: ReportStatus) {
  return status === "DISETUJUI_FINAL" || status === "DITOLAK";
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

export async function GET() {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const reports = (await listReportsRaw()).filter(
      (report) =>
        isHistoryStatus(report.status) &&
        canAdminAccessReport({
          role: authUser.role,
          categoryScope: authUser.categoryScope,
          reportCategory: report.kategori,
        }),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "WIKAS Perbaikan Alat";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Riwayat Laporan", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = [
      { header: "ID Laporan", key: "id", width: 14 },
      { header: "Nama Pelapor", key: "namaPelapor", width: 24 },
      { header: "NIP Pelapor", key: "nipPelapor", width: 22 },
      { header: "Role Pelapor", key: "rolePelapor", width: 30 },
      { header: "Jenis Perbaikan", key: "kategori", width: 24 },
      { header: "Nama Barang", key: "namaBarang", width: 24 },
      { header: "Kode Ruangan", key: "kodeRuangan", width: 18 },
      { header: "Lokasi", key: "lokasi", width: 22 },
      { header: "Kode UAKPB", key: "kodeUakpb", width: 20 },
      { header: "Kode", key: "kode", width: 18 },
      { header: "Tingkat Kerusakan", key: "severity", width: 18 },
      { header: "Status", key: "status", width: 20 },
      { header: "Ditolak Oleh", key: "declinedBy", width: 28 },
      { header: "Alasan Penolakan", key: "alasanPenolakan", width: 36 },
      { header: "Catatan Admin", key: "adminNotes", width: 36 },
      { header: "Tanggal Dibuat", key: "createdAt", width: 18 },
      { header: "Tanggal Final", key: "finishedAt", width: 18 },
      { header: "Lampiran", key: "attachmentUrl", width: 34 },
      { header: "Riwayat Approval", key: "approvalHistory", width: 80 },
    ];

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
        rolePelapor: getRoleLabel(report.user.role),
        kategori: formatKategori(report.kategori),
        namaBarang: report.namaBarang,
        kodeRuangan: report.nomorRuangan || "-",
        lokasi: report.lokasi,
        kodeUakpb: report.kodeUakpb || "-",
        kode: report.kode || "-",
        severity: formatSeverity(report.severity),
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
      to: "S1",
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

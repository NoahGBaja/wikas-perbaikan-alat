import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { formatTanggal } from "@/lib/report-helpers";
import { listUsersWithReportCountRaw } from "@/src/lib/raw-data";
import { getApiSessionUser } from "@/src/lib/session";
import {
  getCategoryScopeLabel,
  getRoleLabel,
  isSuperAdmin as hasSuperAdminAccess,
} from "@/src/lib/roles";

function createFileName() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);

  return `daftar-user-${datePart}.xlsx`;
}

export async function GET(req: Request) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (!hasSuperAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get("q") || "").trim();
    const { users } = await listUsersWithReportCountRaw({ search, take: 10000 });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "WIKAS Perbaikan Alat";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Daftar Pengguna", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = [
      { header: "ID Pengguna", key: "id", width: 12 },
      { header: "Nama", key: "nama", width: 28 },
      { header: "NIP", key: "nip", width: 22 },
      { header: "Peran", key: "role", width: 28 },
      { header: "Admin Utama", key: "isSuperAdmin", width: 16 },
      { header: "Kategori Peran", key: "categoryScope", width: 20 },
      { header: "Total Laporan", key: "totalReports", width: 16 },
      { header: "Laporan Aktif", key: "activeReports", width: 16 },
      { header: "Tanggal Dibuat", key: "createdAt", width: 20 },
      { header: "Terakhir Diubah", key: "updatedAt", width: 20 },
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

    for (const user of users) {
      worksheet.addRow({
        id: user.id,
        nama: user.nama,
        nip: user.nip || "-",
        role: getRoleLabel(user.role),
        isSuperAdmin: user.isSuperAdmin ? "Ya" : "Tidak",
        categoryScope: getCategoryScopeLabel(user.categoryScope),
        totalReports: user._count.reports,
        activeReports: user._count.activeReports,
        createdAt: formatTanggal(user.createdAt),
        updatedAt: formatTanggal(user.updatedAt),
      });
    }

    worksheet.eachRow((row) => {
      row.alignment = {
        vertical: "top",
        wrapText: true,
      };
    });

    worksheet.autoFilter = {
      from: "A1",
      to: "J1",
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
    console.error("EXPORT_ADMIN_USERS_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal mengekspor daftar user." },
      { status: 500 },
    );
  }
}

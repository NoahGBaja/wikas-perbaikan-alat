import { NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import { findReportByIdRaw } from "@/src/lib/raw-data";
import { hasAdminAccess } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";
import { formatKategori, formatStatus, formatTanggal } from "@/lib/report-helpers";
import { formatTicketFallback } from "@/src/lib/tickets";
import { formatRupiah } from "@/src/lib/formatting";

function parseReportId(id: string) {
  const reportId = Number(id);

  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines: string[]) {
  const pageHeight = 842;
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 792 Td",
    `(${pdfEscape(lines[0] || "Laporan")}) Tj`,
    "/F1 10 Tf",
    "0 -24 Td",
    ...lines.slice(1).flatMap((line) => [
      `(${pdfEscape(line.slice(0, 110))}) Tj`,
      "0 -15 Td",
    ]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const { id } = await ctx.params;
    const reportId = parseReportId(id);

    if (!reportId) {
      return NextResponse.json({ message: "Tiket tidak valid." }, { status: 400 });
    }

    const report = await findReportByIdRaw(reportId);

    if (!report) {
      return NextResponse.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
    }

    if (hasAdminAccess(authUser)) {
      const allowed = canAdminAccessReport({
        role: authUser.role,
        isSuperAdmin: authUser.isSuperAdmin,
        categoryScope: authUser.categoryScope,
        reportCategory: report.kategori,
      });

      if (!allowed) return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    } else if (report.userId !== authUser.id) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const ticket = formatTicketFallback(report);
    const lines = [
      `Laporan ${ticket}`,
      `Status: ${formatStatus(report.status)}`,
      `Pelapor: ${report.namaPelapor || report.user.nama}`,
      `NIP: ${report.user.nip || "-"}`,
      `Kategori: ${formatKategori(report.kategori)}`,
      `Subkategori: ${report.subcategory || "-"}`,
      `Tipe Barang: ${report.itemType || "-"}`,
      `Nama Barang: ${report.namaBarang}`,
      `Kode Barang: ${report.kode || "-"}`,
      `NUP: ${report.nup || "-"}`,
      `Ruangan: ${report.namaRuangan || report.lokasi}`,
      `Kode Ruangan: ${report.nomorRuangan || "-"}`,
      `Biaya Perbaikan / Anggaran: ${formatRupiah(report.repairCost)}`,
      `Tanggal Dibuat: ${formatTanggal(report.createdAt)}`,
      `Tanggal Selesai: ${formatTanggal(report.finishedAt)}`,
      "",
      "Deskripsi:",
      ...report.deskripsi.split(/\r?\n/),
      "",
      "Catatan:",
      report.adminNotes || report.completionNotes || "-",
      "",
      "Lampiran:",
      ...(report.attachments.length
        ? report.attachments.map((attachment) => attachment.url)
        : [report.attachmentUrl || report.fotoUrl || "-"]),
    ];

    return new NextResponse(buildPdf(lines), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${ticket}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("REPORT_PDF_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal membuat PDF laporan." },
      { status: 500 },
    );
  }
}

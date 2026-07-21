import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { hasAdminAccess } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";
import { recordAuditLog } from "@/src/lib/audit";

function parseReportId(id: string) {
  const reportId = Number(id);

  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function sanitizeDownloadName(value: string) {
  return (
    value
      .replace(/[\r\n"]/g, "")
      .replace(/[\\/:*?<>|]+/g, "-")
      .trim() || "lampiran-laporan"
  );
}

function getExtensionFromUrl(url: string) {
  return path.extname(url.split("?")[0]) || "";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const { id, attachmentId } = await ctx.params;
    const reportId = parseReportId(id);

    if (!reportId) {
      return NextResponse.json({ message: "ID laporan tidak valid." }, { status: 400 });
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        attachments: true,
      },
    });

    if (!report) {
      return NextResponse.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
    }

    const canAccess =
      report.userId === authUser.id ||
      (hasAdminAccess(authUser) &&
        canAdminAccessReport({
          role: authUser.role,
          isSuperAdmin: authUser.isSuperAdmin,
          categoryScope: authUser.categoryScope,
          reportCategory: report.kategori,
        }));

    if (!canAccess) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const attachment =
      attachmentId === "legacy"
        ? {
            id: 0,
            url: report.attachmentUrl || report.fotoUrl || "",
            fileType: report.attachmentType || "application/octet-stream",
            fileName:
              report.attachmentName ||
              `lampiran-${report.ticket || report.id}${getExtensionFromUrl(
                report.attachmentUrl || report.fotoUrl || "",
              )}`,
          }
        : attachmentId === "completion"
          ? {
              id: 0,
              url: report.completionPhotoUrl || "",
              fileType: "application/octet-stream",
              fileName: `bukti-penyelesaian-${report.ticket || report.id}${getExtensionFromUrl(
                report.completionPhotoUrl || "",
              )}`,
            }
          : report.attachments.find(
              (item) => String(item.id) === attachmentId,
            );

    if (!attachment?.url || !attachment.url.startsWith("/uploads/")) {
      return NextResponse.json({ message: "Lampiran tidak ditemukan." }, { status: 404 });
    }

    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    const filePath = path.resolve(
      process.cwd(),
      "public",
      attachment.url.replace(/^\//, ""),
    );

    if (!filePath.startsWith(uploadsRoot + path.sep)) {
      return NextResponse.json({ message: "Lampiran tidak valid." }, { status: 400 });
    }

    const bytes = await fs.readFile(filePath);
    const fileName = sanitizeDownloadName(attachment.fileName);

    await recordAuditLog({
      actorUserId: authUser.id,
      reportId,
      entityType: "REPORT_ATTACHMENT",
      entityId: attachmentId,
      action: "DOWNLOAD",
      summary: `${fileName} diunduh dari laporan ${report.ticket || `#${report.id}`}.`,
      metadata: {
        url: attachment.url,
        fileType: attachment.fileType,
        fileName,
      },
    });

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": attachment.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("DOWNLOAD_REPORT_ATTACHMENT_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal mengunduh lampiran." },
      { status: 500 },
    );
  }
}

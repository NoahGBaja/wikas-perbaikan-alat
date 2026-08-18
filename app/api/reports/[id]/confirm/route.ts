import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import { findReportByIdRaw } from "@/src/lib/raw-data";
import { formatTicketFallback } from "@/src/lib/tickets";
import { findWorkflowRecipientIds, notifyUsers } from "@/src/lib/notifications";
import { recordAuditLog } from "@/src/lib/audit";
import { protectReportAttachmentReferences } from "@/src/lib/report-attachment-urls";

function parseReportId(id: string) {
  const reportId = Number(id);

  if (!Number.isInteger(reportId) || reportId <= 0) return null;

  return reportId;
}

function normalizeFinalStatus(value: unknown) {
  if (value === "TELAH_BERFUNGSI") return "TELAH_BERFUNGSI";
  if (value === "TIDAK_DAPAT_DIGUNAKAN") return "TIDAK_DAPAT_DIGUNAKAN";

  return null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) return requestError;

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (authUser.role !== "USER") {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const { id } = await ctx.params;
    const reportId = parseReportId(id);

    if (!reportId) {
      return NextResponse.json(
        { message: "Tiket laporan tidak valid." },
        { status: 400 },
      );
    }

    const body = await req.json();
    const confirmed = body.confirmed === true;
    const finalStatus = normalizeFinalStatus(body.finalStatus);
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    if (!confirmed) {
      return NextResponse.json(
        { message: "Konfirmasi penerimaan barang wajib dicentang." },
        { status: 400 },
      );
    }

    if (!finalStatus) {
      return NextResponse.json(
        { message: "Pilih status akhir laporan." },
        { status: 400 },
      );
    }

    if (finalStatus === "TIDAK_DAPAT_DIGUNAKAN" && !description) {
      return NextResponse.json(
        {
          message:
            "Deskripsi wajib diisi jika barang masih tidak dapat digunakan.",
        },
        { status: 400 },
      );
    }

    const report = await findReportByIdRaw(reportId);

    if (!report) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 },
      );
    }

    if (report.userId !== authUser.id) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    if (report.status !== "MENUNGGU_KONFIRMASI") {
      return NextResponse.json(
        { message: "Laporan belum berada pada tahap konfirmasi pelapor." },
        { status: 400 },
      );
    }

    const isStillUnusable = finalStatus === "TIDAK_DAPAT_DIGUNAKAN";
    const nextStatus = finalStatus;
    const updateResult = await prisma.report.updateMany({
      where: {
        id: reportId,
        userId: authUser.id,
        status: "MENUNGGU_KONFIRMASI",
      },
      data: {
        status: nextStatus,
        reporterConfirmedAt: new Date(),
        reporterConfirmationStatus: finalStatus,
        adminNotes: isStillUnusable
          ? `Pelapor menyatakan barang masih tidak dapat digunakan: ${description}`
          : report.adminNotes,
        finishedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      return NextResponse.json(
        { message: "Status laporan sudah berubah. Muat ulang data." },
        { status: 409 },
      );
    }

    const updated = await findReportByIdRaw(reportId);

    if (!updated) {
      return NextResponse.json(
        { message: "Laporan gagal dimuat setelah diperbarui." },
        { status: 500 },
      );
    }
    const ticket = formatTicketFallback(report);

    try {
      const adminIds = await findWorkflowRecipientIds({
        role: "ADMIN_1",
        reportCategory: report.kategori,
      });

      await notifyUsers({
        userIds: adminIds,
        reportId,
        title: isStillUnusable
          ? "Barang dikonfirmasi belum dapat digunakan"
          : "Pelapor mengonfirmasi laporan",
        message: isStillUnusable
          ? `${ticket} dikonfirmasi masih tidak dapat digunakan. Pelapor dapat mengirim request baru dari laporan ini.`
          : `${ticket} dikonfirmasi dengan status Telah Berfungsi.`,
      });
    } catch (notificationError) {
      console.error("CONFIRM_REPORT_NOTIFICATION_ERROR:", notificationError);
    }

    await recordAuditLog({
      actorUserId: authUser.id,
      reportId,
      entityType: "REPORT",
      entityId: reportId,
      action: "FINAL_CONFIRM",
      summary: isStillUnusable
        ? `${ticket} dikonfirmasi masih tidak dapat digunakan oleh pelapor.`
        : `${ticket} dikonfirmasi final oleh pelapor.`,
      metadata: {
        confirmed,
        finalStatus,
        description: description || null,
        previousStatus: report.status,
        nextStatus,
      },
    });

    return NextResponse.json({
      message: isStillUnusable
        ? "Konfirmasi disimpan. Anda dapat mengirim ulang request dari laporan ini."
        : "Konfirmasi laporan berhasil disimpan.",
      report: protectReportAttachmentReferences(updated),
    });
  } catch (error) {
    console.error("CONFIRM_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}

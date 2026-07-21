import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import { findReportByIdRaw } from "@/src/lib/raw-data";
import { formatTicketFallback } from "@/src/lib/tickets";
import { findWorkflowRecipientIds, notifyUsers } from "@/src/lib/notifications";
import { recordAuditLog } from "@/src/lib/audit";

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

    const shouldReopen = finalStatus === "TIDAK_DAPAT_DIGUNAKAN";
    const nextStatus = shouldReopen ? "MENUNGGU_ADMIN_1" : finalStatus;
    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: nextStatus,
        reporterConfirmedAt: new Date(),
        reporterConfirmationStatus: finalStatus,
        adminNotes: shouldReopen
          ? `Pelapor menyatakan barang masih tidak dapat digunakan: ${description}`
          : report.adminNotes,
        finishedAt: shouldReopen ? null : new Date(),
      },
    });
    const ticket = formatTicketFallback(report);

    try {
      const adminIds = await findWorkflowRecipientIds({
        role: "ADMIN_1",
        reportCategory: report.kategori,
      });

      await notifyUsers({
        userIds: adminIds,
        reportId,
        title: shouldReopen
          ? "Laporan dibuka kembali oleh pelapor"
          : "Pelapor mengonfirmasi laporan",
        message: shouldReopen
          ? `${ticket} masih tidak dapat digunakan dan perlu ditindaklanjuti kembali.`
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
      action: shouldReopen ? "REOPEN" : "FINAL_CONFIRM",
      summary: shouldReopen
        ? `${ticket} dibuka kembali oleh pelapor.`
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
      message: shouldReopen
        ? "Konfirmasi disimpan. Laporan dibuka kembali untuk ditindaklanjuti."
        : "Konfirmasi laporan berhasil disimpan.",
      report: updated,
    });
  } catch (error) {
    console.error("CONFIRM_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}

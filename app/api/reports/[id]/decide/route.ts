import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { findReportByIdRaw } from "@/src/lib/raw-data";
import { getRoleLabel, hasAdminAccess } from "@/src/lib/roles";
import {
  canRoleDecide,
  getNextApprovedStatus,
  getRejectedStatus,
  getRequiredAdminRole,
  getWorkflowMessage,
} from "@/src/lib/workflow";
import type { ReportDecisionInput } from "@/src/lib/workflow";
import {
  enforceJsonBodySize,
  enforceMultipartBodySize,
  requireSameOrigin,
} from "@/src/lib/request-security";
import {
  deleteUploadedFileByUrl,
  saveReportAttachmentUpload,
  validateReportAttachmentUpload,
} from "@/src/lib/uploads";
import { findWorkflowRecipientIds, notifyUsers } from "@/src/lib/notifications";
import { formatTicketFallback } from "@/src/lib/tickets";
import { parseRupiahInput } from "@/src/lib/formatting";

type DecisionPayload = {
  action: ReportDecisionInput | "SELESAI";
  note: string;
  proofFile: File | null;
  repairCost: string;
};

function parseReportId(id: string) {
  const reportId = Number(id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return null;
  }

  return reportId;
}

function normalizeAction(action: unknown): DecisionPayload["action"] | null {
  if (typeof action !== "string") return null;

  const normalized = action.trim().toUpperCase();

  if (normalized === "ACC") return "ACC";
  if (normalized === "TOLAK") return "TOLAK";
  if (normalized === "SELESAI" || normalized === "COMPLETE") return "SELESAI";

  // Biar UI lama yang masih kirim APPROVE/REJECT tidak langsung rusak.
  if (normalized === "APPROVE") return "ACC";
  if (normalized === "REJECT") return "TOLAK";

  return null;
}

async function parseDecisionPayload(req: Request): Promise<DecisionPayload | null> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const action = normalizeAction(formData.get("action"));

    if (!action) {
      return null;
    }

    const noteValue = formData.get("note") || formData.get("adminNotes");
    const proofValue = formData.get("proof");
    const repairCostValue = formData.get("repairCost");

    return {
      action,
      note: typeof noteValue === "string" ? noteValue.trim() : "",
      proofFile: proofValue instanceof File ? proofValue : null,
      repairCost:
        typeof repairCostValue === "string" ? repairCostValue.trim() : "",
    };
  }

  if (!contentType.includes("application/json")) {
    return null;
  }

  const body = await req.json();
  const action = normalizeAction(body.action);

  if (!action) {
    return null;
  }

  const note =
    typeof body.note === "string"
      ? body.note.trim()
      : typeof body.adminNotes === "string"
        ? body.adminNotes.trim()
        : typeof body.alasanPenolakan === "string"
          ? body.alasanPenolakan.trim()
          : "";

  return {
    action,
    note,
    proofFile: null,
    repairCost: typeof body.repairCost === "string" ? body.repairCost.trim() : "",
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const originError = requireSameOrigin(req);

    if (originError) {
      return originError;
    }

    const contentType = req.headers.get("content-type") || "";
    const sizeError = contentType.includes("multipart/form-data")
      ? enforceMultipartBodySize(req)
      : enforceJsonBodySize(req);

    if (sizeError) {
      return sizeError;
    }

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    if (authUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          message:
            "Admin Utama hanya memantau. Fitur override ACC/TOLAK belum diaktifkan.",
        },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;
    const reportId = parseReportId(id);

    if (!reportId) {
      return NextResponse.json(
        { message: "ID laporan tidak valid." },
        { status: 400 }
      );
    }

    const payload = await parseDecisionPayload(req);

    if (!payload) {
      return NextResponse.json(
        { message: "Aksi tidak valid. Gunakan ACC atau TOLAK." },
        { status: 400 }
      );
    }

    if (payload.note.length > 2000) {
      return NextResponse.json(
        { message: "Catatan maksimal 2000 karakter." },
        { status: 400 }
      );
    }

    const report = await findReportByIdRaw(reportId);

    if (!report) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (report.status === "DISETUJUI_FINAL" || report.status === "MENUNGGU_KONFIRMASI") {
      return NextResponse.json(
        { message: "Laporan sudah selesai dan menunggu konfirmasi pelapor." },
        { status: 400 }
      );
    }

    if (
      ["DITOLAK", "TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN"].includes(
        report.status,
      )
    ) {
      return NextResponse.json(
        { message: "Laporan sudah final." },
        { status: 400 }
      );
    }

    const requiredRole = getRequiredAdminRole(report.status);

    if (!requiredRole) {
      return NextResponse.json(
        { message: "Status laporan tidak valid untuk keputusan admin." },
        { status: 400 }
      );
    }

    if (
      !canRoleDecide(
        authUser.role,
        report.status,
        report.kategori,
        authUser.categoryScope,
      )
    ) {
      return NextResponse.json(
        {
          message:
            authUser.role === requiredRole
              ? getWorkflowMessage(
                  authUser.role,
                  report.status,
                  report.kategori,
                  authUser.categoryScope,
                )
              : `Belum giliran Anda. Laporan ini sedang menunggu ${getRoleLabel(requiredRole)}.`,
        },
        { status: 403 }
      );
    }

    if (payload.action === "TOLAK" && !payload.note) {
      return NextResponse.json(
        { message: "Alasan penolakan wajib diisi." },
        { status: 400 }
      );
    }

    if (payload.action === "TOLAK" && authUser.role === "ADMIN_1") {
      return NextResponse.json(
        { message: "PJ Ruangan hanya dapat Lanjut atau Selesai." },
        { status: 403 },
      );
    }

    if (payload.action === "SELESAI" && !payload.note) {
      return NextResponse.json(
        { message: "Deskripsi penyelesaian wajib diisi." },
        { status: 400 },
      );
    }

    const isCompletion = payload.action === "SELESAI";
    const repairCost =
      authUser.role === "ADMIN_5" ? parseRupiahInput(payload.repairCost) : null;
    let completionProofUrl: string | null = null;

    if (isCompletion && payload.proofFile) {
      const proofValidationError = validateReportAttachmentUpload(
        payload.proofFile,
      );

      if (proofValidationError) {
        return NextResponse.json(
          { message: proofValidationError },
          { status: 400 },
        );
      }

      try {
        completionProofUrl = await saveReportAttachmentUpload(payload.proofFile!, {
          folder: "uploads",
        });
      } catch (error) {
        return NextResponse.json(
          {
            message:
              error instanceof Error
                ? error.message
                : "Bukti penyelesaian tidak valid.",
          },
          { status: 400 },
        );
      }
    }

    const fromStatus = report.status;
    const toStatus =
      payload.action === "SELESAI"
        ? "MENUNGGU_KONFIRMASI"
        : payload.action === "ACC"
        ? getNextApprovedStatus(report.status)
        : getRejectedStatus();

    try {
      await prisma.$transaction(async (tx) => {
        const finalDate = toStatus === "MENUNGGU_KONFIRMASI" ? new Date() : null;

        await tx.report.update({
          where: { id: reportId },
          data: {
            status: toStatus,
            alasanPenolakan: payload.action === "TOLAK" ? payload.note : null,

            approvedAt: finalDate || report.approvedAt,

            rejectedAt: payload.action === "TOLAK" ? new Date() : null,

            adminNotes: payload.note || report.adminNotes || null,

            // Field lama dipakai sebagai bukti penyelesaian final dari PP.
            assignedTechnician: null,
            processedAt: null,
            finishedAt: finalDate,
            completionNotes: isCompletion ? payload.note : null,
            completionPhotoUrl: isCompletion ? completionProofUrl : null,
            ...(authUser.role === "ADMIN_5" ? { repairCost } : {}),
          },
        });

        await tx.reportApprovalHistory.create({
          data: {
            reportId,
            adminId: authUser.id,
            action: payload.action === "SELESAI" ? "ACC" : payload.action,
            fromStatus,
            toStatus,
            note: payload.note || null,
          },
        });
      });
    } catch (error) {
      await deleteUploadedFileByUrl(completionProofUrl);
      throw error;
    }

    const updated = await findReportByIdRaw(reportId);
    const ticket = updated ? formatTicketFallback(updated) : `LP-${reportId}`;

    if (updated) {
      if (payload.action === "ACC") {
        const nextRole = getRequiredAdminRole(updated.status);
        const nextRecipientIds = await findWorkflowRecipientIds({
          role: nextRole,
          reportCategory: updated.kategori,
        });

        await notifyUsers({
          userIds: nextRecipientIds,
          reportId,
          title: "Laporan perlu ditindaklanjuti",
          message: `${ticket} menunggu tindakan ${nextRole ? getRoleLabel(nextRole) : "role berikutnya"}.`,
        });
      } else {
        await notifyUsers({
          userIds: [updated.userId],
          reportId,
          title:
            payload.action === "SELESAI"
              ? "Laporan selesai, perlu konfirmasi"
              : "Laporan ditolak",
          message:
            payload.action === "SELESAI"
              ? `${ticket} telah diselesaikan. Mohon konfirmasi penerimaan barang.`
              : `${ticket} ditolak. Silakan cek detail laporan.`,
        });
      }
    }

    return NextResponse.json({
      message:
        payload.action === "SELESAI"
          ? "Laporan berhasil diselesaikan dan dikirim ke pelapor untuk konfirmasi."
          : payload.action === "ACC"
            ? `Laporan berhasil diterima dan diteruskan ke ${toStatus}.`
            : "Laporan berhasil ditolak.",
      report: updated,
    });
  } catch (error) {
    console.error("DECIDE_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

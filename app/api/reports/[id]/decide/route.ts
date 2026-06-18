import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { findReportByIdRaw } from "@/src/lib/raw-data";
import { getRoleLabel, isAdminRole } from "@/src/lib/roles";
import {
  canRoleDecide,
  getNextApprovedStatus,
  getRejectedStatus,
  getRequiredAdminRole,
  getWorkflowMessage,
  type ReportDecisionInput,
} from "@/src/lib/workflow";
import {
  enforceJsonBodySize,
  requireSameOrigin,
} from "@/src/lib/request-security";

type DecisionPayload = {
  action: ReportDecisionInput;
  note: string;
};

function parseReportId(id: string) {
  const reportId = Number(id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return null;
  }

  return reportId;
}

function normalizeAction(action: unknown): ReportDecisionInput | null {
  if (typeof action !== "string") return null;

  const normalized = action.trim().toUpperCase();

  if (normalized === "ACC") return "ACC";
  if (normalized === "TOLAK") return "TOLAK";

  // Biar UI lama yang masih kirim APPROVE/REJECT tidak langsung rusak.
  if (normalized === "APPROVE") return "ACC";
  if (normalized === "REJECT") return "TOLAK";

  return null;
}

async function parseDecisionPayload(req: Request): Promise<DecisionPayload | null> {
  const contentType = req.headers.get("content-type") || "";

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

    const sizeError = enforceJsonBodySize(req);

    if (sizeError) {
      return sizeError;
    }

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (authUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          message:
            "Super Admin hanya monitoring. Fitur override ACC/TOLAK belum diaktifkan.",
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

    if (report.status === "DISETUJUI_FINAL") {
      return NextResponse.json(
        { message: "Laporan sudah disetujui final." },
        { status: 400 }
      );
    }

    if (report.status === "DITOLAK") {
      return NextResponse.json(
        { message: "Laporan sudah ditolak dan alur berhenti permanen." },
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

    const fromStatus = report.status;
    const toStatus =
      payload.action === "ACC"
        ? getNextApprovedStatus(report.status)
        : getRejectedStatus();

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: toStatus,
          alasanPenolakan: payload.action === "TOLAK" ? payload.note : null,

          approvedAt:
            toStatus === "DISETUJUI_FINAL"
              ? new Date()
              : report.approvedAt,

          rejectedAt:
            payload.action === "TOLAK"
              ? new Date()
              : null,

          adminNotes: payload.note || report.adminNotes || null,

          // Field lama dibiarkan null supaya workflow baru tidak pakai proses/selesai manual.
          assignedTechnician: null,
          processedAt: null,
          finishedAt: null,
          completionNotes: null,
          completionPhotoUrl: null,
        },
      });

      await tx.reportApprovalHistory.create({
        data: {
          reportId,
          adminId: authUser.id,
          action: payload.action,
          fromStatus,
          toStatus,
          note: payload.note || null,
        },
      });
    });

    const updated = await findReportByIdRaw(reportId);

    return NextResponse.json({
      message:
        payload.action === "ACC"
          ? toStatus === "DISETUJUI_FINAL"
            ? "Laporan berhasil disetujui final."
            : `Laporan berhasil di-ACC dan diteruskan ke ${toStatus}.`
          : "Laporan berhasil ditolak dan alur berhenti permanen.",
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

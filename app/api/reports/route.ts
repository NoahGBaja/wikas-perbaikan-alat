import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import {
  parseModalReportFormData,
  type ValidKategori,
  validateModalReportInput,
} from "@/src/lib/report-validation";
import {
  saveReportAttachmentUpload,
  validateReportAttachmentUploads,
} from "@/src/lib/uploads";
import { listReportsRaw } from "@/src/lib/raw-data";
import { validateMutationRequest } from "@/src/lib/request-security";
import { getRoleLabel, hasAdminAccess } from "@/src/lib/roles";
import { getRoomCodeByNameFromMaster } from "@/src/lib/master-data-db";
import { createTicket } from "@/src/lib/ticket-server";
import { findWorkflowRecipientIds, notifyUsers } from "@/src/lib/notifications";
import { recordAuditLog } from "@/src/lib/audit";

export async function POST(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "multipart" });

    if (requestError) {
      return requestError;
    }

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (authUser.role !== "USER") {
      return NextResponse.json(
        { message: "Hanya user yang boleh membuat laporan." },
        { status: 403 }
      );
    }
    const actorUser = authUser;

    const formData = await req.formData();
    const reportInput = parseModalReportFormData(formData);
    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const legacyFile = formData.get("attachment");

    if (legacyFile instanceof File && legacyFile.size > 0 && files.length === 0) {
      files.push(legacyFile);
    }

    const validationError = validateModalReportInput(reportInput);

    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const fileValidationError = validateReportAttachmentUploads(files, {
      required: true,
    });

    if (fileValidationError) {
      return NextResponse.json(
        { message: fileValidationError },
        { status: 400 }
      );
    }

    const savedAttachments = [];

    for (const file of files) {
      const url = await saveReportAttachmentUpload(file);
      savedAttachments.push({
        url,
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });
    }

    const primaryAttachment = savedAttachments[0] || null;
    const roomCode =
      (await getRoomCodeByNameFromMaster(reportInput.namaRuangan)) ||
      reportInput.nomorRuangan;
    const ticket = await createTicket(reportInput.kategori as ValidKategori);

    const report = await prisma.report.create({
      data: {
        ticket,
        userId: authUser.id,
        namaPelapor: reportInput.namaPelapor,
        nomorRuangan: roomCode,
        namaRuangan: reportInput.namaRuangan,
        kodeUakpb: reportInput.namaBarang || reportInput.kodeUakpb,
        kode: reportInput.kode,
        nup: reportInput.nup,
        kategori: reportInput.kategori as ValidKategori,
        subcategory: reportInput.subcategory,
        itemType: reportInput.itemType,
        namaBarang: reportInput.namaBarang || reportInput.itemType,
        lokasi: reportInput.namaRuangan,
        deskripsi: reportInput.deskripsi,
        severity: "SEDANG",
        repairCost: null,
        fotoUrl: primaryAttachment?.fileType.startsWith("image/")
          ? primaryAttachment.url
          : null,
        attachmentUrl: primaryAttachment?.url || null,
        attachmentType: primaryAttachment?.fileType || null,
        attachmentName: primaryAttachment?.fileName || null,
        status: "MENUNGGU_ADMIN_1",
        attachments: {
          create: savedAttachments,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
            nip: true,
          },
        },
        histories: {
          include: {
            admin: {
              select: {
                id: true,
                nama: true,
                jabatan: true,
                nip: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    try {
      const nextRecipientIds = await findWorkflowRecipientIds({
        role: "ADMIN_1",
        reportCategory: reportInput.kategori as ValidKategori,
      });

      await notifyUsers({
        userIds: nextRecipientIds,
        reportId: report.id,
        title: "Laporan baru masuk",
        message: `${ticket} menunggu tindakan ${getRoleLabel("ADMIN_1")}.`,
      });
    } catch (notificationError) {
      console.error("CREATE_REPORT_NOTIFICATION_ERROR:", notificationError);
    }

    return NextResponse.json({
      message: `Laporan berhasil dikirim dan menunggu persetujuan ${getRoleLabel("ADMIN_1")}.`,
      report,
    });

    await recordAuditLog({
      actorUserId: actorUser.id,
      reportId: report.id,
      entityType: "REPORT",
      entityId: report.id,
      action: "CREATE",
      summary: `Laporan ${ticket} dibuat oleh ${actorUser.nama}.`,
      metadata: {
        ticket,
        status: report.status,
        kategori: report.kategori,
        namaBarang: report.namaBarang,
        attachments: savedAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
        })),
      },
    });
  } catch (error) {
    console.error("CREATE_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const reports = await listReportsRaw(
      hasAdminAccess(authUser) ? undefined : authUser.id
    );

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("GET_REPORTS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

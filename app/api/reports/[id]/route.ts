import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import {
  parseModalReportFormData,
  type ValidKategori,
  validateModalReportInput,
} from "@/src/lib/report-validation";
import {
  deleteUploadedFileByUrl,
  saveReportAttachmentUpload,
  validateReportAttachmentUploads,
} from "@/src/lib/uploads";
import { validateMutationRequest } from "@/src/lib/request-security";
import { hasAdminAccess, isReadOnlyExecutive } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";
import { getRoomCodeByNameFromMaster } from "@/src/lib/master-data-db";
import { recordAuditLog } from "@/src/lib/audit";

function parseReportId(id: string) {
  const reportId = Number(id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return null;
  }

  return reportId;
}

const reportInclude = {
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
      createdAt: "asc" as const,
    },
  },
  attachments: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
};

function describeReportChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
) {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  for (const field of fields) {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;

    if (String(oldValue ?? "") !== String(newValue ?? "")) {
      changes.push({
        field,
        oldValue,
        newValue,
      });
    }
  }

  return changes;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const { id } = await ctx.params;
    const reportId = parseReportId(id);

    if (!reportId) {
      return NextResponse.json(
        { message: "ID laporan tidak valid." },
        { status: 400 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: reportInclude,
    });

    if (!report) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (
      hasAdminAccess(authUser) &&
      !canAdminAccessReport({
        role: authUser.role,
        isSuperAdmin: authUser.isSuperAdmin,
        categoryScope: authUser.categoryScope,
        reportCategory: report.kategori,
      })
    ) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    if (!hasAdminAccess(authUser) && report.userId !== authUser.id) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("GET_REPORT_DETAIL_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const requestError = validateMutationRequest(req, { body: "multipart" });

    if (requestError) {
      return requestError;
    }

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const { id } = await ctx.params;
    const reportId = parseReportId(id);

    if (!reportId) {
      return NextResponse.json(
        { message: "ID laporan tidak valid." },
        { status: 400 }
      );
    }

    const existingReport = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        attachments: true,
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    const isOwner = existingReport.userId === authUser.id;
    const isWritableAdmin =
      hasAdminAccess(authUser) &&
      !isReadOnlyExecutive(authUser.role) &&
      canAdminAccessReport({
        role: authUser.role,
        isSuperAdmin: authUser.isSuperAdmin,
        categoryScope: authUser.categoryScope,
        reportCategory: existingReport.kategori,
      });

    if (!isOwner && !isWritableAdmin) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    if (
      ["DITOLAK", "TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN"].includes(
        existingReport.status,
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Laporan tidak bisa diubah setelah persetujuan atau penolakan final.",
        },
        { status: 400 }
      );
    }

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

    const fileValidationError = validateReportAttachmentUploads(files);

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
    const hasNewAttachments = savedAttachments.length > 0;
    const roomCode =
      (await getRoomCodeByNameFromMaster(reportInput.namaRuangan)) ||
      reportInput.nomorRuangan;

    const nextData = {
      namaPelapor: reportInput.namaPelapor,
      nomorRuangan: roomCode,
      namaRuangan: reportInput.namaRuangan,
      kodeUakpb: reportInput.namaBarang || reportInput.kodeUakpb,
      kode: reportInput.kode,
      nup: reportInput.nup,
      kategori: reportInput.kategori as ValidKategori,
      subcategory: reportInput.subcategory,
      itemType: reportInput.subcategory,
      namaBarang: reportInput.namaBarang,
      lokasi: reportInput.namaRuangan,
      deskripsi: reportInput.deskripsi,
      severity: "SEDANG" as const,
    };
    const changedFields = describeReportChanges(existingReport, nextData, [
      "namaPelapor",
      "nomorRuangan",
      "namaRuangan",
      "kodeUakpb",
      "kode",
      "nup",
      "kategori",
      "subcategory",
      "itemType",
      "namaBarang",
      "lokasi",
      "deskripsi",
      "severity",
    ]);

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        ...nextData,
        ...(hasNewAttachments
          ? {
              fotoUrl: primaryAttachment?.fileType.startsWith("image/")
                ? primaryAttachment.url
                : null,
              attachmentUrl: primaryAttachment?.url || null,
              attachmentType: primaryAttachment?.fileType || null,
              attachmentName: primaryAttachment?.fileName || null,
              attachments: {
                deleteMany: {},
                create: savedAttachments,
              },
            }
          : {}),
      },
      include: reportInclude,
    });

    if (hasNewAttachments) {
      await Promise.all([
        ...existingReport.attachments.map((attachment) =>
          deleteUploadedFileByUrl(attachment.url),
        ),
        deleteUploadedFileByUrl(existingReport.attachmentUrl || existingReport.fotoUrl),
      ]);
    }

    await recordAuditLog({
      actorUserId: authUser.id,
      reportId,
      entityType: "REPORT",
      entityId: reportId,
      action: "EDIT",
      summary: `Laporan ${updatedReport.ticket || `#${reportId}`} diperbarui.`,
      metadata: {
        changedFields,
        attachments: hasNewAttachments
          ? {
              replaced: true,
              newFiles: savedAttachments.map((attachment) => ({
                fileName: attachment.fileName,
                fileType: attachment.fileType,
                fileSize: attachment.fileSize,
              })),
            }
          : null,
      },
    });

    return NextResponse.json({
      message: "Laporan berhasil diperbarui.",
      report: updatedReport,
    });
  } catch (error) {
    console.error("UPDATE_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const requestError = validateMutationRequest(req);

    if (requestError) {
      return requestError;
    }

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
        { message: "ID laporan tidak valid." },
        { status: 400 }
      );
    }

    const existingReport = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        userId: true,
        status: true,
        fotoUrl: true,
        attachmentUrl: true,
        attachments: true,
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (existingReport.userId !== authUser.id) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    if (
      ["DITOLAK", "TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN"].includes(
        existingReport.status,
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Laporan tidak bisa dihapus setelah persetujuan atau penolakan final.",
        },
        { status: 400 }
      );
    }

    await prisma.report.delete({
      where: { id: reportId },
    });

    await recordAuditLog({
      actorUserId: authUser.id,
      reportId,
      entityType: "REPORT",
      entityId: reportId,
      action: "DELETE",
      summary: `Laporan #${reportId} dihapus oleh pelapor.`,
      metadata: {
        status: existingReport.status,
        attachmentCount: existingReport.attachments.length,
      },
    });

    await Promise.all([
      ...existingReport.attachments.map((attachment) =>
        deleteUploadedFileByUrl(attachment.url),
      ),
      deleteUploadedFileByUrl(existingReport.attachmentUrl || existingReport.fotoUrl),
    ]);

    return NextResponse.json({
      message: "Laporan berhasil dihapus.",
    });
  } catch (error) {
    console.error("DELETE_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

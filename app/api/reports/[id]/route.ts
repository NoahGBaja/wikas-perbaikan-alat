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
  isUploadValidationError,
  saveReportAttachmentUpload,
  validateReportAttachmentUploads,
} from "@/src/lib/uploads";
import { validateMutationRequest } from "@/src/lib/request-security";
import { hasAdminAccess } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";
import {
  findActiveRoomByNameFromMaster,
  findActiveSubcategoryForCategory,
} from "@/src/lib/master-data-db";
import { recordAuditLog } from "@/src/lib/audit";
import { protectReportAttachmentReferences } from "@/src/lib/report-attachment-urls";

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

    return NextResponse.json({
      report: protectReportAttachmentReferences(report),
    });
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
  const savedAttachmentUrls: string[] = [];
  let updateCommitted = false;

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

    if (!isOwner) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    if (existingReport.status !== "MENUNGGU_ADMIN_1") {
      return NextResponse.json(
        {
          message: "Laporan hanya bisa diubah sebelum diproses PJ Perbaikan.",
        },
        { status: 409 }
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
      savedAttachmentUrls.push(url);

      savedAttachments.push({
        url,
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
        purpose: "DAMAGE_EVIDENCE" as const,
        uploadedByName: authUser.nama,
        uploadedByRole: authUser.role,
      });
    }

    const [masterRoom, masterSubcategory] = await Promise.all([
      findActiveRoomByNameFromMaster(reportInput.namaRuangan),
      findActiveSubcategoryForCategory(
        reportInput.kategori as ValidKategori,
        reportInput.subcategory,
      ),
    ]);

    if (!masterRoom) {
      return NextResponse.json(
        { message: "Ruangan tidak ditemukan pada master data aktif." },
        { status: 400 },
      );
    }

    if (!masterSubcategory) {
      return NextResponse.json(
        { message: "Subkategori tidak sesuai dengan kategori yang dipilih." },
        { status: 400 },
      );
    }

    const primaryAttachment = savedAttachments[0] || null;
    const hasNewAttachments = savedAttachments.length > 0;
    const nextData = {
      namaPelapor: reportInput.namaPelapor,
      nomorRuangan: masterRoom.code,
      namaRuangan: masterRoom.name,
      kodeUakpb: reportInput.namaBarang || reportInput.kodeUakpb,
      kode: reportInput.kode,
      nup: reportInput.nup,
      kategori: reportInput.kategori as ValidKategori,
      subcategory: masterSubcategory.name,
      itemType: masterSubcategory.name,
      namaBarang: reportInput.namaBarang,
      lokasi: masterRoom.name,
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
    updateCommitted = true;

    if (hasNewAttachments) {
      await Promise.all([
        ...existingReport.attachments.map((attachment) =>
          deleteUploadedFileByUrl(attachment.url),
        ),
        deleteUploadedFileByUrl(existingReport.attachmentUrl || existingReport.fotoUrl),
      ]).catch((cleanupError) => {
        console.error("REPLACED_REPORT_UPLOAD_CLEANUP_ERROR:", cleanupError);
      });
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
      report: protectReportAttachmentReferences(updatedReport),
    });
  } catch (error) {
    if (!updateCommitted) {
      await Promise.all(
        savedAttachmentUrls.map((url) => deleteUploadedFileByUrl(url)),
      ).catch((cleanupError) => {
        console.error("UPDATE_REPORT_UPLOAD_CLEANUP_ERROR:", cleanupError);
      });
    }

    if (isUploadValidationError(error)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

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

    if (existingReport.status !== "MENUNGGU_ADMIN_1") {
      return NextResponse.json(
        {
          message: "Laporan hanya bisa dihapus sebelum diproses PJ Perbaikan.",
        },
        { status: 409 }
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
    ]).catch((cleanupError) => {
      console.error("DELETE_REPORT_UPLOAD_CLEANUP_ERROR:", cleanupError);
    });

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

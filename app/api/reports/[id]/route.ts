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
  validateReportAttachmentUpload,
} from "@/src/lib/uploads";
import { validateMutationRequest } from "@/src/lib/request-security";
import { getRoleLabel, hasAdminAccess } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";

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
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (!hasAdminAccess(authUser) && report.userId !== authUser.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (authUser.role !== "USER") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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
    });

    if (!existingReport) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (existingReport.userId !== authUser.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (existingReport.status !== "MENUNGGU_ADMIN_1") {
      return NextResponse.json(
        {
          message:
            `Laporan hanya bisa diubah saat masih menunggu persetujuan ${getRoleLabel("ADMIN_1")}.`,
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const reportInput = parseModalReportFormData(formData);
    const file = formData.get("attachment") as File | null;

    const validationError = validateModalReportInput(reportInput);

    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const fileValidationError = validateReportAttachmentUpload(file);

    if (fileValidationError) {
      return NextResponse.json(
        { message: fileValidationError },
        { status: 400 }
      );
    }

    let attachmentUrl = existingReport.attachmentUrl;
    let attachmentType = existingReport.attachmentType;
    let attachmentName = existingReport.attachmentName;
    let fotoUrl = existingReport.fotoUrl;

    if (file && file.size > 0) {
      const newAttachmentUrl = await saveReportAttachmentUpload(file);

      if (existingReport.attachmentUrl) {
        await deleteUploadedFileByUrl(existingReport.attachmentUrl);
      } else if (existingReport.fotoUrl) {
        await deleteUploadedFileByUrl(existingReport.fotoUrl);
      }

      attachmentUrl = newAttachmentUrl;
      attachmentType = file.type;
      attachmentName = file.name;
      fotoUrl = file.type.startsWith("image/") ? newAttachmentUrl : null;
    }

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        namaPelapor: reportInput.namaPelapor,
        nomorRuangan: reportInput.nomorRuangan,
        kodeUakpb: reportInput.kodeUakpb,
        kode: reportInput.kode,
        kategori: reportInput.kategori as ValidKategori,
        namaBarang: "Perbaikan Alat",
        lokasi: `Ruangan ${reportInput.nomorRuangan}`,
        deskripsi: reportInput.deskripsi,
        severity: "SEDANG",
        fotoUrl,
        attachmentUrl,
        attachmentType,
        attachmentName,
      },
      include: reportInclude,
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
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (authUser.role !== "USER") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { message: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (existingReport.userId !== authUser.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (existingReport.status !== "MENUNGGU_ADMIN_1") {
      return NextResponse.json(
        {
          message:
            `Laporan hanya bisa dihapus saat masih menunggu persetujuan ${getRoleLabel("ADMIN_1")}.`,
        },
        { status: 400 }
      );
    }

    await prisma.report.delete({
      where: { id: reportId },
    });

    await deleteUploadedFileByUrl(
      existingReport.attachmentUrl || existingReport.fotoUrl
    );

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

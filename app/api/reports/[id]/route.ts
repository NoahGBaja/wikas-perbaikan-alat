import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import {
  parseReportFormData,
  validateReportInput,
  type ValidKategori,
  type ValidSeverity,
} from "@/src/lib/report-validation";
import {
  deleteUploadedFileByUrl,
  saveImageUpload,
  validateImageUpload,
} from "@/src/lib/uploads";
import { validateMutationRequest } from "@/src/lib/request-security";
import { isAdminRole } from "@/src/lib/roles";

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

    if (!isAdminRole(authUser.role) && report.userId !== authUser.id) {
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
            "Laporan hanya bisa diubah saat masih menunggu persetujuan Admin 1.",
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const reportInput = parseReportFormData(formData);
    const file = formData.get("foto") as File | null;
    const removeExistingPhoto =
      String(formData.get("removeFoto") || "") === "true";

    const validationError = validateReportInput(reportInput);

    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const fileValidationError = validateImageUpload(file);

    if (fileValidationError) {
      return NextResponse.json(
        { message: fileValidationError },
        { status: 400 }
      );
    }

    let fotoUrl = existingReport.fotoUrl;

    if (removeExistingPhoto) {
      await deleteUploadedFileByUrl(existingReport.fotoUrl);
      fotoUrl = null;
    }

    if (file && file.size > 0) {
      const newPhotoUrl = await saveImageUpload(file);

      if (existingReport.fotoUrl) {
        await deleteUploadedFileByUrl(existingReport.fotoUrl);
      }

      fotoUrl = newPhotoUrl;
    }

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        kategori: reportInput.kategori as ValidKategori,
        namaBarang: reportInput.namaBarang,
        lokasi: reportInput.lokasi,
        deskripsi: reportInput.deskripsi,
        severity: reportInput.severity as ValidSeverity,
        fotoUrl,
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
            "Laporan hanya bisa dihapus saat masih menunggu persetujuan Admin 1.",
        },
        { status: 400 }
      );
    }

    await prisma.report.delete({
      where: { id: reportId },
    });

    await deleteUploadedFileByUrl(existingReport.fotoUrl);

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
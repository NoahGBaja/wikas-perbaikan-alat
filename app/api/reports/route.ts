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
  validateReportAttachmentUpload,
} from "@/src/lib/uploads";
import { listReportsRaw } from "@/src/lib/raw-data";
import { validateMutationRequest } from "@/src/lib/request-security";
import { getRoleLabel, isAdminRole } from "@/src/lib/roles";

export async function POST(req: Request) {
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
      return NextResponse.json(
        { message: "Hanya user yang boleh membuat laporan." },
        { status: 403 }
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

    let attachmentUrl: string | null = null;

    if (file && file.size > 0) {
      attachmentUrl = await saveReportAttachmentUpload(file);
    }

    const report = await prisma.report.create({
      data: {
        userId: authUser.id,
        namaPelapor: reportInput.namaPelapor,
        nomorRuangan: reportInput.nomorRuangan,
        kodeUakpb: reportInput.kodeUakpb,
        kode: reportInput.kode,
        kategori: reportInput.kategori as ValidKategori,
        namaBarang: "Perbaikan Alat",
        lokasi: `Ruangan ${reportInput.nomorRuangan}`,
        deskripsi: [
          `Nama pelapor: ${reportInput.namaPelapor}`,
          `Nomor ruangan: ${reportInput.nomorRuangan}`,
          `Kode UAKPB: ${reportInput.kodeUakpb}`,
          `Kode: ${reportInput.kode}`,
        ].join("\n"),
        severity: "SEDANG",
        fotoUrl: file?.type.startsWith("image/") ? attachmentUrl : null,
        attachmentUrl,
        attachmentType: file && file.size > 0 ? file.type : null,
        attachmentName: file && file.size > 0 ? file.name : null,
        status: "MENUNGGU_ADMIN_1",
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

    return NextResponse.json({
      message: `Laporan berhasil dikirim dan menunggu persetujuan ${getRoleLabel("ADMIN_1")}.`,
      report,
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
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const reports = await listReportsRaw(
      isAdminRole(authUser.role) ? undefined : authUser.id
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

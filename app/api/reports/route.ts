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
import {
  getReportSummaryRaw,
  listReportsPageRaw,
} from "@/src/lib/raw-data";
import { validateMutationRequest } from "@/src/lib/request-security";
import { getRoleLabel, hasAdminAccess } from "@/src/lib/roles";
import {
  findActiveRoomByNameFromMaster,
  findActiveSubcategoryForCategory,
} from "@/src/lib/master-data-db";
import { createTicket } from "@/src/lib/ticket-server";
import { findWorkflowRecipientIds, notifyUsers } from "@/src/lib/notifications";
import { recordAuditLog } from "@/src/lib/audit";
import { protectReportAttachmentReferences } from "@/src/lib/report-attachment-urls";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function parseOptionalPositiveInteger(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const reportResponseInclude = {
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
    orderBy: { createdAt: "asc" as const },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
  },
};

export async function POST(req: Request) {
  const savedAttachmentUrls: string[] = [];
  let idempotencyKey = "";
  let authenticatedUserId: number | null = null;

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
    authenticatedUserId = authUser.id;
    const actorUser = authUser;
    idempotencyKey = req.headers.get("idempotency-key")?.trim() || "";

    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return NextResponse.json(
        { message: "Kunci idempotensi laporan tidak valid." },
        { status: 400 },
      );
    }

    const existingSubmission = await prisma.report.findUnique({
      where: { idempotencyKey },
      include: reportResponseInclude,
    });

    if (existingSubmission) {
      if (existingSubmission.userId !== authUser.id) {
        return NextResponse.json(
          { message: "Kunci idempotensi sudah digunakan." },
          { status: 409 },
        );
      }

      return NextResponse.json({
        message: "Laporan ini sudah pernah dikirim.",
        replayed: true,
        report: protectReportAttachmentReferences(existingSubmission),
      });
    }

    const formData = await req.formData();
    const reportInput = parseModalReportFormData(formData);
    const resubmittedFromId = parseOptionalPositiveInteger(
      formData.get("resubmittedFromReportId"),
    );

    if (resubmittedFromId === undefined) {
      return NextResponse.json(
        { message: "Referensi laporan sebelumnya tidak valid." },
        { status: 400 },
      );
    }
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

    const [masterRoom, masterSubcategory, sourceReport] = await Promise.all([
      findActiveRoomByNameFromMaster(reportInput.namaRuangan),
      findActiveSubcategoryForCategory(
        reportInput.kategori as ValidKategori,
        reportInput.subcategory,
      ),
      resubmittedFromId
        ? prisma.report.findFirst({
            where: {
              id: resubmittedFromId,
              userId: authUser.id,
              status: "TIDAK_DAPAT_DIGUNAKAN",
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (resubmittedFromId && !sourceReport) {
      return NextResponse.json(
        {
          message:
            "Laporan hanya dapat dikirim ulang dari laporan milik Anda yang berstatus Tidak Dapat Digunakan.",
        },
        { status: 400 },
      );
    }

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

    const primaryAttachment = savedAttachments[0] || null;
    const ticket = await createTicket(reportInput.kategori as ValidKategori);

    const report = await prisma.report.create({
      data: {
        ticket,
        idempotencyKey,
        resubmittedFromId,
        userId: authUser.id,
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
      include: reportResponseInclude,
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
        resubmittedFromId,
        attachments: savedAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
        })),
      },
    });

    return NextResponse.json({
      message: `Laporan berhasil dikirim dan menunggu persetujuan ${getRoleLabel("ADMIN_1")}.`,
      report: protectReportAttachmentReferences(report),
    });
  } catch (error) {
    await Promise.all(
      savedAttachmentUrls.map((url) => deleteUploadedFileByUrl(url)),
    ).catch((cleanupError) => {
      console.error("CREATE_REPORT_UPLOAD_CLEANUP_ERROR:", cleanupError);
    });

    if (isUploadValidationError(error)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      idempotencyKey &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existingSubmission = await prisma.report.findUnique({
        where: { idempotencyKey },
        include: reportResponseInclude,
      });

      if (
        existingSubmission &&
        authenticatedUserId !== null &&
        existingSubmission.userId === authenticatedUserId
      ) {
        return NextResponse.json({
          message: "Laporan ini sudah pernah dikirim.",
          replayed: true,
          report: protectReportAttachmentReferences(existingSubmission),
        });
      }
    }

    console.error("CREATE_REPORT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const url = new URL(req.url);
    const limitValue = Number(url.searchParams.get("limit"));
    const offsetValue = Number(url.searchParams.get("offset"));
    const userId = hasAdminAccess(authUser) ? undefined : authUser.id;
    const statusValue = url.searchParams.get("status");
    const validStatuses = [
      "MENUNGGU_ADMIN_1",
      "MENUNGGU_ADMIN_2",
      "MENUNGGU_ADMIN_3",
      "MENUNGGU_ADMIN_4",
      "MENUNGGU_ADMIN_5",
      "DISETUJUI_FINAL",
      "MENUNGGU_KONFIRMASI",
      "TELAH_BERFUNGSI",
      "TIDAK_DAPAT_DIGUNAKAN",
      "DITOLAK",
    ] as const;
    const status = validStatuses.find((item) => item === statusValue);
    const filters = {
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
      ...(statusValue === "PENDING" ? { inProgress: true } : {}),
    };
    const [page, summary] = await Promise.all([
      listReportsPageRaw({
        filters,
        take:
          Number.isInteger(limitValue) && limitValue > 0
            ? Math.min(limitValue, 50)
            : 6,
        skip:
          Number.isInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0,
      }),
      getReportSummaryRaw(userId ? { userId } : {}),
    ]);

    return NextResponse.json({
      ...page,
      reports: page.reports.map(protectReportAttachmentReferences),
      summary,
    });
  } catch (error) {
    console.error("GET_REPORTS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

import "server-only";

import type { Prisma } from "../generated/prisma/client";
import { prisma } from "@/src/lib/prisma";
import type { AppRole } from "@/src/lib/roles";
import type { ReportStatus } from "@/src/lib/workflow";

export type ReportKategori =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

export type ReportSeverity = "RINGAN" | "SEDANG" | "BERAT";

export type SessionUserRow = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: AppRole;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionUserWithPasswordRow = SessionUserRow & {
  passwordHash: string;
};

export type ReportApprovalHistoryRow = {
  id: number;
  reportId: number;
  adminId: number;
  action: "ACC" | "TOLAK";
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string | null;
  createdAt: Date;
  admin: {
    id: number;
    nama: string;
    jabatan: string | null;
    nip: string | null;
    role: AppRole;
  };
};

export type ReportRow = {
  id: number;
  userId: number;
  namaPelapor: string | null;
  nomorRuangan: string | null;
  kodeUakpb: string | null;
  kode: string | null;
  kategori: ReportKategori;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  severity: ReportSeverity;
  fotoUrl: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  status: ReportStatus;
  alasanPenolakan: string | null;

  assignedTechnician: string | null;
  adminNotes: string | null;
  completionNotes: string | null;
  completionPhotoUrl: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  processedAt: Date | null;
  finishedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  user: {
    id: number;
    nama: string;
    jabatan: string | null;
    nip: string | null;
  };

  histories: ReportApprovalHistoryRow[];
};

export type PasswordResetTokenRow = {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

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
      createdAt: "asc",
    },
  },
} as const;

type ReportWithUser = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

function normalizeReportRow(row: ReportWithUser): ReportRow {
  return {
    id: row.id,
    userId: row.userId,
    namaPelapor: row.namaPelapor,
    nomorRuangan: row.nomorRuangan,
    kodeUakpb: row.kodeUakpb,
    kode: row.kode,
    kategori: row.kategori,
    namaBarang: row.namaBarang,
    lokasi: row.lokasi,
    deskripsi: row.deskripsi,
    severity: row.severity,
    fotoUrl: row.fotoUrl,
    attachmentUrl: row.attachmentUrl,
    attachmentType: row.attachmentType,
    attachmentName: row.attachmentName,
    status: row.status,
    alasanPenolakan: row.alasanPenolakan,

    assignedTechnician: row.assignedTechnician,
    adminNotes: row.adminNotes,
    completionNotes: row.completionNotes,
    completionPhotoUrl: row.completionPhotoUrl,
    approvedAt: row.approvedAt,
    rejectedAt: row.rejectedAt,
    processedAt: row.processedAt,
    finishedAt: row.finishedAt,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,

    user: {
      id: row.user.id,
      nama: row.user.nama,
      jabatan: row.user.jabatan,
      nip: row.user.nip,
    },

    histories: row.histories.map((history) => ({
      id: history.id,
      reportId: history.reportId,
      adminId: history.adminId,
      action: history.action,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      note: history.note,
      createdAt: history.createdAt,
      admin: {
        id: history.admin.id,
        nama: history.admin.nama,
        jabatan: history.admin.jabatan,
        nip: history.admin.nip,
        role: history.admin.role,
      },
    })),
  };
}

export function findUserByIdRaw(
  id: number,
  includePassword: true
): Promise<SessionUserWithPasswordRow | null>;
export function findUserByIdRaw(
  id: number,
  includePassword?: false
): Promise<SessionUserRow | null>;
export async function findUserByIdRaw(
  id: number,
  includePassword = false
): Promise<SessionUserRow | SessionUserWithPasswordRow | null> {
  if (includePassword) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nama: true,
        jabatan: true,
        nip: true,
        role: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nama: true,
      jabatan: true,
      nip: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function findUserByNipRaw(
  nip: string,
  includePassword: true
): Promise<SessionUserWithPasswordRow | null>;
export function findUserByNipRaw(
  nip: string,
  includePassword?: false
): Promise<SessionUserRow | null>;
export async function findUserByNipRaw(
  nip: string,
  includePassword = false
): Promise<SessionUserRow | SessionUserWithPasswordRow | null> {
  if (includePassword) {
    return prisma.user.findUnique({
      where: { nip },
      select: {
        id: true,
        nama: true,
        jabatan: true,
        nip: true,
        role: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return prisma.user.findUnique({
    where: { nip },
    select: {
      id: true,
      nama: true,
      jabatan: true,
      nip: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listUsersWithReportCountRaw() {
  return prisma.user.findMany({
    select: {
      id: true,
      nama: true,
      jabatan: true,
      nip: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          reports: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { nama: "asc" }],
  });
}

export async function listReportsRaw(userId?: number) {
  const rows = await prisma.report.findMany({
    where: userId ? { userId } : undefined,
    include: reportInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return rows.map((row) => normalizeReportRow(row));
}

export async function findReportByIdRaw(id: number) {
  const row = await prisma.report.findUnique({
    where: { id },
    include: reportInclude,
  });

  return row ? normalizeReportRow(row) : null;
}

export async function createPasswordResetTokenRaw(
  userId: number,
  tokenHash: string,
  expiresAt: Date
) {
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

export async function findPasswordResetTokenByHashRaw(tokenHash: string) {
  return prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      tokenHash: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  });
}

export async function markPasswordResetTokenUsedRaw(id: number) {
  return prisma.passwordResetToken.update({
    where: { id },
    data: {
      usedAt: new Date(),
    },
  });
}

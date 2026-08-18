import "server-only";

import type { Prisma } from "../generated/prisma/client";
import { prisma } from "@/src/lib/prisma";
import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import type { ReportStatus } from "@/src/lib/workflow";

export type ReportKategori =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

export type ReportSeverity = "RINGAN" | "SEDANG" | "BERAT";

const USER_SEARCH_ROLES: AppRole[] = [
  "SUPER_ADMIN",
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "EXECUTIVE",
  "USER",
];

const USER_SEARCH_CATEGORY_SCOPES: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];

export type SessionUserRow = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: AppRole;
  isSuperAdmin: boolean;
  categoryScope: AppCategoryScope | null;
  sessionVersion: number;
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
    isSuperAdmin: boolean;
    categoryScope: AppCategoryScope | null;
  };
};

export type ReportRow = {
  id: number;
  ticket: string | null;
  userId: number;
  resubmittedFromId: number | null;
  namaPelapor: string | null;
  nomorRuangan: string | null;
  namaRuangan: string | null;
  kodeUakpb: string | null;
  kode: string | null;
  nup: string | null;
  kategori: ReportKategori;
  subcategory: string | null;
  itemType: string | null;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  severity: ReportSeverity;
  repairCost: string | null;
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
  reporterConfirmedAt: Date | null;
  reporterConfirmationStatus: string | null;
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
    role: AppRole;
    isSuperAdmin: boolean;
    categoryScope: AppCategoryScope | null;
  };

  histories: ReportApprovalHistoryRow[];
  attachments: {
    id: number;
    reportId: number;
    url: string;
    fileType: string;
    fileName: string;
    fileSize: number;
    purpose: "DAMAGE_EVIDENCE" | "COMPLETION_PROOF" | null;
    uploadedByName: string | null;
    uploadedByRole: AppRole | null;
    createdAt: Date;
  }[];
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
      role: true,
      isSuperAdmin: true,
      categoryScope: true,
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
          isSuperAdmin: true,
          categoryScope: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  attachments: {
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
    ticket: row.ticket,
    userId: row.userId,
    resubmittedFromId: row.resubmittedFromId,
    namaPelapor: row.namaPelapor,
    nomorRuangan: row.nomorRuangan,
    namaRuangan: row.namaRuangan,
    kodeUakpb: row.kodeUakpb,
    kode: row.kode,
    nup: row.nup,
    kategori: row.kategori,
    subcategory: row.subcategory,
    itemType: row.itemType,
    namaBarang: row.namaBarang,
    lokasi: row.lokasi,
    deskripsi: row.deskripsi,
    severity: row.severity,
    repairCost: row.repairCost?.toString() || null,
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
    reporterConfirmedAt: row.reporterConfirmedAt,
    reporterConfirmationStatus: row.reporterConfirmationStatus,
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
      role: row.user.role,
      isSuperAdmin: row.user.isSuperAdmin,
      categoryScope: row.user.categoryScope,
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
        isSuperAdmin: history.admin.isSuperAdmin,
        categoryScope: history.admin.categoryScope,
      },
    })),
    attachments: row.attachments.map((attachment) => ({
      id: attachment.id,
      reportId: attachment.reportId,
      url: attachment.url,
      fileType: attachment.fileType,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      purpose: attachment.purpose,
      uploadedByName: attachment.uploadedByName,
      uploadedByRole: attachment.uploadedByRole,
      createdAt: attachment.createdAt,
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
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nama: true,
        jabatan: true,
        nip: true,
        role: true,
        isSuperAdmin: true,
        categoryScope: true,
        sessionVersion: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      nama: true,
      jabatan: true,
      nip: true,
      role: true,
      isSuperAdmin: true,
      categoryScope: true,
      sessionVersion: true,
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
    return prisma.user.findFirst({
      where: { activeNip: nip, deletedAt: null },
      select: {
        id: true,
        nama: true,
        jabatan: true,
        nip: true,
        role: true,
        isSuperAdmin: true,
        categoryScope: true,
        sessionVersion: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return prisma.user.findFirst({
    where: { activeNip: nip, deletedAt: null },
    select: {
      id: true,
      nama: true,
      jabatan: true,
      nip: true,
      role: true,
      isSuperAdmin: true,
      categoryScope: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function buildUserSearchWhere(searchValue?: string): Prisma.UserWhereInput {
  const search = searchValue?.trim() || "";
  const normalizedSearch = search.toUpperCase();
  const roleSearch = USER_SEARCH_ROLES.find((role) => role === normalizedSearch);
  const categorySearch = USER_SEARCH_CATEGORY_SCOPES.find(
    (category) => category === normalizedSearch,
  );
  return {
    deletedAt: null,
    ...(search
      ? {
        OR: [
          { nama: { contains: search } },
          { jabatan: { contains: search } },
          { nip: { contains: search } },
          ...(roleSearch ? [{ role: roleSearch }] : []),
          ...(categorySearch ? [{ categoryScope: categorySearch }] : []),
        ],
        }
      : {}),
  };
}

const userListSelect = {
  id: true,
  nama: true,
  jabatan: true,
  nip: true,
  role: true,
  isSuperAdmin: true,
  categoryScope: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { reports: true } },
} as const;

async function addActiveReportCounts<
  T extends { id: number; _count: { reports: number } },
>(users: T[]) {
  const userIds = users.map((user) => user.id);
  const activeReportCounts = userIds.length
    ? await prisma.report.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: {
            notIn: ["TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN", "DITOLAK"],
          },
        },
        _count: { _all: true },
      })
    : [];
  const countByUser = new Map(
    activeReportCounts.map((item) => [item.userId, item._count._all]),
  );

  return users.map((user) => ({
    ...user,
    _count: {
      ...user._count,
      activeReports: countByUser.get(user.id) || 0,
    },
  }));
}

export async function listUsersWithReportCountRaw(options: {
  search?: string;
  take?: number;
  skip?: number;
} = {}) {
  const take = Math.min(Math.max(options.take || 12, 1), 10000);
  const skip = Math.max(options.skip || 0, 0);
  const where = buildUserSearchWhere(options.search);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: [{ role: "asc" }, { nama: "asc" }],
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: await addActiveReportCounts(users),
    total,
    limit: take,
    offset: skip,
  };
}

export async function* iterateUsersWithReportCountRaw(options: {
  search?: string;
  batchSize?: number;
} = {}) {
  const batchSize = Math.min(Math.max(options.batchSize || 500, 1), 1_000);
  const where = buildUserSearchWhere(options.search);
  let cursorId: number | undefined;

  while (true) {
    const users = await prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (users.length === 0) return;

    yield await addActiveReportCounts(users);
    cursorId = users.at(-1)?.id;

    if (users.length < batchSize || !cursorId) return;
  }
}

export async function listReportsRaw(userId?: number) {
  const where = userId ? { userId } : undefined;
  const rows = await prisma.report.findMany({
    where,
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

export async function* iterateReportsRaw(options: {
  filters?: ReportPageFilters;
  batchSize?: number;
} = {}) {
  const batchSize = Math.min(Math.max(options.batchSize || 250, 1), 1_000);
  const where = buildReportWhere(options.filters);
  let cursorId: number | undefined;

  while (true) {
    const rows = await prisma.report.findMany({
      where,
      include: reportInclude,
      orderBy: { id: "desc" },
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (rows.length === 0) return;

    yield rows.map((row) => normalizeReportRow(row));
    cursorId = rows.at(-1)?.id;

    if (rows.length < batchSize || !cursorId) return;
  }
}

const TERMINAL_REPORT_STATUSES: ReportStatus[] = [
  "TELAH_BERFUNGSI",
  "TIDAK_DAPAT_DIGUNAKAN",
  "DITOLAK",
];

export const IN_PROGRESS_REPORT_STATUSES: ReportStatus[] = [
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
  "MENUNGGU_KONFIRMASI",
];

export type ReportPageFilters = {
  userId?: number;
  accessCategory?: ReportKategori;
  category?: ReportKategori;
  status?: ReportStatus;
  inProgress?: boolean;
  subcategory?: string;
  search?: string;
  userQuery?: string;
  rejectedByRole?: AppRole;
  dateFrom?: Date;
  dateTo?: Date;
  budget?: "BELOW_5" | "BETWEEN_5_10" | "ABOVE_10";
};

export function buildReportWhere(
  filters: ReportPageFilters = {},
): Prisma.ReportWhereInput {
  const search = filters.search?.trim();
  const userQuery = filters.userQuery?.trim();
  const parsedId = search ? Number(search) : null;
  const where: Prisma.ReportWhereInput = {};

  if (filters.userId) where.userId = filters.userId;
  if (
    filters.accessCategory &&
    filters.category &&
    filters.accessCategory !== filters.category
  ) {
    where.AND = [
      { kategori: filters.accessCategory },
      { kategori: filters.category },
    ];
  } else if (filters.accessCategory || filters.category) {
    where.kategori = filters.accessCategory || filters.category;
  }
  if (filters.status) where.status = filters.status;
  if (filters.inProgress) where.status = { in: IN_PROGRESS_REPORT_STATUSES };
  if (filters.subcategory) where.subcategory = filters.subcategory;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  if (filters.budget === "BELOW_5") where.repairCost = { lt: 5_000_000 };
  if (filters.budget === "BETWEEN_5_10") {
    where.repairCost = { gte: 5_000_000, lte: 10_000_000 };
  }
  if (filters.budget === "ABOVE_10") where.repairCost = { gt: 10_000_000 };

  if (filters.rejectedByRole) {
    where.histories = {
      some: {
        action: "TOLAK",
        admin: { role: filters.rejectedByRole },
      },
    };
  }

  if (userQuery) {
    where.user = {
      is: {
        OR: [
          { nama: { contains: userQuery } },
          { nip: { contains: userQuery } },
        ],
      },
    };
  }

  if (search) {
    where.OR = [
      ...(Number.isInteger(parsedId) && Number(parsedId) > 0
        ? [{ id: Number(parsedId) }]
        : []),
      { ticket: { contains: search } },
      { namaBarang: { contains: search } },
      { namaPelapor: { contains: search } },
      { nomorRuangan: { contains: search } },
      { kodeUakpb: { contains: search } },
      { kode: { contains: search } },
      { nup: { contains: search } },
      { subcategory: { contains: search } },
      { lokasi: { contains: search } },
      { user: { is: { nama: { contains: search } } } },
      { user: { is: { nip: { contains: search } } } },
    ];
  }

  return where;
}

export async function listReportsPageRaw(options: {
  filters?: ReportPageFilters;
  take?: number;
  skip?: number;
} = {}) {
  const take = Math.min(Math.max(options.take || 12, 1), 100);
  const skip = Math.max(options.skip || 0, 0);
  const where = buildReportWhere(options.filters);

  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: reportInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    prisma.report.count({ where }),
  ]);

  return {
    reports: rows.map((row) => normalizeReportRow(row)),
    total,
    limit: take,
    offset: skip,
    hasMore: skip + rows.length < total,
  };
}

export async function getReportSummaryRaw(
  filters: Pick<ReportPageFilters, "userId" | "accessCategory"> = {},
) {
  const where = buildReportWhere(filters);
  const counts = await prisma.report.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const countByStatus = new Map(
    counts.map((item) => [item.status as ReportStatus, item._count._all]),
  );
  const countStatuses = (statuses: ReportStatus[]) =>
    statuses.reduce((sum, status) => sum + (countByStatus.get(status) || 0), 0);

  return {
    total: countStatuses([
      ...IN_PROGRESS_REPORT_STATUSES,
      "DISETUJUI_FINAL",
      ...TERMINAL_REPORT_STATUSES,
    ]),
    menunggu: countStatuses(IN_PROGRESS_REPORT_STATUSES),
    final: countStatuses([
      "DISETUJUI_FINAL",
      "MENUNGGU_KONFIRMASI",
      "TELAH_BERFUNGSI",
      "TIDAK_DAPAT_DIGUNAKAN",
    ]),
    ditolak: countByStatus.get("DITOLAK") || 0,
    approvedFinal: countByStatus.get("DISETUJUI_FINAL") || 0,
    ongoing: countStatuses(IN_PROGRESS_REPORT_STATUSES),
    telahBerfungsi: countByStatus.get("TELAH_BERFUNGSI") || 0,
  };
}

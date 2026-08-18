import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import {
  createMasterCode,
  ensureMasterCategory,
  getMasterData,
} from "@/src/lib/master-data-db";
import type { AppCategoryScope } from "@/src/lib/roles";
import { recordAuditLog } from "@/src/lib/audit";

const VALID_CATEGORIES: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];
const VALID_TEMPLATE_TYPES = new Set([
  "APPROVAL",
  "REJECTION",
  "NOTES",
  "COMPLETION",
]);
const CUSTOM_TEMPLATE_TYPE = "CUSTOM";
const MAX_TEMPLATE_TYPE_LENGTH = 80;
const MAX_TEMPLATE_NAME_LENGTH = 191;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 10_000;
const MAX_MASTER_TEXT_LENGTH = 191;
const ONGOING_REPORT_STATUSES = [
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
  "MENUNGGU_KONFIRMASI",
] as const;

function isValidCategory(value: unknown): value is AppCategoryScope {
  return (
    typeof value === "string" &&
    VALID_CATEGORIES.includes(value as AppCategoryScope)
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getRoomEditImpact(name: string, code: string) {
  const where = {
    OR: [
      { namaRuangan: name },
      { nomorRuangan: code },
      { lokasi: name },
    ],
  };
  const [totalReports, ongoingReports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.count({
      where: {
        ...where,
        status: { in: [...ONGOING_REPORT_STATUSES] },
      },
    }),
  ]);

  return {
    totalReports,
    ongoingReports,
    historyReports: Math.max(totalReports - ongoingReports, 0),
  };
}

async function getSubcategoryEditImpact(
  category: AppCategoryScope,
  name: string,
) {
  const where = { kategori: category, subcategory: name };
  const [totalReports, ongoingReports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.count({
      where: {
        ...where,
        status: { in: [...ONGOING_REPORT_STATUSES] },
      },
    }),
  ]);

  return {
    totalReports,
    ongoingReports,
    historyReports: Math.max(totalReports - ongoingReports, 0),
  };
}

function parseTemplateInput(body: Record<string, unknown>) {
  const selectedType = cleanText(body.type) || "NOTES";
  const customType = cleanText(body.customType);
  const type = selectedType === CUSTOM_TEMPLATE_TYPE ? customType : selectedType;
  const name = cleanText(body.name ?? body.title);
  const description = cleanText(body.description ?? body.body);

  if (!type || !name || !description) {
    return { error: "Jenis, nama, dan deskripsi template wajib diisi." } as const;
  }

  if (
    selectedType !== CUSTOM_TEMPLATE_TYPE &&
    !VALID_TEMPLATE_TYPES.has(selectedType)
  ) {
    return { error: "Jenis template tidak valid." } as const;
  }

  if (
    type.length > MAX_TEMPLATE_TYPE_LENGTH ||
    name.length > MAX_TEMPLATE_NAME_LENGTH ||
    description.length > MAX_TEMPLATE_DESCRIPTION_LENGTH
  ) {
    return {
      error:
        "Jenis maksimal 80 karakter, nama maksimal 191 karakter, dan deskripsi maksimal 10.000 karakter.",
    } as const;
  }

  return { selectedType, type, name, description } as const;
}

async function requireSuperAdmin() {
  const authUser = await getApiSessionUser();

  if (!authUser) {
    return {
      error: NextResponse.json(
        { message: "Sesi masuk tidak ditemukan." },
        { status: 401 },
      ),
    };
  }

  if (!authUser.isSuperAdmin && authUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { message: "Hanya Admin Utama yang boleh mengelola master data." },
        { status: 403 },
      ),
    };
  }

  return { authUser };
}

export async function GET() {
  const access = await requireSuperAdmin();

  if ("error" in access) return access.error;

  const masterData = await getMasterData();

  return NextResponse.json(masterData);
}

export async function POST(req: Request) {
  try {
    const requestError = validateMutationRequest(req);

    if (requestError) return requestError;

    const access = await requireSuperAdmin();

    if ("error" in access) return access.error;

    const body = await req.json();
    const kind = cleanText(body.kind);

    if (kind === "room") {
      const name = cleanText(body.name);
      const code = cleanText(body.code);

      if (!name || !code) {
        return NextResponse.json(
          { message: "Nama ruangan dan kode ruangan wajib diisi." },
          { status: 400 },
        );
      }

      await prisma.masterRoom.upsert({
        where: { name },
        update: { code, active: true },
        create: { name, code, active: true },
      });
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: `room:${code}`,
        action: "UPSERT",
        summary: `Data ruangan ${name} (${code}) disimpan.`,
        metadata: { kind, name, code },
      });

      return NextResponse.json({
        message: "Data ruangan berhasil disimpan.",
        masterData: await getMasterData(),
      });
    }

    if (kind === "subcategory") {
      const category = body.category;
      const name = cleanText(body.name);
      const code = cleanText(body.code) || createMasterCode(name);

      if (!isValidCategory(category) || !name) {
        return NextResponse.json(
          { message: "Kategori dan nama subkategori wajib diisi." },
          { status: 400 },
        );
      }

      const masterCategory = await ensureMasterCategory(category);
      const existing = await prisma.masterSubcategory.findFirst({
        where: { categoryId: masterCategory.id, code },
      });

      if (existing) {
        await prisma.masterSubcategory.update({
          where: { id: existing.id },
          data: { name, active: true },
        });
      } else {
        await prisma.masterSubcategory.create({
          data: {
            categoryId: masterCategory.id,
            code,
            name,
            active: true,
          },
        });
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: `subcategory:${category}:${code}`,
        action: "UPSERT",
        summary: `Subkategori ${name} disimpan.`,
        metadata: { kind, category, name, code },
      });

      return NextResponse.json({
        message: "Subkategori berhasil disimpan.",
        masterData: await getMasterData(),
      });
    }

    if (kind === "itemType") {
      const category = body.category;
      const subcategoryId = Number(body.subcategoryId || 0);
      const subcategoryName = cleanText(body.subcategoryName);
      const name = cleanText(body.name);
      const code = cleanText(body.code) || createMasterCode(name);

      if (!isValidCategory(category) || !subcategoryName || !name) {
        return NextResponse.json(
          { message: "Kategori, subkategori, dan tipe barang wajib diisi." },
          { status: 400 },
        );
      }

      const masterCategory = await ensureMasterCategory(category);
      let subcategory =
        subcategoryId > 0
          ? await prisma.masterSubcategory.findFirst({
              where: { id: subcategoryId, categoryId: masterCategory.id },
            })
          : null;

      if (!subcategory) {
        const subcategoryCode = createMasterCode(subcategoryName);
        subcategory = await prisma.masterSubcategory.findFirst({
          where: { categoryId: masterCategory.id, code: subcategoryCode },
        });

        if (!subcategory) {
          subcategory = await prisma.masterSubcategory.create({
            data: {
              categoryId: masterCategory.id,
              code: subcategoryCode,
              name: subcategoryName,
              active: true,
            },
          });
        }
      }

      const existing = await prisma.masterItemType.findFirst({
        where: { subcategoryId: subcategory.id, code },
      });

      if (existing) {
        await prisma.masterItemType.update({
          where: { id: existing.id },
          data: { name, active: true },
        });
      } else {
        await prisma.masterItemType.create({
          data: {
            subcategoryId: subcategory.id,
            code,
            name,
            active: true,
          },
        });
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: `itemType:${category}:${subcategory.id}:${code}`,
        action: "UPSERT",
        summary: `Tipe barang ${name} disimpan.`,
        metadata: {
          kind,
          category,
          subcategoryId: subcategory.id,
          subcategoryName: subcategory.name,
          name,
          code,
        },
      });

      return NextResponse.json({
        message: "Tipe barang berhasil disimpan.",
        masterData: await getMasterData(),
      });
    }

    if (kind === "messageTemplate") {
      const selectedType = cleanText(body.type) || "NOTES";
      const customType = cleanText(body.customType);
      const type =
        selectedType === CUSTOM_TEMPLATE_TYPE ? customType : selectedType;
      const name = cleanText(body.name ?? body.title);
      const description = cleanText(body.description ?? body.body);

      if (!type || !name || !description) {
        return NextResponse.json(
          { message: "Jenis, nama, dan deskripsi template wajib diisi." },
          { status: 400 },
        );
      }

      if (
        selectedType !== CUSTOM_TEMPLATE_TYPE &&
        !VALID_TEMPLATE_TYPES.has(selectedType)
      ) {
        return NextResponse.json(
          { message: "Jenis template tidak valid." },
          { status: 400 },
        );
      }

      if (
        type.length > MAX_TEMPLATE_TYPE_LENGTH ||
        name.length > MAX_TEMPLATE_NAME_LENGTH ||
        description.length > MAX_TEMPLATE_DESCRIPTION_LENGTH
      ) {
        return NextResponse.json(
          {
            message:
              "Jenis maksimal 80 karakter, nama maksimal 191 karakter, dan deskripsi maksimal 10.000 karakter.",
          },
          { status: 400 },
        );
      }

      const existingTemplate = await prisma.messageTemplate.findFirst({
        where: {
          type,
          title: name,
        },
      });

      if (existingTemplate) {
        await prisma.messageTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            body: description,
            active: true,
          },
        });
      } else {
        await prisma.messageTemplate.create({
          data: {
            type,
            title: name,
            body: description,
            active: true,
          },
        });
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MESSAGE_TEMPLATE",
        entityId: `${type}:${name}`,
        action: "UPSERT",
        summary: `Template pesan ${name} disimpan.`,
        metadata: { kind, type, name, description },
      });

      return NextResponse.json({
        message: "Template pesan berhasil disimpan.",
        masterData: await getMasterData(),
      });
    }

    return NextResponse.json(
      { message: "Jenis master data tidak valid." },
      { status: 400 },
    );
  } catch (error) {
    console.error("SAVE_MASTER_DATA_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menyimpan master data." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) return requestError;

    const access = await requireSuperAdmin();

    if ("error" in access) return access.error;

    const body = (await req.json()) as Record<string, unknown>;
    const kind = cleanText(body.kind);
    const id = Number(body.id || 0);
    const preview = body.preview === true;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { message: "ID master data tidak valid." },
        { status: 400 },
      );
    }

    if (kind === "room") {
      const name = cleanText(body.name);
      const code = cleanText(body.code);

      if (!name || !code) {
        return NextResponse.json(
          { message: "Nama ruangan dan kode ruangan wajib diisi." },
          { status: 400 },
        );
      }

      if (
        name.length > MAX_MASTER_TEXT_LENGTH ||
        code.length > MAX_MASTER_TEXT_LENGTH
      ) {
        return NextResponse.json(
          { message: "Nama dan kode ruangan maksimal 191 karakter." },
          { status: 400 },
        );
      }

      const existing = await prisma.masterRoom.findUnique({ where: { id } });

      if (!existing || !existing.active) {
        return NextResponse.json(
          { message: "Data ruangan tidak ditemukan." },
          { status: 404 },
        );
      }

      const duplicate = await prisma.masterRoom.findFirst({
        where: {
          id: { not: id },
          OR: [{ name }, { code }],
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { message: "Nama atau kode ruangan sudah digunakan." },
          { status: 409 },
        );
      }

      const impact = await getRoomEditImpact(existing.name, existing.code);

      if (preview) {
        return NextResponse.json({
          message: "Konfirmasi dampak perubahan ruangan.",
          requiresConfirmation: true,
          impact,
          before: { name: existing.name, code: existing.code },
          after: { name, code },
        });
      }

      const [, propagated] = await prisma.$transaction([
        prisma.masterRoom.update({
          where: { id },
          data: { name, code, active: true },
        }),
        prisma.report.updateMany({
          where: {
            OR: [
              { namaRuangan: existing.name },
              { nomorRuangan: existing.code },
              { lokasi: existing.name },
            ],
          },
          data: {
            namaRuangan: name,
            nomorRuangan: code,
            lokasi: name,
          },
        }),
      ]);

      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: `room:${id}`,
        action: "EDIT",
        summary: `Ruangan ${existing.name} (${existing.code}) diubah menjadi ${name} (${code}).`,
        metadata: {
          kind,
          before: { name: existing.name, code: existing.code },
          after: { name, code },
          impact,
          propagatedReports: propagated.count,
        },
      });

      return NextResponse.json({
        message: `Ruangan berhasil diubah dan ${propagated.count} laporan disinkronkan.`,
        impact: { ...impact, propagatedReports: propagated.count },
        masterData: await getMasterData(),
      });
    }

    if (kind === "subcategory") {
      const category = body.category;
      const name = cleanText(body.name);

      if (!isValidCategory(category) || !name) {
        return NextResponse.json(
          { message: "Kategori dan nama subkategori wajib diisi." },
          { status: 400 },
        );
      }

      if (name.length > MAX_MASTER_TEXT_LENGTH) {
        return NextResponse.json(
          { message: "Nama subkategori maksimal 191 karakter." },
          { status: 400 },
        );
      }

      const [existing, targetCategory] = await Promise.all([
        prisma.masterSubcategory.findUnique({
          where: { id },
          include: { category: true },
        }),
        prisma.masterCategory.findUnique({ where: { code: category } }),
      ]);

      if (!existing || !existing.active) {
        return NextResponse.json(
          { message: "Subkategori tidak ditemukan." },
          { status: 404 },
        );
      }

      if (!targetCategory || !targetCategory.active) {
        return NextResponse.json(
          { message: "Kategori tujuan tidak ditemukan." },
          { status: 400 },
        );
      }

      const code = cleanText(body.code) || existing.code || createMasterCode(name);
      const duplicate = await prisma.masterSubcategory.findFirst({
        where: {
          id: { not: id },
          categoryId: targetCategory.id,
          OR: [{ code }, { name }],
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { message: "Subkategori tersebut sudah ada pada kategori tujuan." },
          { status: 409 },
        );
      }

      const oldCategory = existing.category.code as AppCategoryScope;
      const impact = await getSubcategoryEditImpact(
        oldCategory,
        existing.name,
      );

      if (preview) {
        return NextResponse.json({
          message: "Konfirmasi dampak perubahan subkategori.",
          requiresConfirmation: true,
          impact,
          before: {
            category: oldCategory,
            name: existing.name,
            code: existing.code,
          },
          after: { category, name, code },
        });
      }

      const [, propagated] = await prisma.$transaction([
        prisma.masterSubcategory.update({
          where: { id },
          data: {
            categoryId: targetCategory.id,
            code,
            name,
            active: true,
          },
        }),
        prisma.report.updateMany({
          where: {
            kategori: oldCategory,
            subcategory: existing.name,
          },
          data: {
            kategori: category,
            subcategory: name,
            itemType: name,
          },
        }),
      ]);

      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: `subcategory:${id}`,
        action: "EDIT",
        summary: `Subkategori ${existing.name} diubah menjadi ${name}.`,
        metadata: {
          kind,
          before: {
            category: oldCategory,
            name: existing.name,
            code: existing.code,
          },
          after: { category, name, code },
          impact,
          propagatedReports: propagated.count,
        },
      });

      return NextResponse.json({
        message: `Subkategori berhasil diubah dan ${propagated.count} laporan disinkronkan.`,
        impact: { ...impact, propagatedReports: propagated.count },
        masterData: await getMasterData(),
      });
    }

    if (kind === "messageTemplate") {
      const parsed = parseTemplateInput(body);

      if ("error" in parsed) {
        return NextResponse.json(
          { message: parsed.error },
          { status: 400 },
        );
      }

      const existing = await prisma.messageTemplate.findUnique({
        where: { id },
      });

      if (!existing || !existing.active) {
        return NextResponse.json(
          { message: "Template pesan tidak ditemukan." },
          { status: 404 },
        );
      }

      const duplicate = await prisma.messageTemplate.findFirst({
        where: {
          id: { not: id },
          type: parsed.type,
          title: parsed.name,
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { message: "Template dengan jenis dan nama tersebut sudah ada." },
          { status: 409 },
        );
      }

      const impact = {
        totalReports: 0,
        ongoingReports: 0,
        historyReports: 0,
        futureOnly: true,
      };

      if (preview) {
        return NextResponse.json({
          message: "Konfirmasi perubahan template pesan.",
          requiresConfirmation: true,
          impact,
          before: {
            type: existing.type,
            name: existing.title,
            description: existing.body,
          },
          after: {
            type: parsed.type,
            name: parsed.name,
            description: parsed.description,
          },
        });
      }

      await prisma.messageTemplate.update({
        where: { id },
        data: {
          type: parsed.type,
          title: parsed.name,
          body: parsed.description,
          active: true,
        },
      });

      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MESSAGE_TEMPLATE",
        entityId: id,
        action: "EDIT",
        summary: `Template pesan ${existing.title} diubah menjadi ${parsed.name}.`,
        metadata: {
          kind,
          before: {
            type: existing.type,
            name: existing.title,
            description: existing.body,
          },
          after: {
            type: parsed.type,
            name: parsed.name,
            description: parsed.description,
          },
          impact,
        },
      });

      return NextResponse.json({
        message: "Template pesan berhasil diubah.",
        impact,
        masterData: await getMasterData(),
      });
    }

    return NextResponse.json(
      { message: "Jenis master data tidak valid." },
      { status: 400 },
    );
  } catch (error) {
    console.error("UPDATE_MASTER_DATA_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat memperbarui master data." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const requestError = validateMutationRequest(req);

    if (requestError) return requestError;

    const access = await requireSuperAdmin();

    if ("error" in access) return access.error;

    const body = await req.json();
    const kind = cleanText(body.kind);

    if (kind === "room") {
      const id = Number(body.id || 0);
      const name = cleanText(body.name);
      const code = cleanText(body.code);

      if (id > 0) {
        await prisma.masterRoom.update({
          where: { id },
          data: { active: false },
        });
      } else {
        if (!name || !code) {
          return NextResponse.json(
            { message: "Nama ruangan dan kode ruangan wajib diisi." },
            { status: 400 },
          );
        }

        const existing = await prisma.masterRoom.findFirst({
          where: {
            OR: [{ name }, { code }],
          },
        });

        if (existing) {
          await prisma.masterRoom.update({
            where: { id: existing.id },
            data: { active: false },
          });
        } else {
          await prisma.masterRoom.create({
            data: {
              name,
              code,
              active: false,
            },
          });
        }
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: id > 0 ? `room:${id}` : `room:${code}`,
        action: "DELETE",
        summary: `Data ruangan ${name || id} dihapus.`,
        metadata: { kind, id, name, code },
      });

      return NextResponse.json({
        message: "Data ruangan berhasil dihapus.",
        masterData: await getMasterData(),
      });
    }

    if (kind === "subcategory") {
      const id = Number(body.id || 0);
      const category = body.category;
      const name = cleanText(body.name);
      const code = cleanText(body.code) || createMasterCode(name);

      if (id > 0) {
        await prisma.masterSubcategory.update({
          where: { id },
          data: { active: false },
        });
      } else {
        if (!isValidCategory(category) || !name) {
          return NextResponse.json(
            { message: "Kategori dan nama subkategori wajib diisi." },
            { status: 400 },
          );
        }

        const masterCategory = await ensureMasterCategory(category);
        const existing = await prisma.masterSubcategory.findFirst({
          where: { categoryId: masterCategory.id, code },
        });

        if (existing) {
          await prisma.masterSubcategory.update({
            where: { id: existing.id },
            data: { active: false },
          });
        } else {
          await prisma.masterSubcategory.create({
            data: {
              categoryId: masterCategory.id,
              code,
              name,
              active: false,
            },
          });
        }
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: id > 0 ? `subcategory:${id}` : `subcategory:${category}:${code}`,
        action: "DELETE",
        summary: `Subkategori ${name || id} dihapus.`,
        metadata: { kind, id, category, name, code },
      });

      return NextResponse.json({
        message: "Subkategori berhasil dihapus.",
        masterData: await getMasterData(),
      });
    }

    if (kind === "itemType") {
      const id = Number(body.id || 0);
      const category = body.category;
      const subcategoryId = Number(body.subcategoryId || 0);
      const subcategoryName = cleanText(body.subcategoryName);
      const subcategoryCode =
        cleanText(body.subcategoryCode) || createMasterCode(subcategoryName);
      const name = cleanText(body.name);
      const code = cleanText(body.code) || createMasterCode(name);

      if (id > 0) {
        await prisma.masterItemType.update({
          where: { id },
          data: { active: false },
        });
      } else {
        if (!isValidCategory(category) || !subcategoryName || !name) {
          return NextResponse.json(
            { message: "Kategori, subkategori, dan tipe barang wajib diisi." },
            { status: 400 },
          );
        }

        const masterCategory = await ensureMasterCategory(category);
        let subcategory =
          subcategoryId > 0
            ? await prisma.masterSubcategory.findFirst({
                where: { id: subcategoryId, categoryId: masterCategory.id },
              })
            : null;

        if (!subcategory) {
          subcategory = await prisma.masterSubcategory.findFirst({
            where: { categoryId: masterCategory.id, code: subcategoryCode },
          });
        }

        if (!subcategory) {
          subcategory = await prisma.masterSubcategory.create({
            data: {
              categoryId: masterCategory.id,
              code: subcategoryCode,
              name: subcategoryName,
              active: true,
            },
          });
        }

        const existing = await prisma.masterItemType.findFirst({
          where: { subcategoryId: subcategory.id, code },
        });

        if (existing) {
          await prisma.masterItemType.update({
            where: { id: existing.id },
            data: { active: false },
          });
        } else {
          await prisma.masterItemType.create({
            data: {
              subcategoryId: subcategory.id,
              code,
              name,
              active: false,
            },
          });
        }
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MASTER_DATA",
        entityId: id > 0 ? `itemType:${id}` : `itemType:${category}:${code}`,
        action: "DELETE",
        summary: `Tipe barang ${name || id} dihapus.`,
        metadata: { kind, id, category, subcategoryId, subcategoryName, name, code },
      });

      return NextResponse.json({
        message: "Tipe barang berhasil dihapus.",
        masterData: await getMasterData(),
      });
    }

    if (kind !== "messageTemplate") {
      return NextResponse.json(
        {
          message: "Jenis master data tidak valid.",
        },
        { status: 400 },
      );
    }

    const id = Number(body.id || 0);
    const type = cleanText(body.type) || "NOTES";
    const name = cleanText(body.name ?? body.title);
    const description = cleanText(body.description ?? body.body);

    if (id > 0) {
      await prisma.messageTemplate.update({
        where: { id },
        data: { active: false },
      });
    } else {
      if (!name) {
        return NextResponse.json(
          { message: "Nama template wajib diisi." },
          { status: 400 },
        );
      }

      const existing = await prisma.messageTemplate.findFirst({
        where: { type, title: name },
      });

      if (existing) {
        await prisma.messageTemplate.update({
          where: { id: existing.id },
          data: { active: false },
        });
      } else {
        await prisma.messageTemplate.create({
          data: {
            type,
            title: name,
            body: description || "-",
            active: false,
          },
        });
      }
    }
    await recordAuditLog({
      actorUserId: access.authUser.id,
      entityType: "MESSAGE_TEMPLATE",
      entityId: id > 0 ? id : `${type}:${name}`,
      action: "DELETE",
      summary: `Template pesan ${name || id} dihapus.`,
      metadata: { kind, id, type, name },
    });

    return NextResponse.json({
      message: "Template pesan berhasil dihapus.",
      masterData: await getMasterData(),
    });
  } catch (error) {
    console.error("DELETE_MASTER_DATA_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menghapus master data." },
      { status: 500 },
    );
  }
}

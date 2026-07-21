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

function isValidCategory(value: unknown): value is AppCategoryScope {
  return (
    typeof value === "string" &&
    VALID_CATEGORIES.includes(value as AppCategoryScope)
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
      const type = cleanText(body.type) || "NOTES";
      const title = cleanText(body.title);
      const bodyText = cleanText(body.body);

      if (!title || !bodyText) {
        return NextResponse.json(
          { message: "Judul dan isi template wajib diisi." },
          { status: 400 },
        );
      }

      const inactiveTemplate = await prisma.messageTemplate.findFirst({
        where: {
          type,
          title,
          active: false,
        },
      });

      if (inactiveTemplate) {
        await prisma.messageTemplate.update({
          where: { id: inactiveTemplate.id },
          data: {
            body: bodyText,
            active: true,
          },
        });
      } else {
        await prisma.messageTemplate.create({
          data: {
            type,
            title,
            body: bodyText,
            active: true,
          },
        });
      }
      await recordAuditLog({
        actorUserId: access.authUser.id,
        entityType: "MESSAGE_TEMPLATE",
        entityId: `${type}:${title}`,
        action: "UPSERT",
        summary: `Template pesan ${title} disimpan.`,
        metadata: { kind, type, title, body: bodyText },
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
    const title = cleanText(body.title);
    const bodyText = cleanText(body.body);

    if (id > 0) {
      await prisma.messageTemplate.update({
        where: { id },
        data: { active: false },
      });
    } else {
      if (!title) {
        return NextResponse.json(
          { message: "Judul template wajib diisi." },
          { status: 400 },
        );
      }

      const existing = await prisma.messageTemplate.findFirst({
        where: { type, title },
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
            title,
            body: bodyText || "-",
            active: false,
          },
        });
      }
    }
    await recordAuditLog({
      actorUserId: access.authUser.id,
      entityType: "MESSAGE_TEMPLATE",
      entityId: id > 0 ? id : `${type}:${title}`,
      action: "DELETE",
      summary: `Template pesan ${title || id} dihapus.`,
      metadata: { kind, id, type, title },
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

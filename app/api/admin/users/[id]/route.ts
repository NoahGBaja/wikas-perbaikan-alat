import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import {
  isCategoryScopedRole,
  isSuperAdmin as hasSuperAdminAccess,
} from "@/src/lib/roles";

const VALID_ROLES: AppRole[] = [
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "EXECUTIVE",
  "USER",
];

const VALID_CATEGORY_SCOPES: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];

function isValidRole(role: unknown): role is AppRole {
  return typeof role === "string" && VALID_ROLES.includes(role as AppRole);
}

function isValidCategoryScope(value: unknown): value is AppCategoryScope {
  return (
    typeof value === "string" &&
    VALID_CATEGORY_SCOPES.includes(value as AppCategoryScope)
  );
}

function parseUserId(id: string) {
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

async function requireSuperAdmin() {
  const authUser = await getApiSessionUser();

  if (!authUser) {
    return {
      error: NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 }),
    };
  }

  if (!hasSuperAdminAccess(authUser)) {
    return {
      error: NextResponse.json(
        { message: "Hanya Admin Utama yang boleh mengelola pengguna." },
        { status: 403 }
      ),
    };
  }

  return { authUser };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) {
      return requestError;
    }

    const access = await requireSuperAdmin();

    if ("error" in access) {
      return access.error;
    }

    const { id } = await ctx.params;
    const userId = parseUserId(id);

    if (!userId) {
      return NextResponse.json(
        { message: "ID user tidak valid." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const nama = typeof body.nama === "string" ? body.nama.trim() : "";
    const jabatan =
      typeof body.jabatan === "string" ? body.jabatan.trim() : "";
    const nip = typeof body.nip === "string" ? body.nip.trim() : "";
    const role = isValidRole(body.role) ? body.role : "USER";
    const isSuperAdmin = body.isSuperAdmin === true;
    const categoryScope = isValidCategoryScope(body.categoryScope)
      ? body.categoryScope
      : null;

    if (!nama || !nip) {
      return NextResponse.json(
        { message: "Nama dan NIP wajib diisi." },
        { status: 400 }
      );
    }

    if (nip.length > 50 || nama.length > 120 || jabatan.length > 120) {
      return NextResponse.json(
        { message: "NIP atau nama terlalu panjang." },
        { status: 400 }
      );
    }

    if (isCategoryScopedRole(role) && !categoryScope) {
      return NextResponse.json(
        { message: "Kategori wajib dipilih untuk PJ Perbaikan dan PPK." },
        { status: 400 }
      );
    }

    const existingUserByNip = await prisma.user.findFirst({
      where: { activeNip: nip, deletedAt: null },
      select: {
        id: true,
      },
    });

    if (existingUserByNip && existingUserByNip.id !== userId) {
      return NextResponse.json(
        { message: "NIP sudah digunakan." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: {
        nama,
        jabatan: jabatan || null,
        nip,
        activeNip: nip,
        role,
        isSuperAdmin,
        categoryScope: isCategoryScopedRole(role) ? categoryScope : null,
      },
      select: {
        id: true,
        nama: true,
        jabatan: true,
        nip: true,
        role: true,
        isSuperAdmin: true,
        categoryScope: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Pengguna berhasil diperbarui.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE_ADMIN_USER_ERROR:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "NIP sudah digunakan." },
        { status: 409 },
      );
    }

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

    const access = await requireSuperAdmin();

    if ("error" in access) {
      return access.error;
    }

    const { id } = await ctx.params;
    const userId = parseUserId(id);

    if (!userId) {
      return NextResponse.json(
        { message: "ID user tidak valid." },
        { status: 400 }
      );
    }

    if (access.authUser.id === userId) {
      return NextResponse.json(
        { message: "Akun yang sedang dipakai tidak bisa dihapus." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        isSuperAdmin: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    if (hasSuperAdminAccess(user)) {
      return NextResponse.json(
        { message: "Akun Admin Utama tidak boleh dihapus dari dasbor." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: {
        activeNip: null,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Pengguna berhasil dinonaktifkan tanpa menghapus riwayatnya.",
    });
  } catch (error) {
    console.error("DELETE_ADMIN_USER_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

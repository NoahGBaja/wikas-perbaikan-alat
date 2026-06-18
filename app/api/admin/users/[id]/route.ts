import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import type { AppRole } from "@/src/lib/roles";

const VALID_ROLES: AppRole[] = [
  "SUPER_ADMIN",
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "ADMIN_6",
  "USER",
];

function isValidRole(role: unknown): role is AppRole {
  return typeof role === "string" && VALID_ROLES.includes(role as AppRole);
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
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (authUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { message: "Hanya Super Admin yang boleh mengelola user." },
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

    const existingUserByNip = await prisma.user.findUnique({
      where: { nip },
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
      where: { id: userId },
      data: {
        nama,
        jabatan: jabatan || null,
        nip,
        role,
      },
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

    return NextResponse.json({
      message: "User berhasil diperbarui.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE_ADMIN_USER_ERROR:", error);

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User tidak ditemukan." },
        { status: 404 }
      );
    }

    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Akun Super Admin tidak boleh dihapus dari dashboard." },
        { status: 400 }
      );
    }

    if (user._count.reports > 0) {
      return NextResponse.json(
        {
          message:
            "User yang sudah memiliki laporan tidak bisa dihapus. Nonaktifkan pengguna secara operasional bila perlu.",
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      message: "User berhasil dihapus.",
    });
  } catch (error) {
    console.error("DELETE_ADMIN_USER_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

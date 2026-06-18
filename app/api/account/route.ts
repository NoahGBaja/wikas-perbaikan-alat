import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import { hasAdminAccess } from "@/src/lib/roles";

export async function GET() {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: authUser.id,
        nama: authUser.nama,
        jabatan: authUser.jabatan,
        nip: authUser.nip,
        role: authUser.role,
        isSuperAdmin: authUser.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error("GET_ACCOUNT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) {
      return requestError;
    }

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json(
        { message: "Hanya admin yang dapat mengubah nama." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const nama = typeof body.nama === "string" ? body.nama.trim() : "";
    const jabatan =
      typeof body.jabatan === "string" ? body.jabatan.trim() : "";

    if (!nama) {
      return NextResponse.json(
        { message: "Nama wajib diisi." },
        { status: 400 }
      );
    }

    if (nama.length > 120) {
      return NextResponse.json(
        { message: "Nama maksimal 120 karakter." },
        { status: 400 }
      );
    }

    if (jabatan.length > 120) {
      return NextResponse.json(
        { message: "Role terlalu panjang." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        nama,
        jabatan: jabatan || null,
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
      message: "Profil berhasil diperbarui.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE_ACCOUNT_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

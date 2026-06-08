import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import {
  hashPassword,
  validatePasswordStrength,
} from "@/src/lib/passwords";
import { validateMutationRequest } from "@/src/lib/request-security";

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
        { message: "Hanya Super Admin yang boleh reset password user." },
        { status: 403 }
      ),
    };
  }

  return { authUser };
}

export async function POST(
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

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: "User tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const password = typeof body.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json(
        { message: "Password baru wajib diisi." },
        { status: 400 }
      );
    }

    const passwordErrors = validatePasswordStrength(password);

    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { message: passwordErrors[0] },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(password),
      },
      select: {
        id: true,
        nama: true,
        nip: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: "Password user berhasil direset.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("RESET_ADMIN_USER_PASSWORD_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
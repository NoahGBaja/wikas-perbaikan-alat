import { NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import {
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
} from "@/src/lib/passwords";
import { prisma } from "@/src/lib/prisma";
import { validateMutationRequest } from "@/src/lib/request-security";
import {
  AUTH_COOKIE_NAME,
  createAuthSessionTag,
  getAuthCookieOptions,
  signAuthToken,
} from "@/src/lib/auth";

export async function POST(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) {
      return requestError;
    }

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const body = await req.json();

    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { message: "Kata sandi saat ini, kata sandi baru, dan konfirmasi wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: "Konfirmasi password baru tidak sama." },
        { status: 400 }
      );
    }

    const passwordErrors = validatePasswordStrength(newPassword);

    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { message: passwordErrors[0] },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { message: "Kata sandi saat ini salah." },
        { status: 400 }
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    const response = NextResponse.json({
      message: "Kata sandi berhasil diperbarui.",
    });

    response.cookies.set(
      AUTH_COOKIE_NAME,
      signAuthToken({
        userId: authUser.id,
        nama: authUser.nama,
        role: authUser.role,
        isSuperAdmin: authUser.isSuperAdmin,
        sessionVersion: authUser.sessionVersion,
        sessionTag: createAuthSessionTag({
          passwordHash: updatedUser.passwordHash,
          role: authUser.role,
          isSuperAdmin: authUser.isSuperAdmin,
        }),
      }),
      getAuthCookieOptions(),
    );

    return response;
  } catch (error) {
    console.error("UPDATE_ACCOUNT_PASSWORD_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import {
  hashPassword,
  validatePasswordStrength,
} from "@/src/lib/passwords";
import {
  findUserByNipRaw,
  listUsersWithReportCountRaw,
} from "@/src/lib/raw-data";
import { validateMutationRequest } from "@/src/lib/request-security";
import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import { isCategoryScopedRole } from "@/src/lib/roles";

const VALID_ROLES: AppRole[] = [
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
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

async function requireSuperAdmin() {
  const authUser = await getApiSessionUser();

  if (!authUser) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!authUser.isSuperAdmin) {
    return {
      error: NextResponse.json(
        { message: "Hanya Super Admin yang boleh mengelola user." },
        { status: 403 }
      ),
    };
  }

  return { authUser };
}

export async function GET() {
  try {
    const access = await requireSuperAdmin();

    if ("error" in access) {
      return access.error;
    }

    const users = await listUsersWithReportCountRaw();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET_ADMIN_USERS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) {
      return requestError;
    }

    const access = await requireSuperAdmin();

    if ("error" in access) {
      return access.error;
    }

    const body = await req.json();

    const nama = typeof body.nama === "string" ? body.nama.trim() : "";
    const jabatan =
      typeof body.jabatan === "string" ? body.jabatan.trim() : "";
    const nip = typeof body.nip === "string" ? body.nip.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = isValidRole(body.role) ? body.role : "USER";
    const isSuperAdmin = body.isSuperAdmin === true;
    const categoryScope = isValidCategoryScope(body.categoryScope)
      ? body.categoryScope
      : null;

    if (!nama || !nip || !password) {
      return NextResponse.json(
        { message: "Nama, NIP, dan password wajib diisi." },
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

    const passwordErrors = validatePasswordStrength(password);

    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { message: passwordErrors[0] },
        { status: 400 }
      );
    }

    const existingUserByNip = await findUserByNipRaw(nip);

    if (existingUserByNip) {
      return NextResponse.json(
        { message: "NIP sudah digunakan." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await prisma.user.create({
      data: {
        nama,
        jabatan: jabatan || null,
        nip,
        passwordHash,
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
      message: "User berhasil dibuat.",
      user: createdUser,
    });
  } catch (error) {
    console.error("CREATE_ADMIN_USER_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

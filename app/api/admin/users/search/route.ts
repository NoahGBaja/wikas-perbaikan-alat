import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { hasAdminAccess } from "@/src/lib/roles";
import { consumeRateLimitBucket, getClientIp } from "@/src/lib/rate-limit";

const MIN_SEARCH_LENGTH = 3;

function parseLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 8;
  }

  return Math.min(parsed, 20);
}

export async function GET(req: Request) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const url = new URL(req.url);
    const query = (url.searchParams.get("q") || "").trim();
    const limit = parseLimit(url.searchParams.get("limit"));

    if (query.length < MIN_SEARCH_LENGTH) {
      return NextResponse.json({ users: [] });
    }

    const rateLimit = await consumeRateLimitBucket(
      `admin-users-search:${authUser.id}:${getClientIp(req)}`,
      { limit: 30, windowMs: 60 * 1000 },
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Terlalu banyak pencarian. Tunggu sebentar lalu coba lagi." },
        { status: 429 },
      );
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { nama: { contains: query } },
          { nip: { contains: query } },
        ],
      },
      select: {
        id: true,
        nama: true,
        nip: true,
        role: true,
      },
      orderBy: [{ nama: "asc" }, { id: "asc" }],
      take: limit,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("SEARCH_ADMIN_USERS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat mencari pengguna." },
      { status: 500 },
    );
  }
}

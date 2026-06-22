import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { hasAdminAccess } from "@/src/lib/roles";

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
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const query = (url.searchParams.get("q") || "").trim();
    const limit = parseLimit(url.searchParams.get("limit"));

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
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
      { message: "Terjadi kesalahan saat mencari user." },
      { status: 500 },
    );
  }
}

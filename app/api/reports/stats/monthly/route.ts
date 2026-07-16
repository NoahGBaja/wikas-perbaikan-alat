import { NextRequest, NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import { getMonthlyReportStats } from "@/src/lib/monthly-report-stats";
import {
  hasAdminAccess,
  isCategoryScopedRole,
  isSuperAdmin as hasSuperAdminAccess,
} from "@/src/lib/roles";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;

    const canSeeAllCategories = hasSuperAdminAccess(authUser);
    const stats = await getMonthlyReportStats({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
      status: searchParams.get("status"),
      categoryScope: !canSeeAllCategories && isCategoryScopedRole(authUser.role)
        ? authUser.categoryScope
        : null,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("MONTHLY_REPORT_STATS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

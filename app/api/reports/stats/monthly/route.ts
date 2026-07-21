import { NextRequest, NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import { getMonthlyReportStats } from "@/src/lib/monthly-report-stats";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (authUser.role !== "EXECUTIVE") {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const stats = await getMonthlyReportStats({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
      status: searchParams.get("status"),
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

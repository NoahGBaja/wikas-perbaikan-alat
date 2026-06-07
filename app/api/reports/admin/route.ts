import { NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import { listReportsRaw } from "@/src/lib/raw-data";
import { isAdminRole } from "@/src/lib/roles";

export async function GET() {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const reports = await listReportsRaw();

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("ADMIN_REPORTS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
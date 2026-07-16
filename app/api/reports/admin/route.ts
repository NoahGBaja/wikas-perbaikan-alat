import { NextResponse } from "next/server";
import { getApiSessionUser } from "@/src/lib/session";
import { listReportsRaw } from "@/src/lib/raw-data";
import { hasAdminAccess, isSuperAdmin as hasSuperAdminAccess } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";

export async function GET() {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    if (!hasAdminAccess(authUser)) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const canSeeAllCategories = hasSuperAdminAccess(authUser);
    const reports = (await listReportsRaw()).filter((report) =>
      canAdminAccessReport({
        role: authUser.role,
        isSuperAdmin: canSeeAllCategories,
        categoryScope: canSeeAllCategories ? null : authUser.categoryScope,
        reportCategory: report.kategori,
      }),
    );

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("ADMIN_REPORTS_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

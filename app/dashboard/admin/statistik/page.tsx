import AdminStatistikPageClient from "@/src/components/dashboard/AdminStatistikPageClient";
import { getMonthlyReportStats } from "@/src/lib/monthly-report-stats";
import { requireAdminUser } from "@/src/lib/session";
import {
  isCategoryScopedRole,
  isSuperAdmin as hasSuperAdminAccess,
} from "@/src/lib/roles";

export default async function AdminStatistikPage() {
  const currentUser = await requireAdminUser();
  const canSeeAllCategories = hasSuperAdminAccess(currentUser);
  const initialStats = await getMonthlyReportStats({
    categoryScope: !canSeeAllCategories && isCategoryScopedRole(currentUser.role)
      ? currentUser.categoryScope
      : null,
  });

  return <AdminStatistikPageClient initialStats={initialStats} />;
}

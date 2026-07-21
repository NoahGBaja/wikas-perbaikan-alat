import AdminStatistikPageClient from "@/src/components/dashboard/AdminStatistikPageClient";
import { getMonthlyReportStats } from "@/src/lib/monthly-report-stats";
import { requireRole } from "@/src/lib/session";

export default async function AdminStatistikPage() {
  await requireRole("EXECUTIVE");
  const initialStats = await getMonthlyReportStats();

  return (
    <AdminStatistikPageClient
      initialStats={initialStats}
      canReturnToDashboard={false}
    />
  );
}

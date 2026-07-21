import { redirect } from "next/navigation";
import AdminDashboard from "@/src/components/dashboard/AdminDashboard";
import { requireAdminUser } from "@/src/lib/session";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string | string[] }>;
}) {
  const currentUser = await requireAdminUser();

  if (currentUser.role === "EXECUTIVE") {
    redirect("/dashboard/admin/statistik");
  }

  const rawReportId = (await searchParams).report;
  const parsedReportId = Number(Array.isArray(rawReportId) ? rawReportId[0] : rawReportId);
  const initialReportId =
    Number.isInteger(parsedReportId) && parsedReportId > 0 ? parsedReportId : null;

  return (
    <AdminDashboard
      currentUser={currentUser}
      title="Dasbor Laporan Kerusakan Barang & Alat"
      initialReportId={initialReportId}
    />
  );
}

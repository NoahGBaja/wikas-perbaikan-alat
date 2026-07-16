import AdminDashboard from "@/src/components/dashboard/AdminDashboard";
import { requireAdminUser } from "@/src/lib/session";

export default async function AdminDashboardPage() {
  const currentUser = await requireAdminUser();

  return (
    <AdminDashboard
      currentUser={currentUser}
      title="Dasbor Laporan Kerusakan Barang & Alat"
    />
  );
}

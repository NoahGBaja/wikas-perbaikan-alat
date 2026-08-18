import AdminUsersPage from "@/src/components/dashboard/AdminUsersPage";
import { requireAdminUser } from "@/src/lib/session";
import { redirect } from "next/navigation";

export default async function AdminUsersDashboardPage() {
  const currentUser = await requireAdminUser();

  if (!currentUser.isSuperAdmin && currentUser.role !== "SUPER_ADMIN") {
    redirect("/dashboard/admin");
  }

  return <AdminUsersPage currentUserId={currentUser.id} />;
}

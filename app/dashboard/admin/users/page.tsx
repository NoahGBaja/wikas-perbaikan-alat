import AdminUsersPage from "@/src/components/dashboard/AdminUsersPage";
import { requireAdminUser } from "@/src/lib/session";

export default async function AdminUsersDashboardPage() {
  const currentUser = await requireAdminUser();

  return <AdminUsersPage currentUserId={currentUser.id} />;
}
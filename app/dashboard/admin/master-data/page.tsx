import { redirect } from "next/navigation";
import MasterDataPage from "@/src/components/dashboard/MasterDataPage";
import { requireAdminUser } from "@/src/lib/session";

export default async function AdminMasterDataPage() {
  const currentUser = await requireAdminUser();

  if (!currentUser.isSuperAdmin && currentUser.role !== "SUPER_ADMIN") {
    redirect("/dashboard/admin");
  }

  return <MasterDataPage />;
}

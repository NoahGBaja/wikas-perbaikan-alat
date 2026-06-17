import UserReportPageClient from "@/src/components/reports/UserReportPageClient";
import { requireRole } from "@/src/lib/session";

export default async function CreateReportPage() {
  const currentUser = await requireRole("USER");

  return <UserReportPageClient defaultNamaPelapor={currentUser.nama} />;
}

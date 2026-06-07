import { requireAdminUser } from "@/src/lib/session";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminUser();

  return children;
}
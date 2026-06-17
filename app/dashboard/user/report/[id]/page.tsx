import { redirect } from "next/navigation";
import UserReportPageClient from "@/src/components/reports/UserReportPageClient";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/session";

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireRole("USER");
  const { id } = await params;
  const reportId = Number(id);

  if (!Number.isInteger(reportId)) {
    redirect("/dashboard/user/status");
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      userId: true,
      status: true,
      kategori: true,
      namaPelapor: true,
      nomorRuangan: true,
      kodeUakpb: true,
      kode: true,
    },
  });

  if (
    !report ||
    report.userId !== currentUser.id ||
    report.status !== "MENUNGGU_ADMIN_1"
  ) {
    redirect("/dashboard/user/status");
  }

  return (
    <UserReportPageClient
      defaultNamaPelapor={currentUser.nama}
      initialReport={{
        id: report.id,
        kategori: report.kategori,
        namaPelapor: report.namaPelapor,
        nomorRuangan: report.nomorRuangan,
        kodeUakpb: report.kodeUakpb,
        kode: report.kode,
      }}
    />
  );
}

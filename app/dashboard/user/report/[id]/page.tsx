import { redirect } from "next/navigation";
import ReportForm from "@/src/components/reports/ReportForm";
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
      namaBarang: true,
      lokasi: true,
      deskripsi: true,
      severity: true,
      fotoUrl: true,
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
    <ReportForm
      mode="edit"
      initialReport={{
        id: report.id,
        kategori: report.kategori,
        namaBarang: report.namaBarang,
        lokasi: report.lokasi,
        deskripsi: report.deskripsi,
        severity: report.severity,
        fotoUrl: report.fotoUrl,
      }}
    />
  );
}
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
      namaRuangan: true,
      kodeUakpb: true,
      kode: true,
      nup: true,
      subcategory: true,
      itemType: true,
      namaBarang: true,
      repairCost: true,
      deskripsi: true,
    },
  });

  if (
    !report ||
    report.userId !== currentUser.id ||
    ["DITOLAK", "TELAH_BERFUNGSI", "TIDAK_DAPAT_DIGUNAKAN"].includes(
      report.status,
    )
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
        namaRuangan: report.namaRuangan,
        kodeUakpb: report.kodeUakpb,
        kode: report.kode,
        nup: report.nup,
        subcategory: report.subcategory,
        namaBarang: report.namaBarang,
        repairCost: report.repairCost?.toString() || null,
        deskripsi: report.deskripsi,
      }}
    />
  );
}

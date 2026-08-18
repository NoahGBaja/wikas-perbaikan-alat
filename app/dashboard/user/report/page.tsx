import UserReportPageClient from "@/src/components/reports/UserReportPageClient";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/session";

export default async function CreateReportPage({
  searchParams,
}: {
  searchParams: Promise<{ repeat?: string }>;
}) {
  const currentUser = await requireRole("USER");
  const { repeat } = await searchParams;
  const repeatReportId = Number(repeat);
  const repeatReport = Number.isInteger(repeatReportId) && repeatReportId > 0
    ? await prisma.report.findFirst({
        where: {
          id: repeatReportId,
          userId: currentUser.id,
          status: "TIDAK_DAPAT_DIGUNAKAN",
        },
        select: {
          id: true,
          ticket: true,
          namaPelapor: true,
          nomorRuangan: true,
          namaRuangan: true,
          kodeUakpb: true,
          kode: true,
          nup: true,
          kategori: true,
          subcategory: true,
          namaBarang: true,
          deskripsi: true,
        },
      })
    : null;

  return (
    <UserReportPageClient
      defaultNamaPelapor={currentUser.nama}
      repeatReport={repeatReport}
    />
  );
}

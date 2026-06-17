"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UserReportModal, {
  type UserReportCategory,
  type UserReportModalPayload,
} from "@/src/components/reports/UserReportModal";

type UserReportPageClientProps = {
  defaultNamaPelapor: string;
  initialReport?: {
    id: number;
    namaPelapor: string | null;
    nomorRuangan: string | null;
    kodeUakpb: string | null;
    kode: string | null;
    kategori: UserReportCategory;
  };
};

async function readApiResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();

  return {
    message:
      text.trim().slice(0, 180) ||
      `Request gagal dengan status ${res.status}.`,
  };
}

export default function UserReportPageClient({
  defaultNamaPelapor,
  initialReport,
}: UserReportPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  async function handleSubmit(payload: UserReportModalPayload) {
    const formData = new FormData();

    formData.append("kategori", payload.kategori);
    formData.append("namaPelapor", payload.namaPelapor);
    formData.append("nomorRuangan", payload.nomorRuangan);
    formData.append("kodeUakpb", payload.kodeUakpb);
    formData.append("kode", payload.kode);

    if (payload.attachment) {
      formData.append("attachment", payload.attachment);
    }

    const res = await fetch(
      initialReport ? `/api/reports/${initialReport.id}` : "/api/reports",
      {
        method: initialReport ? "PATCH" : "POST",
        body: formData,
      }
    );

    const data = await readApiResponse(res);

    if (!res.ok) {
      throw new Error(data.message || "Gagal mengirim laporan.");
    }

    router.push("/dashboard/user/status");
    router.refresh();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      router.push("/dashboard/user");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
          Dashboard Pegawai
        </p>
        <h1 className="mt-3 text-3xl font-bold md:text-5xl">
          Buat Laporan Perbaikan Alat
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Isi data laporan melalui modal, lalu laporan akan masuk ke approval
          Admin 1 sampai Admin 6.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          Buka Form Laporan
        </button>
      </div>

      <UserReportModal
        open={open}
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        defaultKategori={initialReport?.kategori || "FASILITAS_INVENTARIS"}
        defaultNamaPelapor={initialReport?.namaPelapor || defaultNamaPelapor}
        defaultNomorRuangan={initialReport?.nomorRuangan || ""}
        defaultKodeUakpb={initialReport?.kodeUakpb || ""}
        defaultKode={initialReport?.kode || ""}
        submitLabel={initialReport ? "Simpan Perubahan" : "Kirim Laporan"}
      />
    </div>
  );
}

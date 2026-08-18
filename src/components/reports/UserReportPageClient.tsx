"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserReportModal, {
  type UserReportCategory,
  type UserReportModalPayload,
} from "@/src/components/reports/UserReportModal";
import { getRoleLabel } from "@/src/lib/roles";

type UserReportPageClientProps = {
  defaultNamaPelapor: string;
  initialReport?: {
    id: number;
    namaPelapor: string | null;
    nomorRuangan: string | null;
    namaRuangan?: string | null;
    kodeUakpb: string | null;
    kode: string | null;
    nup?: string | null;
    subcategory?: string | null;
    namaBarang?: string | null;
    repairCost?: string | null;
    deskripsi: string;
    kategori: UserReportCategory;
  };
  repeatReport?: {
    id: number;
    ticket?: string | null;
    namaPelapor: string | null;
    nomorRuangan: string | null;
    namaRuangan?: string | null;
    kodeUakpb: string | null;
    kode: string | null;
    nup?: string | null;
    subcategory?: string | null;
    namaBarang?: string | null;
    deskripsi: string;
    kategori: UserReportCategory;
  } | null;
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
  repeatReport,
}: UserReportPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const submissionKeyRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);

  async function handleSubmit(payload: UserReportModalPayload) {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    const formData = new FormData();

    formData.append("kategori", payload.kategori);
    formData.append("namaPelapor", payload.namaPelapor);
    formData.append("nomorRuangan", payload.nomorRuangan);
    formData.append("namaRuangan", payload.namaRuangan);
    formData.append("kodeUakpb", payload.namaBarang);
    formData.append("kode", payload.kode);
    formData.append("nup", payload.nup);
    formData.append("subcategory", payload.subcategory);
    formData.append("namaBarang", payload.namaBarang);
    formData.append("repairCost", payload.repairCost);
    formData.append("deskripsi", payload.deskripsi);
    if (repeatReport) {
      formData.append("resubmittedFromReportId", String(repeatReport.id));
    }

    payload.attachments.forEach((attachment) => {
      formData.append("attachments", attachment);
    });

    try {
      if (!initialReport && !submissionKeyRef.current) {
        submissionKeyRef.current = crypto.randomUUID();
      }

      const res = await fetch(
        initialReport ? `/api/reports/${initialReport.id}` : "/api/reports",
        {
          method: initialReport ? "PATCH" : "POST",
          headers: initialReport
            ? undefined
            : { "Idempotency-Key": submissionKeyRef.current || "" },
          body: formData,
        },
      );

      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data.message || "Gagal mengirim laporan.");
      }

      submissionKeyRef.current = null;
      router.push("/dashboard/user/status");
      router.refresh();
    } finally {
      requestInFlightRef.current = false;
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      window.location.assign("/dashboard/user");
    }
  }

  const formDefaults = initialReport || repeatReport;
  const isResubmission = !initialReport && !!repeatReport;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
        <section className="rounded-2xl border border-blue-100 bg-blue-50/40 px-8 py-10 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
            Dasbor Pegawai
          </p>
          <h1 className="mt-3 text-3xl font-bold md:text-5xl">
            {isResubmission
              ? "Kirim Ulang Laporan Perbaikan"
              : "Buat Laporan Perbaikan Alat"}
          </h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            {isResubmission ? (
              <>
                Form sudah diisi dari laporan {repeatReport.ticket || `#${repeatReport.id}`}.
                Periksa kembali datanya dan unggah lampiran terbaru sebelum dikirim.
              </>
            ) : (
              <>
                Isi data melalui jendela formulir, lalu laporan akan masuk ke alur
                persetujuan {getRoleLabel("ADMIN_1")} sampai {getRoleLabel("ADMIN_5")}.
              </>
            )}
          </p>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-500"
          >
            Buka Formulir Laporan
          </button>
        </section>
      </div>

      <UserReportModal
        open={open}
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        defaultKategori={formDefaults?.kategori || "FASILITAS_INVENTARIS"}
        defaultNamaPelapor={formDefaults?.namaPelapor || defaultNamaPelapor}
        defaultNomorRuangan={formDefaults?.nomorRuangan || ""}
        defaultNamaRuangan={formDefaults?.namaRuangan || ""}
        defaultKodeUakpb={formDefaults?.kodeUakpb || ""}
        defaultKode={formDefaults?.kode || ""}
        defaultNup={formDefaults?.nup || ""}
        defaultSubcategory={formDefaults?.subcategory || ""}
        defaultNamaBarang={formDefaults?.namaBarang || formDefaults?.kodeUakpb || ""}
        defaultRepairCost={initialReport?.repairCost || ""}
        defaultDeskripsi={formDefaults?.deskripsi || ""}
        attachmentRequired={!initialReport}
        submitLabel={
          initialReport
            ? "Simpan Perubahan"
            : isResubmission
              ? "Kirim Ulang Request"
              : "Kirim Laporan"
        }
      />
    </div>
  );
}

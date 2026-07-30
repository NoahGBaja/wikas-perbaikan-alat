"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  FeedbackBanner,
  showError,
  showSuccess,
  toFeedback,
  type FeedbackMessage,
} from "@/src/components/ui/feedback";

type Kategori =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

type EditableReport = {
  id: number;
  kategori: Kategori;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  fotoUrl: string | null;
};

type ReportFormProps = {
  mode: "create" | "edit";
  initialReport?: EditableReport;
  headerBackHref?: string;
  headerBackLabel?: string;
};

const kategoriLabels: Record<Kategori, string> = {
  FASILITAS_INVENTARIS: "Fasilitas & Inventaris",
  IT_ELEKTRONIK: "IT & Elektronik",
  LABORATORIUM: "Laboratorium",
};

export default function ReportForm({
  mode,
  initialReport,
  headerBackHref,
  headerBackLabel = "Kembali",
}: ReportFormProps) {
  const router = useRouter();

  const [kategori, setKategori] = useState<Kategori | "">(
    initialReport?.kategori || ""
  );
  const [namaBarang, setNamaBarang] = useState(initialReport?.namaBarang || "");
  const [lokasi, setLokasi] = useState(initialReport?.lokasi || "");
  const [deskripsi, setDeskripsi] = useState(initialReport?.deskripsi || "");
  const [foto, setFoto] = useState<File | null>(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [previewUrl, setPreviewUrl] = useState(
    initialReport?.fotoUrl && !removeFoto ? initialReport.fotoUrl : ""
  );

  const isEditMode = mode === "edit" && initialReport;

  useEffect(() => {
    if (!foto) {
      setPreviewUrl(!removeFoto ? initialReport?.fotoUrl || "" : "");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(foto);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [foto, initialReport?.fotoUrl, removeFoto]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    if (!kategori) {
      const text = "Silakan pilih kategori terlebih dahulu.";
      setMessage(toFeedback(text, "error"));
      showError("Data laporan belum lengkap", text);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("kategori", kategori);
      formData.append("namaBarang", namaBarang);
      formData.append("lokasi", lokasi);
      formData.append("deskripsi", deskripsi);
      formData.append("removeFoto", String(removeFoto));

      if (foto) {
        formData.append("foto", foto);
      }

      const endpoint = isEditMode
        ? `/api/reports/${initialReport.id}`
        : "/api/reports";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const text = data.message || "Gagal menyimpan laporan.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal menyimpan laporan", text);
        setLoading(false);
        return;
      }

      const text = isEditMode
        ? "Laporan berhasil diperbarui."
        : "Laporan berhasil dikirim.";
      setMessage(toFeedback(text, "success"));
      showSuccess("Laporan tersimpan", text);

      if (!isEditMode) {
        setNamaBarang("");
        setLokasi("");
        setDeskripsi("");
        setFoto(null);
        setRemoveFoto(false);
      }

      setTimeout(() => {
        router.push("/dashboard/user/status");
      }, 900);
    } catch (error) {
      console.error(error);
      const text = "Terjadi kesalahan saat menyimpan laporan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal menyimpan laporan", text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">
              {isEditMode ? "Edit Laporan" : "Buat Laporan"}
            </h1>
            <p className="mt-2 text-white/70">
              {isEditMode
                ? "Perbarui detail laporan selagi statusnya masih menunggu."
                : "Pilih kategori, isi detail kerusakan, lalu unggah foto barang atau alat."}
            </p>
          </div>

          {headerBackHref ? (
            <a
              href={headerBackHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              {headerBackLabel}
            </a>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-xl font-semibold">Pilih Kategori</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(
              [
                "FASILITAS_INVENTARIS",
                "IT_ELEKTRONIK",
                "LABORATORIUM",
              ] as Kategori[]
            ).map((item) => {
              const active = kategori === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setKategori(item)}
                  className={[
                    "rounded-2xl border p-5 text-left transition",
                    active
                      ? "border-cyan-300 bg-cyan-400/15"
                      : "border-white/10 bg-white/5 hover:bg-white/10",
                  ].join(" ")}
                >
                  <p className="text-lg font-bold">{kategoriLabels[item]}</p>
                  <p className="mt-2 text-sm text-white/70">
                    Pilih kategori ini untuk laporan barang atau alat.
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {kategori ? (
          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-2xl font-bold">
              {isEditMode ? "Perbarui Laporan" : "Form Laporan"} -{" "}
              {kategoriLabels[kategori]}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">Kategori</label>
                <input
                  value={kategoriLabels[kategori]}
                  disabled
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Nama Barang / Alat
                </label>
                <input
                  value={namaBarang}
                  onChange={(e) => setNamaBarang(e.target.value)}
                  placeholder="Contoh: AC Ruang Rapat"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Lokasi</label>
                <input
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  placeholder="Contoh: Ruang TU"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Unggah Foto
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setFoto(file);

                    if (file) {
                      setRemoveFoto(false);
                    }
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-white"
                />
                <p className="mt-2 text-xs text-white/55">
                  Format JPG, PNG, atau WEBP. Maksimal 5MB.
                </p>
              </div>

              {initialReport?.fotoUrl ? (
                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={removeFoto}
                      onChange={(event) => setRemoveFoto(event.target.checked)}
                    />
                    Hapus foto lama bila tidak diperlukan lagi
                  </label>
                </div>
              ) : null}

              {previewUrl ? (
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm font-medium">Preview Foto</p>
                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <Image
                      src={previewUrl}
                      alt="Preview unggahan"
                      width={1200}
                      height={800}
                      className="max-h-72 w-auto object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Deskripsi Kerusakan
                </label>
                <textarea
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  rows={5}
                  placeholder="Jelaskan kerusakan barang atau alat..."
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  required
                />
              </div>
            </div>

            <FeedbackBanner message={message} className="mt-5" />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {loading
                  ? "Menyimpan..."
                  : isEditMode
                    ? "Simpan Perubahan"
                    : "Kirim Laporan"}
              </button>

              <button
                type="button"
                onClick={() => window.location.assign("/dashboard/user/status")}
                className="rounded-2xl border border-white/10 bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/15"
              >
                Kembali
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

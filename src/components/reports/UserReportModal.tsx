"use client";

import { useEffect, useId, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import Image from "next/image";
import { FileText, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";

const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type UserReportCategory =
  | "FASILITAS_INVENTARIS"
  | "IT_ELEKTRONIK"
  | "LABORATORIUM";

const CATEGORY_OPTIONS: Array<{
  value: UserReportCategory;
  label: string;
  description: string;
}> = [
  {
    value: "FASILITAS_INVENTARIS",
    label: "Fasilitas & Inventaris",
    description: "Meja, kursi, lemari, AC, dan fasilitas ruangan.",
  },
  {
    value: "IT_ELEKTRONIK",
    label: "IT & Alat Elektronik",
    description: "Komputer, printer, proyektor, jaringan, dan elektronik.",
  },
  {
    value: "LABORATORIUM",
    label: "Laboratorium",
    description: "Alat, perlengkapan, dan kebutuhan ruang laboratorium.",
  },
];

export type UserReportModalPayload = {
  kategori: UserReportCategory;
  namaPelapor: string;
  nomorRuangan: string;
  kodeUakpb: string;
  kode: string;
  deskripsi: string;
  attachment: File | null;
};

type UserReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (payload: UserReportModalPayload) => void | Promise<void>;
  defaultNamaPelapor?: string;
  defaultNomorRuangan?: string;
  defaultKodeUakpb?: string;
  defaultKode?: string;
  defaultDeskripsi?: string;
  defaultKategori?: UserReportCategory;
  submitLabel?: string;
};

type FormErrors = Partial<Record<keyof UserReportModalPayload, string>>;

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 font-bold text-rose-500">
      *
    </span>
  );
}

function validateForm(payload: UserReportModalPayload) {
  const errors: FormErrors = {};

  if (!payload.namaPelapor.trim()) {
    errors.namaPelapor = "Nama pelapor wajib diisi.";
  }

  if (!payload.nomorRuangan.trim()) {
    errors.nomorRuangan = "Kode ruangan wajib diisi.";
  }

  if (!payload.kodeUakpb.trim()) {
    errors.kodeUakpb = "Kode UAKPB wajib diisi.";
  }

  if (!payload.kode.trim()) {
    errors.kode = "Kode wajib diisi.";
  } else if (!/^\d{12}$/.test(payload.kode.trim())) {
    errors.kode = "Kode harus berisi tepat 12 digit angka.";
  }

  if (!payload.deskripsi.trim()) {
    errors.deskripsi = "Deskripsi wajib diisi.";
  } else if (payload.deskripsi.trim().length > 2000) {
    errors.deskripsi = "Deskripsi maksimal 2000 karakter.";
  }

  if (payload.attachment) {
    if (payload.attachment.size > MAX_ATTACHMENT_SIZE) {
      errors.attachment = "Lampiran maksimal 2 MB.";
    } else if (!ALLOWED_ATTACHMENT_TYPES.includes(payload.attachment.type)) {
      errors.attachment = "Lampiran harus berupa gambar atau PDF.";
    }
  }

  return errors;
}

export default function UserReportModal({
  open,
  onOpenChange,
  onSubmit,
  defaultNamaPelapor = "",
  defaultNomorRuangan = "",
  defaultKodeUakpb = "",
  defaultKode = "",
  defaultDeskripsi = "",
  defaultKategori = "FASILITAS_INVENTARIS",
  submitLabel = "Kirim Laporan",
}: UserReportModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  const [kategori, setKategori] = useState<UserReportCategory>(defaultKategori);
  const [namaPelapor, setNamaPelapor] = useState(defaultNamaPelapor);
  const [nomorRuangan, setNomorRuangan] = useState(defaultNomorRuangan);
  const [kodeUakpb, setKodeUakpb] = useState(defaultKodeUakpb);
  const [kode, setKode] = useState(defaultKode);
  const [deskripsi, setDeskripsi] = useState(defaultDeskripsi);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setKategori(defaultKategori);
    setNamaPelapor(defaultNamaPelapor);
    setNomorRuangan(defaultNomorRuangan);
    setKodeUakpb(defaultKodeUakpb);
    setKode(defaultKode);
    setDeskripsi(defaultDeskripsi);
  }, [
    defaultKategori,
    defaultKode,
    defaultKodeUakpb,
    defaultDeskripsi,
    defaultNamaPelapor,
    defaultNomorRuangan,
  ]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!attachment || !attachment.type.startsWith("image/")) {
      setAttachmentPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(attachment);
    setAttachmentPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [attachment]);

  if (!open) {
    return null;
  }

  const payload: UserReportModalPayload = {
    kategori,
    namaPelapor,
    nomorRuangan,
    kodeUakpb,
    kode,
    deskripsi,
    attachment,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const nextErrors = validateForm(payload);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Data laporan belum lengkap", {
        description: Object.values(nextErrors).filter(Boolean).join(" "),
      });
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit?.({
        ...payload,
        kategori: payload.kategori,
        namaPelapor: payload.namaPelapor.trim(),
        nomorRuangan: payload.nomorRuangan.trim(),
        kodeUakpb: payload.kodeUakpb.trim(),
        kode: payload.kode.trim(),
        deskripsi: payload.deskripsi.trim(),
      });

      if (!onSubmit) {
        onOpenChange(false);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengirim laporan.",
      );
      toast.error("Gagal mengirim laporan", {
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengirim laporan.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setAttachment(file);

    if (!file) {
      setErrors((current) => ({ ...current, attachment: undefined }));
      return;
    }

    const nextErrors = validateForm({ ...payload, attachment: file });
    setErrors((current) => ({
      ...current,
      attachment: nextErrors.attachment,
    }));

    if (nextErrors.attachment) {
      toast.error("Lampiran tidak valid", {
        description: nextErrors.attachment,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 text-slate-950"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-2xl font-bold text-slate-950">
              Input Laporan
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-slate-600">
              Lengkapi data laporan sebelum dikirim.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-6 py-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Jenis Perbaikan" required className="md:col-span-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {CATEGORY_OPTIONS.map((option) => {
                  const active = kategori === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKategori(option.value)}
                      className={[
                        "rounded-md border p-4 text-left transition",
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-bold">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-slate-500">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Nama Pelapor"
              required
              error={errors.namaPelapor}
              className="md:col-span-2"
            >
              <input
                value={namaPelapor}
                onChange={(event) => setNamaPelapor(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Masukkan nama pelapor"
                required
              />
            </Field>

            <Field label="Kode Ruangan" required error={errors.nomorRuangan}>
              <input
                value={nomorRuangan}
                onChange={(event) => setNomorRuangan(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </Field>

            <Field label="Kode UAKPB" required error={errors.kodeUakpb}>
              <input
                value={kodeUakpb}
                onChange={(event) => setKodeUakpb(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </Field>

            <Field
              label="Kode Barang"
              required
              error={errors.kode}
              className="md:col-span-2"
            >
              <input
                value={kode}
                onChange={(event) =>
                  setKode(event.target.value.replace(/\D/g, "").slice(0, 12))
                }
                inputMode="numeric"
                maxLength={12}
                pattern="\d{12}"
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </Field>

            <Field
              label="Deskripsi"
              required
              error={errors.deskripsi}
              className="md:col-span-2"
            >
              <textarea
                value={deskripsi}
                onChange={(event) => setDeskripsi(event.target.value)}
                rows={5}
                maxLength={2000}
                className="w-full resize-y rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Jelaskan kendala atau kerusakan yang perlu diperbaiki"
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                {deskripsi.trim().length}/2000 karakter
              </p>
            </Field>

            <Field
              label="Lampiran (opsional)"
              error={errors.attachment}
              className="md:col-span-2"
            >
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:bg-slate-100">
                <Upload className="mb-3 h-6 w-6 text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">
                  Upload gambar atau PDF
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Maksimal 2 MB.
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleAttachmentChange}
                  className="sr-only"
                />
              </label>

              {attachment ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      aria-label="Hapus lampiran"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {attachmentPreviewUrl ? (
                    <Image
                      src={attachmentPreviewUrl}
                      alt="Preview lampiran"
                      width={800}
                      height={500}
                      className="mt-3 max-h-56 w-full rounded-md object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
              ) : null}
            </Field>
          </div>

          {submitError ? (
            <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Menyimpan..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {children}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

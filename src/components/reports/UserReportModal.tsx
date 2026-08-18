"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import Image from "next/image";
import { FileText, RefreshCcw, Send, Upload, X } from "lucide-react";
import { showError } from "@/src/components/ui/feedback";
import {
  CATEGORY_MASTER,
  getSubcategoriesForCategory,
  ROOM_MASTER,
  type CategoryMaster,
  type RoomMaster,
} from "@/src/lib/master-data";
import {
  formatItemCodeInput,
  getNupFromItemCode,
  isValidItemCode,
  normalizeStoredItemCode,
} from "@/src/lib/item-code";

const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
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

export type UserReportModalPayload = {
  kategori: UserReportCategory;
  namaPelapor: string;
  nomorRuangan: string;
  namaRuangan: string;
  kodeUakpb: string;
  kode: string;
  nup: string;
  subcategory: string;
  namaBarang: string;
  repairCost: string;
  deskripsi: string;
  attachments: File[];
};

type UserReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (payload: UserReportModalPayload) => void | Promise<void>;
  defaultNamaPelapor?: string;
  defaultNomorRuangan?: string;
  defaultNamaRuangan?: string;
  defaultKodeUakpb?: string;
  defaultKode?: string;
  defaultNup?: string;
  defaultSubcategory?: string;
  defaultNamaBarang?: string;
  defaultRepairCost?: string;
  defaultDeskripsi?: string;
  defaultKategori?: UserReportCategory;
  attachmentRequired?: boolean;
  submitLabel?: string;
};

type FormErrors = Partial<Record<keyof UserReportModalPayload, string>>;

type MasterDataState = {
  categories: CategoryMaster[];
  rooms: RoomMaster[];
};

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 font-bold text-rose-500">
      *
    </span>
  );
}

function validateForm(
  payload: UserReportModalPayload,
  attachmentRequired: boolean,
) {
  const errors: FormErrors = {};

  if (!payload.namaPelapor.trim()) {
    errors.namaPelapor = "Nama pelapor wajib diisi.";
  }

  if (!payload.namaRuangan.trim()) {
    errors.nomorRuangan = "Nama ruangan wajib diisi.";
  } else if (!payload.nomorRuangan.trim()) {
    errors.nomorRuangan =
      "Nama ruangan harus sesuai master data agar kode ruangan terisi otomatis.";
  }

  if (!payload.namaBarang.trim()) {
    errors.namaBarang = "Nama barang wajib diisi.";
  }

  if (!payload.kode.trim()) {
    errors.kode = "Kode barang wajib diisi.";
  } else if (!isValidItemCode(payload.kode)) {
    errors.kode =
      "Format kode harus x.xx.xx.xx.xxx.<NUP>, dengan NUP maksimal 3 digit.";
  } else if (!/^\d{1,3}$/.test(payload.nup)) {
    errors.kode = "NUP pada kode barang harus berisi 1 sampai 3 digit.";
  }

  if (!payload.subcategory.trim()) {
    errors.subcategory = "Subkategori wajib dipilih.";
  }

  if (!payload.deskripsi.trim()) {
    errors.deskripsi = "Deskripsi wajib diisi.";
  } else if (payload.deskripsi.trim().length > 2000) {
    errors.deskripsi = "Deskripsi maksimal 2000 karakter.";
  }

  if (attachmentRequired && payload.attachments.length === 0) {
    errors.attachments = "Lampiran wajib diunggah.";
  } else if (payload.attachments.length > MAX_ATTACHMENT_COUNT) {
    errors.attachments = `Lampiran maksimal ${MAX_ATTACHMENT_COUNT} file.`;
  }

  for (const attachment of payload.attachments) {
    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      errors.attachments = `${attachment.name}: Lampiran maksimal 2 MB.`;
      break;
    } else if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
      errors.attachments = `${attachment.name}: Lampiran harus berupa gambar atau PDF.`;
      break;
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
  defaultNamaRuangan = "",
  defaultKodeUakpb = "",
  defaultKode = "",
  defaultNup = "",
  defaultSubcategory = "",
  defaultNamaBarang = "",
  defaultRepairCost = "",
  defaultDeskripsi = "",
  defaultKategori = "FASILITAS_INVENTARIS",
  attachmentRequired = true,
  submitLabel = "Kirim Laporan",
}: UserReportModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const submittingRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [kategori, setKategori] = useState<UserReportCategory>(defaultKategori);
  const [namaPelapor, setNamaPelapor] = useState(defaultNamaPelapor);
  const [nomorRuangan, setNomorRuangan] = useState(defaultNomorRuangan);
  const [namaRuangan, setNamaRuangan] = useState(defaultNamaRuangan);
  const [kodeUakpb, setKodeUakpb] = useState(defaultKodeUakpb);
  const [kode, setKode] = useState(() =>
    normalizeStoredItemCode(defaultKode, defaultNup),
  );
  const [nup, setNup] = useState(() =>
    getNupFromItemCode(normalizeStoredItemCode(defaultKode, defaultNup)),
  );
  const [masterData, setMasterData] = useState<MasterDataState>({
    categories: CATEGORY_MASTER,
    rooms: ROOM_MASTER,
  });
  const [subcategory, setSubcategory] = useState(
    defaultSubcategory || "",
  );
  const [namaBarang, setNamaBarang] = useState(defaultNamaBarang || defaultKodeUakpb);
  const [repairCost, setRepairCost] = useState(defaultRepairCost);
  const [deskripsi, setDeskripsi] = useState(defaultDeskripsi);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setKategori(defaultKategori);
    setNamaPelapor(defaultNamaPelapor);
    setNomorRuangan(defaultNomorRuangan);
    setNamaRuangan(defaultNamaRuangan);
    setKodeUakpb(defaultKodeUakpb);
    const normalizedCode = normalizeStoredItemCode(defaultKode, defaultNup);
    setKode(normalizedCode);
    setNup(getNupFromItemCode(normalizedCode));
    setSubcategory(defaultSubcategory || "");
    setNamaBarang(defaultNamaBarang || defaultKodeUakpb);
    setRepairCost(defaultRepairCost);
    setDeskripsi(defaultDeskripsi);
  }, [
    defaultKategori,
    defaultKode,
    defaultKodeUakpb,
    defaultNamaBarang,
    defaultNamaRuangan,
    defaultNup,
    defaultRepairCost,
    defaultSubcategory,
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
    if (!open) return;

    let cancelled = false;

    async function loadMasterData() {
      try {
        const res = await fetch("/api/master-data", { cache: "no-store" });
        const data = await res.json();

        if (cancelled || !res.ok) return;

        setMasterData({
          categories: data.categories || CATEGORY_MASTER,
          rooms: data.rooms || ROOM_MASTER,
        });
      } catch (error) {
        console.error("LOAD_REPORT_MASTER_DATA_ERROR:", error);
      }
    }

    void loadMasterData();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const imageFiles = attachments.filter((attachment) =>
      attachment.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      setAttachmentPreviewUrls([]);
      return;
    }

    const nextPreviewUrls = imageFiles.map((attachment) =>
      URL.createObjectURL(attachment),
    );
    setAttachmentPreviewUrls(nextPreviewUrls);

    return () => {
      nextPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  const subcategoryOptions = getSubcategoriesForCategory(
    masterData.categories,
    kategori,
  );
  if (!open) {
    return null;
  }

  const payload: UserReportModalPayload = {
    kategori,
    namaPelapor,
    nomorRuangan,
    namaRuangan,
    kodeUakpb,
    kode,
    nup,
    subcategory,
    namaBarang,
    repairCost,
    deskripsi,
    attachments,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) return;

    setSubmitError("");

    const nextErrors = validateForm(payload, attachmentRequired);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      showError(
        "Data laporan belum lengkap",
        Object.values(nextErrors).filter(Boolean).join(" "),
      );
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);
      await onSubmit?.({
        ...payload,
        kategori: payload.kategori,
        namaPelapor: payload.namaPelapor.trim(),
        nomorRuangan: payload.nomorRuangan.trim(),
        namaRuangan: payload.namaRuangan.trim(),
        kodeUakpb: payload.namaBarang.trim(),
        kode: payload.kode.trim(),
        nup: payload.nup.trim(),
        subcategory: payload.subcategory.trim(),
        namaBarang: payload.namaBarang.trim(),
        repairCost: payload.repairCost.replace(/\D/g, ""),
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
      showError(
        "Gagal mengirim laporan",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengirim laporan.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      setAttachments([]);
      setErrors((current) => ({
        ...current,
        attachments: attachmentRequired
          ? "Lampiran wajib diunggah."
          : undefined,
      }));
      return;
    }

    const nextErrors = validateForm(
      { ...payload, attachments: files },
      attachmentRequired,
    );
    setErrors((current) => ({
      ...current,
      attachments: nextErrors.attachments,
    }));

    if (nextErrors.attachments) {
      event.target.value = "";
      showError("Lampiran tidak valid", nextErrors.attachments);
      return;
    }

    setAttachments(files);
    event.target.value = "";
  }

  function handleRoomNameChange(value: string) {
    setNamaRuangan(value);
    const normalized = value.trim().toLowerCase();
    const room = masterData.rooms.find(
      (item) => item.name.toLowerCase() === normalized,
    );
    setNomorRuangan(room?.code || "");
  }

  function handleCategoryChange(value: UserReportCategory) {
    setKategori(value);
    const nextSubcategories = getSubcategoriesForCategory(
      masterData.categories,
      value,
    );

    if (!nextSubcategories.some((item) => item.name === subcategory)) {
      setSubcategory("");
    }
  }

  function handleSubcategoryChange(value: string) {
    setSubcategory(value);
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
            <p id={descriptionId} className="mt-1 text-base text-slate-600">
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
              <div
                className="grid grid-cols-1 gap-3 md:grid-cols-3"
                role="group"
                aria-label="Jenis Perbaikan"
              >
                {masterData.categories.map((option) => {
                  const active = kategori === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleCategoryChange(option.value)}
                      className={[
                        "rounded-md border p-4 text-left transition",
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span className="block text-base font-bold">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-slate-500">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Nama Pelapor"
              controlId={`${fieldId}-reporter`}
              required
              error={errors.namaPelapor}
              className="md:col-span-2"
            >
              <input
                id={`${fieldId}-reporter`}
                value={namaPelapor}
                onChange={(event) => setNamaPelapor(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Masukkan nama pelapor"
                required
              />
            </Field>

            <Field
              label="Nama Ruangan"
              controlId={`${fieldId}-room-name`}
              required
              error={errors.nomorRuangan}
            >
              <input
                id={`${fieldId}-room-name`}
                value={namaRuangan}
                list="room-master-list"
                onChange={(event) => handleRoomNameChange(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Pilih atau ketik nama ruangan"
                required
              />
              <datalist id="room-master-list">
                {masterData.rooms.map((room) => (
                  <option key={room.code} value={room.name} />
                ))}
              </datalist>
            </Field>

            <Field
              label="Kode Ruangan"
              controlId={`${fieldId}-room-code`}
              required
              error={errors.nomorRuangan}
            >
              <input
                id={`${fieldId}-room-code`}
                value={nomorRuangan}
                readOnly
                className="h-12 w-full rounded-md border border-slate-300 bg-slate-100 px-4 text-slate-700 outline-none"
                placeholder="Terisi otomatis dari nama ruangan"
                required
              />
            </Field>

            <Field
              label="Nama Barang"
              controlId={`${fieldId}-item-name`}
              required
              error={errors.namaBarang}
            >
              <input
                id={`${fieldId}-item-name`}
                value={namaBarang}
                onChange={(event) => {
                  setNamaBarang(event.target.value);
                  setKodeUakpb(event.target.value);
                }}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Contoh: Laptop Lenovo, Printer Epson"
                required
              />
            </Field>

            <Field
              label="Subkategori"
              controlId={`${fieldId}-subcategory`}
              required
              error={errors.subcategory}
            >
              <select
                id={`${fieldId}-subcategory`}
                value={subcategory}
                onChange={(event) => handleSubcategoryChange(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="">Pilih subkategori</option>
                {subcategoryOptions.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Kode Barang"
              controlId={`${fieldId}-item-code`}
              required
              error={errors.kode}
              className="md:col-span-2"
            >
              <input
                id={`${fieldId}-item-code`}
                value={kode}
                onChange={(event) => {
                  const formattedCode = formatItemCodeInput(event.target.value);
                  setKode(formattedCode);
                  setNup(getNupFromItemCode(formattedCode));
                }}
                inputMode="numeric"
                maxLength={18}
                placeholder="Contoh: 1.23.45.67.890.123"
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
              <p className="mt-2 text-sm text-slate-500">
                Masukkan 10 digit kode dasar, lalu NUP maksimal 3 digit. Titik
                ditambahkan otomatis.
              </p>
            </Field>

            <Field
              label="Deskripsi"
              controlId={`${fieldId}-description`}
              required
              error={errors.deskripsi}
              className="md:col-span-2"
            >
              <textarea
                id={`${fieldId}-description`}
                value={deskripsi}
                onChange={(event) => setDeskripsi(event.target.value)}
                rows={5}
                maxLength={2000}
                className="w-full resize-y rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Jelaskan kendala atau kerusakan yang perlu diperbaiki"
                required
              />
              <p className="mt-2 text-sm text-slate-500">
                {deskripsi.trim().length}/2000 karakter
              </p>
            </Field>

            <Field
              label={attachmentRequired ? "Lampiran" : "Lampiran tambahan (opsional)"}
              controlId={`${fieldId}-attachments`}
              required={attachmentRequired}
              error={errors.attachments}
              className="md:col-span-2"
            >
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:bg-slate-100">
                <Upload className="mb-3 h-6 w-6 text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">
                  Unggah gambar atau PDF
                </span>
                <span className="mt-1 text-sm text-slate-500">
                  Maksimal 2 MB.
                </span>
                <input
                  id={`${fieldId}-attachments`}
                  ref={attachmentInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleAttachmentChange}
                  required={attachmentRequired}
                  className="sr-only"
                />
              </label>

              {attachments.length > 0 ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {attachments.length} lampiran dipilih
                    </p>
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Ganti Lampiran
                    </button>
                  </div>

                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={`${attachment.name}-${attachment.size}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-2"
                      >
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
                          onClick={() => {
                            const nextAttachments = attachments.filter(
                              (item) => item !== attachment,
                            );
                            setAttachments(nextAttachments);
                            setErrors((current) => ({
                              ...current,
                              attachments:
                                attachmentRequired && nextAttachments.length === 0
                                  ? "Lampiran wajib diunggah."
                                  : undefined,
                            }));
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                          aria-label="Hapus lampiran"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {attachmentPreviewUrls.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {attachmentPreviewUrls.map((url) => (
                        <Image
                          key={url}
                          src={url}
                          alt="Preview lampiran"
                          width={800}
                          height={500}
                          className="max-h-56 w-full rounded-md object-cover"
                          unoptimized
                        />
                      ))}
                    </div>
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
  controlId,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  controlId?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={controlId}
        className="mb-2 block text-base font-semibold text-slate-800"
      >
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {children}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

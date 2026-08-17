import {
  getNupFromItemCode,
  isValidItemCode,
  normalizeStoredItemCode,
} from "./item-code.ts";

export const VALID_KATEGORI = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
] as const;

export const VALID_SEVERITY = ["RINGAN", "SEDANG", "BERAT"] as const;

export const VALID_REPORT_STATUS = [
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
  "MENUNGGU_KONFIRMASI",
  "TELAH_BERFUNGSI",
  "TIDAK_DAPAT_DIGUNAKAN",
  "DITOLAK",
] as const;

export type ValidKategori = (typeof VALID_KATEGORI)[number];
export type ValidSeverity = (typeof VALID_SEVERITY)[number];
export type ValidReportStatus = (typeof VALID_REPORT_STATUS)[number];

export type ReportInput = {
  kategori: string;
  namaBarang: string;
  lokasi: string;
  deskripsi: string;
  severity: string;
};

export type ModalReportInput = {
  kategori: string;
  namaPelapor: string;
  nomorRuangan: string;
  namaRuangan: string;
  kodeUakpb: string;
  kode: string;
  nup: string;
  subcategory: string;
  itemType: string;
  namaBarang: string;
  repairCost: string;
  deskripsi: string;
};

function trimmedValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseReportFormData(formData: FormData): ReportInput {
  return {
    kategori: trimmedValue(formData.get("kategori")),
    namaBarang: trimmedValue(formData.get("namaBarang")),
    lokasi: trimmedValue(formData.get("lokasi")),
    deskripsi: trimmedValue(formData.get("deskripsi")),
    severity: trimmedValue(formData.get("severity")),
  };
}

export function parseModalReportFormData(formData: FormData): ModalReportInput {
  const subcategory = trimmedValue(formData.get("subcategory"));
  const kode = normalizeStoredItemCode(
    trimmedValue(formData.get("kode")),
    trimmedValue(formData.get("nup")),
  );

  return {
    kategori: trimmedValue(formData.get("kategori")),
    namaPelapor: trimmedValue(formData.get("namaPelapor")),
    nomorRuangan: trimmedValue(formData.get("nomorRuangan")),
    namaRuangan: trimmedValue(formData.get("namaRuangan")),
    kodeUakpb: trimmedValue(formData.get("kodeUakpb")),
    kode,
    nup: getNupFromItemCode(kode),
    subcategory,
    // Compatibility for existing reports and clients while the separate
    // "Tipe Barang" field is retired from the UI.
    itemType: trimmedValue(formData.get("itemType")) || subcategory,
    namaBarang: trimmedValue(formData.get("namaBarang")),
    repairCost: trimmedValue(formData.get("repairCost")),
    deskripsi: trimmedValue(formData.get("deskripsi")),
  };
}

export function validateModalReportInput(input: ModalReportInput) {
  if (
    !input.namaPelapor ||
    !input.kategori ||
    !input.namaRuangan ||
    !input.kodeUakpb ||
    !input.kode ||
    !input.nup ||
    !input.subcategory ||
    !input.namaBarang ||
    !input.deskripsi
  ) {
    return "Jenis perbaikan, nama pelapor, nama ruangan, nama barang, kode barang, NUP, hierarki barang, dan deskripsi wajib diisi.";
  }

  if (!VALID_KATEGORI.includes(input.kategori as ValidKategori)) {
    return "Jenis perbaikan tidak valid.";
  }

  if (input.namaPelapor.length > 120) {
    return "Nama pelapor maksimal 120 karakter.";
  }

  if (input.namaRuangan.length > 120 || input.nomorRuangan.length > 120) {
    return "Nama atau kode ruangan maksimal 120 karakter.";
  }

  if (input.kodeUakpb.length > 120) {
    return "Nama barang maksimal 120 karakter.";
  }

  if (input.namaBarang.length > 120 || input.subcategory.length > 120) {
    return "Nama barang atau subkategori maksimal 120 karakter.";
  }

  if (!/^\d{1,3}$/.test(input.nup)) {
    return "NUP wajib berupa 1 sampai 3 digit angka.";
  }

  if (!isValidItemCode(input.kode)) {
    return "Format kode barang harus x.xx.xx.xx.xxx.<NUP>.";
  }

  if (input.repairCost && !/^\d+$/.test(input.repairCost.replace(/\D/g, ""))) {
    return "Biaya perbaikan harus berupa angka Rupiah.";
  }

  if (input.deskripsi.length > 2000) {
    return "Deskripsi maksimal 2000 karakter.";
  }

  return null;
}

export function validateReportInput(input: ReportInput) {
  if (
    !input.kategori ||
    !input.namaBarang ||
    !input.lokasi ||
    !input.deskripsi ||
    !input.severity
  ) {
    return "Semua field wajib diisi.";
  }

  if (!VALID_KATEGORI.includes(input.kategori as ValidKategori)) {
    return "Kategori tidak valid.";
  }

  if (!VALID_SEVERITY.includes(input.severity as ValidSeverity)) {
    return "Tingkat kerusakan tidak valid.";
  }

  if (input.namaBarang.length > 120) {
    return "Nama barang maksimal 120 karakter.";
  }

  if (input.lokasi.length > 120) {
    return "Lokasi maksimal 120 karakter.";
  }

  if (input.deskripsi.length > 2000) {
    return "Deskripsi maksimal 2000 karakter.";
  }

  return null;
}

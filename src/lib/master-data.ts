import type { AppCategoryScope } from "@/src/lib/roles";

export type RoomMaster = {
  id?: number;
  code: string;
  name: string;
};

export type ItemTypeMaster = {
  id?: number;
  code: string;
  name: string;
};

export type SubcategoryMaster = {
  id?: number;
  code: string;
  name: string;
  itemTypes: ItemTypeMaster[];
};

export type CategoryMaster = {
  value: AppCategoryScope;
  code: "INF" | "IT" | "LAB";
  label: string;
  description: string;
  subcategories: SubcategoryMaster[];
};

export const ROOM_MASTER: RoomMaster[] = [
  { code: "R-001", name: "Ruang Kepala Balai" },
  { code: "R-002", name: "Ruang Tata Usaha" },
  { code: "R-003", name: "Ruang Rapat" },
  { code: "R-004", name: "Ruang Laboratorium" },
  { code: "R-005", name: "Ruang IT" },
  { code: "R-006", name: "Gudang Inventaris" },
];

export const CATEGORY_MASTER: CategoryMaster[] = [
  {
    value: "FASILITAS_INVENTARIS",
    code: "INF",
    label: "Fasilitas & Inventaris",
    description: "Meja, kursi, lemari, AC, dan fasilitas ruangan.",
    subcategories: [
      {
        code: "INVENTARIS",
        name: "Inventaris",
        itemTypes: [
          { code: "MEJA", name: "Meja" },
          { code: "KURSI", name: "Kursi" },
          { code: "LEMARI", name: "Lemari" },
        ],
      },
      {
        code: "ELEKTRONIK",
        name: "Elektronik",
        itemTypes: [
          { code: "AC", name: "AC" },
          { code: "PROYEKTOR", name: "Proyektor" },
        ],
      },
    ],
  },
  {
    value: "IT_ELEKTRONIK",
    code: "IT",
    label: "IT & Alat Elektronik",
    description: "Komputer, printer, proyektor, jaringan, dan elektronik.",
    subcategories: [
      {
        code: "KOMPUTER",
        name: "Komputer",
        itemTypes: [
          { code: "LAPTOP", name: "Laptop" },
          { code: "DESKTOP", name: "Desktop" },
        ],
      },
      {
        code: "PRINTER",
        name: "Printer",
        itemTypes: [
          { code: "PRINTER_EPSON", name: "Printer Epson" },
          { code: "PRINTER_CANON", name: "Printer Canon" },
        ],
      },
    ],
  },
  {
    value: "LABORATORIUM",
    code: "LAB",
    label: "Laboratorium",
    description: "Alat, perlengkapan, dan kebutuhan ruang laboratorium.",
    subcategories: [
      {
        code: "ALAT_LAB",
        name: "Alat Lab",
        itemTypes: [
          { code: "MIKROSKOP", name: "Mikroskop" },
          { code: "TIMBANGAN", name: "Timbangan Digital" },
        ],
      },
      {
        code: "PERLENGKAPAN",
        name: "Perlengkapan",
        itemTypes: [
          { code: "GELAS_UKUR", name: "Gelas Ukur" },
          { code: "PIPET", name: "Pipet" },
        ],
      },
    ],
  },
];

export const MESSAGE_TEMPLATE_MASTER = [
  {
    type: "APPROVAL",
    name: "Persetujuan",
    description: "Laporan diterima dan dapat dilanjutkan ke tahap berikutnya.",
  },
  {
    type: "REJECTION",
    name: "Penolakan",
    description: "Laporan ditolak karena data atau kondisi belum memenuhi persyaratan.",
  },
  {
    type: "NOTES",
    name: "Catatan",
    description: "Mohon lengkapi informasi tambahan agar proses dapat dilanjutkan.",
  },
  {
    type: "COMPLETION",
    name: "Penyelesaian",
    description: "Perbaikan telah selesai dilakukan. Mohon pelapor melakukan konfirmasi penerimaan barang.",
  },
] as const;

export function findRoomByName(roomName: string) {
  const normalized = roomName.trim().toLowerCase();

  return ROOM_MASTER.find((room) => room.name.toLowerCase() === normalized);
}

export function getRoomCodeByName(roomName: string) {
  return findRoomByName(roomName)?.code || "";
}

export function getCategoryTicketCode(category: AppCategoryScope) {
  return CATEGORY_MASTER.find((item) => item.value === category)?.code || "INF";
}

export function getCategoryMaster(category: AppCategoryScope) {
  return CATEGORY_MASTER.find((item) => item.value === category) || CATEGORY_MASTER[0];
}

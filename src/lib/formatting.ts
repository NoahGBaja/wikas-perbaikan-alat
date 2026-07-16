export function parseRupiahInput(value: string | null | undefined) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");

  if (!digits) return null;

  return Number(digits);
}

export function formatRupiah(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

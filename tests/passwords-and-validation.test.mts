import test from "node:test";
import assert from "node:assert/strict";
import { validatePasswordStrength } from "../src/lib/passwords.ts";
import {
  parseModalReportFormData,
  validateModalReportInput,
  validateReportInput,
} from "../src/lib/report-validation.ts";

test("validatePasswordStrength accepts a strong password", () => {
  assert.deepEqual(validatePasswordStrength("Password123!"), []);
});

test("validatePasswordStrength rejects short or incomplete passwords", () => {
  assert.match(validatePasswordStrength("P1!")[0], /minimal 8/);
  assert.match(validatePasswordStrength("Password!")[0], /angka/);
  assert.match(validatePasswordStrength("Password123")[0], /simbol/);
});

test("validateReportInput accepts valid report data", () => {
  assert.equal(
    validateReportInput({
      kategori: "IT_ELEKTRONIK",
      namaBarang: "Laptop",
      lokasi: "Ruang Admin",
      deskripsi: "Layar berkedip saat digunakan.",
      severity: "SEDANG",
    }),
    null
  );
});

test("validateReportInput rejects invalid category and long fields", () => {
  assert.match(
    validateReportInput({
      kategori: "LAINNYA",
      namaBarang: "Laptop",
      lokasi: "Ruang Admin",
      deskripsi: "Layar berkedip saat digunakan.",
      severity: "SEDANG",
    }) || "",
    /Kategori tidak valid/
  );

  assert.match(
    validateReportInput({
      kategori: "IT_ELEKTRONIK",
      namaBarang: "x".repeat(121),
      lokasi: "Ruang Admin",
      deskripsi: "Layar berkedip saat digunakan.",
      severity: "SEDANG",
    }) || "",
    /Nama barang maksimal/
  );
});

test("modal report uses subcategory when the retired item type field is absent", () => {
  const form = new FormData();
  form.set("kategori", "IT_ELEKTRONIK");
  form.set("namaPelapor", "Pengguna");
  form.set("nomorRuangan", "R-005");
  form.set("namaRuangan", "Ruang IT");
  form.set("kodeUakpb", "Komputer");
  form.set("kode", "123456789012");
  form.set("nup", "1");
  form.set("subcategory", "Komputer");
  form.set("namaBarang", "Komputer");
  form.set("deskripsi", "Komputer tidak dapat menyala.");

  const input = parseModalReportFormData(form);

  assert.equal(input.subcategory, "Komputer");
  assert.equal(input.itemType, "Komputer");
  assert.equal(validateModalReportInput(input), null);
});

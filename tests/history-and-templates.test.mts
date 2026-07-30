import test from "node:test";
import assert from "node:assert/strict";
import {
  getUniqueSubcategories,
  MESSAGE_TEMPLATE_MASTER,
} from "../src/lib/master-data.ts";
import {
  IN_PROGRESS_STATUS_FILTER,
  isInProgressStatus,
} from "../src/lib/report-status-filters.ts";

test("built-in response templates expose name and description pairs", () => {
  assert.ok(MESSAGE_TEMPLATE_MASTER.length > 0);

  for (const template of MESSAGE_TEMPLATE_MASTER) {
    assert.equal(typeof template.name, "string");
    assert.ok(template.name.trim().length > 0);
    assert.equal(typeof template.description, "string");
    assert.ok(template.description.trim().length > 0);
    assert.equal("title" in template, false);
    assert.equal("body" in template, false);
  }
});

test("Dalam Proses includes waiting workflow states but excludes terminal states", () => {
  assert.equal(IN_PROGRESS_STATUS_FILTER, "DALAM_PROSES");

  for (const status of [
    "MENUNGGU_ADMIN_1",
    "MENUNGGU_ADMIN_2",
    "MENUNGGU_ADMIN_3",
    "MENUNGGU_ADMIN_4",
    "MENUNGGU_ADMIN_5",
    "MENUNGGU_KONFIRMASI",
  ]) {
    assert.equal(isInProgressStatus(status), true, status);
  }

  for (const status of [
    "DISETUJUI_FINAL",
    "TELAH_BERFUNGSI",
    "TIDAK_DAPAT_DIGUNAKAN",
    "DITOLAK",
    "",
    "MENUNGGU_ADMINISTRASI",
  ]) {
    assert.equal(isInProgressStatus(status), false, status);
  }
});

test("report subcategory options include names from every category", () => {
  const options = getUniqueSubcategories([
    {
      value: "FASILITAS_INVENTARIS",
      code: "INF",
      label: "Inventaris",
      description: "",
      subcategories: [
        { code: "INVENTARIS", name: "Inventaris", itemTypes: [] },
      ],
    },
    {
      value: "IT_ELEKTRONIK",
      code: "IT",
      label: "IT",
      description: "",
      subcategories: [
        { code: "KOMPUTER", name: "Komputer", itemTypes: [] },
        { code: "PRINTER", name: "Printer", itemTypes: [] },
      ],
    },
  ]);

  assert.deepEqual(
    options.map((option) => option.name),
    ["Inventaris", "Komputer", "Printer"],
  );
});

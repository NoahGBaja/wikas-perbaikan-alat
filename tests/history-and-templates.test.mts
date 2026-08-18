import test from "node:test";
import assert from "node:assert/strict";
import {
  getSubcategoriesForCategory,
  MESSAGE_TEMPLATE_MASTER,
  type CategoryMaster,
} from "../src/lib/master-data.ts";
import {
  IN_PROGRESS_STATUS_FILTER,
  isInProgressStatus,
} from "../src/lib/report-status-filters.ts";
import {
  canRoleUseWorkflowAction,
  getWorkflowActionPresentation,
  isWorkflowDescriptionRequired,
} from "../src/lib/roles.ts";
import {
  formatAttachmentFileSize,
  formatAttachmentPurpose,
} from "../src/lib/report-attachment-urls.ts";

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

test("attachment details format purpose and file size clearly", () => {
  assert.equal(formatAttachmentPurpose("DAMAGE_EVIDENCE"), "Bukti kerusakan");
  assert.equal(formatAttachmentPurpose("COMPLETION_PROOF"), "Bukti penyelesaian");
  assert.equal(formatAttachmentPurpose(null), "Lampiran lama");
  assert.equal(formatAttachmentFileSize(512), "512 B");
  assert.equal(formatAttachmentFileSize(1536), "1.5 KB");
  assert.equal(formatAttachmentFileSize(2 * 1024 * 1024), "2.00 MB");
  assert.equal(formatAttachmentFileSize(0), "Tidak tersedia");
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

test("report subcategory options only include the selected category", () => {
  const categories: CategoryMaster[] = [
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
  ];

  const options = getSubcategoriesForCategory(
    categories,
    "IT_ELEKTRONIK",
  );

  assert.deepEqual(
    options.map((option) => option.name),
    ["Komputer", "Printer"],
  );
});

test("each workflow role has a clear next-step label and distinct color", () => {
  const expectedLabels = {
    ADMIN_1: "Kirim ke K.TU",
    ADMIN_2: "Setujui & Kirim ke BMN",
    ADMIN_3: "Verifikasi & Kirim ke PPK",
    ADMIN_4: "Setujui & Kirim ke PP",
  } as const;
  const presentations = Object.entries(expectedLabels).map(
    ([role, expectedLabel]) => {
      const presentation = getWorkflowActionPresentation(
        role as keyof typeof expectedLabels,
      );

      assert.equal(presentation.approveLabel, expectedLabel);
      assert.equal(presentation.rejectLabel, "Tolak & Hentikan Proses");
      return presentation;
    },
  );

  assert.equal(
    new Set(presentations.map((item) => item.approveClassName)).size,
    presentations.length,
  );
  assert.match(
    getWorkflowActionPresentation("ADMIN_1").completeLabel || "",
    /Konfirmasi/,
  );
  assert.match(
    getWorkflowActionPresentation("ADMIN_5").completeLabel || "",
    /Bukti.*Konfirmasi/,
  );
});

test("PJ and PP expose only the intended workflow actions", () => {
  assert.equal(canRoleUseWorkflowAction("ADMIN_1", "ACC"), true);
  assert.equal(canRoleUseWorkflowAction("ADMIN_1", "SELESAI"), true);
  assert.equal(canRoleUseWorkflowAction("ADMIN_1", "TOLAK"), true);

  assert.equal(canRoleUseWorkflowAction("ADMIN_5", "ACC"), false);
  assert.equal(canRoleUseWorkflowAction("ADMIN_5", "SELESAI"), true);
  assert.equal(canRoleUseWorkflowAction("ADMIN_5", "TOLAK"), true);
});

test("empty-description confirmation only applies to optional decisions", () => {
  assert.equal(isWorkflowDescriptionRequired("ADMIN_1", "ACC"), true);
  assert.equal(isWorkflowDescriptionRequired("ADMIN_2", "ACC"), false);
  assert.equal(isWorkflowDescriptionRequired("ADMIN_3", "ACC"), false);
  assert.equal(isWorkflowDescriptionRequired("ADMIN_4", "ACC"), false);
  assert.equal(isWorkflowDescriptionRequired("ADMIN_5", "ACC"), false);

  for (const role of ["ADMIN_1", "ADMIN_2", "ADMIN_3", "ADMIN_4", "ADMIN_5"] as const) {
    assert.equal(isWorkflowDescriptionRequired(role, "TOLAK"), true);
    assert.equal(isWorkflowDescriptionRequired(role, "SELESAI"), true);
  }
});

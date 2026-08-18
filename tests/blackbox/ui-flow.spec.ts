import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixture = JSON.parse(
  await readFile(path.join(process.cwd(), ".data", "blackbox", "fixtures.json"), "utf8"),
);

async function login(page: Page, accountKey: string) {
  await page.goto("/login");
  await page.locator('input[name="nip"]').fill(fixture.accounts[accountKey].nip);
  await page.locator('input[name="password"]').fill(fixture.password);
  await page.getByRole("button", { name: /^masuk$/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

function observeBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  });
  return failures;
}

test.describe.configure({ mode: "serial" });

test("role landing pages render without browser or server errors", async ({ page }) => {
  const failures = observeBrowserFailures(page);
  const cases = [
    ["userUi", /\/dashboard\/user$/],
    ["adminIt", /\/dashboard\/admin$/],
    ["superAdmin", /\/dashboard\/admin$/],
    ["executive", /\/dashboard\/admin\/statistik$/],
  ] as const;

  for (const [account, expectedUrl] of cases) {
    await page.context().clearCookies();
    await login(page, account);
    await expect(page).toHaveURL(expectedUrl);
    await expect(page.getByRole("heading").first()).toBeVisible();
  }

  expect(failures).toEqual([]);
});

test("user can submit a report and item code keeps NUP at three digits", async ({
  page,
}, testInfo) => {
  const failures = observeBrowserFailures(page);
  await login(page, "userUi");
  await page.locator("a:visible", { hasText: /^Buat Laporan$/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/user\/report$/);

  const subcategory = page.getByLabel("Subkategori");
  await expect(subcategory.locator("option", { hasText: "Komputer" })).toHaveCount(0);
  await page.getByRole("button", { name: /IT & Alat Elektronik/i }).click();
  await expect(subcategory.locator("option", { hasText: "Komputer" })).toHaveCount(1);
  await page.getByLabel("Nama Ruangan").fill("Ruang IT");
  await page
    .getByLabel("Nama Barang")
    .fill(`Blackbox Laptop ${testInfo.project.name}`);
  await subcategory.selectOption({ label: "Komputer" });

  const itemCode = page.getByLabel("Kode Barang");
  await itemCode.fill("12345678901234567890");
  await expect(itemCode).toHaveValue("1.23.45.67.890.123");
  await page
    .getByLabel("Deskripsi")
    .fill("Black-box UI report; layar berkedip saat digunakan.");
  await page.locator('input[type="file"]').setInputFiles({
    name: "blackbox-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator('input[type="file"]')).toHaveCount(1);

  const reportResponses: number[] = [];
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/reports"
    ) {
      reportResponses.push(response.status());
    }
  });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/reports",
  );
  await page.getByRole("button", { name: /kirim laporan/i }).dblclick();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/dashboard\/user\/status/);
  await expect(page.getByText(/Blackbox Laptop/i).first()).toBeVisible();
  expect(reportResponses).toHaveLength(1);
  expect(failures).toEqual([]);
});

test("optional admin description asks for confirmation before continuing", async ({
  page,
}, testInfo) => {
  const failures = observeBrowserFailures(page);
  const itemName = `Optional note ${fixture.runId}-${testInfo.project.name}`;

  await login(page, "userUi");
  await page.goto("/dashboard/user/report");
  await page.getByRole("button", { name: /IT & Alat Elektronik/i }).click();
  await page.getByLabel("Nama Ruangan").fill("Ruang IT");
  await page.getByLabel("Nama Barang").fill(itemName);
  await page.getByLabel("Subkategori").selectOption({ label: "Komputer" });
  await page.getByLabel("Kode Barang").fill("1234567890123");
  await page.getByLabel("Deskripsi").fill("Uji konfirmasi catatan admin opsional.");
  await page.locator('input[type="file"]').setInputFiles({
    name: "optional-note-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: /kirim laporan/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/user\/status/);

  await page.context().clearCookies();
  await login(page, "adminIt");
  const pjRow = page.getByRole("row").filter({ hasText: itemName });
  await pjRow.getByRole("button", { name: "Detail" }).click();
  await page.locator("textarea").fill("Data sudah diperiksa oleh PJ.");
  const pjDecision = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/reports\/\d+\/decide$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Kirim ke K.TU" }).click();
  expect((await pjDecision).status()).toBe(200);

  await page.context().clearCookies();
  await login(page, "admin2");
  const ktuRow = page.getByRole("row").filter({ hasText: itemName });
  await ktuRow.getByRole("button", { name: "Detail" }).click();
  await expect(page.locator("textarea")).toHaveValue("");
  await page
    .getByRole("button", { name: "Setujui & Kirim ke BMN" })
    .click();

  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Lanjut tanpa deskripsi?");
  await expect(confirmation).toContainText(/opsional bagi K\.TU/i);
  await confirmation
    .getByRole("button", { name: "Kembali Isi Deskripsi" })
    .click();
  await expect(confirmation).toHaveCount(0);

  await page
    .getByRole("button", { name: "Setujui & Kirim ke BMN" })
    .click();
  await expect(confirmation).toBeVisible();
  const ktuDecision = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/reports\/\d+\/decide$/.test(new URL(response.url()).pathname),
  );
  await confirmation
    .getByRole("button", { name: "Ya, Lanjut Tanpa Deskripsi" })
    .click();
  expect((await ktuDecision).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Detail Laporan" }),
  ).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("PJ and PP follow the intended completion flow", async ({ page }, testInfo) => {
  const failures = observeBrowserFailures(page);
  const itemName = `PJ PP flow ${fixture.runId}-${testInfo.project.name}-${Date.now().toString(36)}`;

  await login(page, "userUi");
  await page.goto("/dashboard/user/report");
  await page.getByRole("button", { name: /IT & Alat Elektronik/i }).click();
  await page.getByLabel("Nama Ruangan").fill("Ruang IT");
  await page.getByLabel("Nama Barang").fill(itemName);
  await page.getByLabel("Subkategori").selectOption({ label: "Komputer" });
  await page.getByLabel("Kode Barang").fill("1234567890123");
  await page.getByLabel("Deskripsi").fill("Uji alur penyelesaian PJ dan PP.");
  await page.locator('input[type="file"]').setInputFiles({
    name: "initial-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: /kirim laporan/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/user\/status/);

  await page.context().clearCookies();
  await login(page, "adminIt");
  await page.getByRole("row").filter({ hasText: itemName }).getByRole("button", { name: "Detail" }).click();
  await expect(page.getByRole("button", { name: "Kirim ke K.TU" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selesaikan & Minta Konfirmasi Pelapor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tolak & Hentikan Proses" })).toBeVisible();
  await page.locator("textarea").fill("PJ meneruskan laporan untuk proses berjenjang.");
  const pjDecisionPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/reports\/\d+\/decide$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Kirim ke K.TU" }).click();
  const pjDecision = await pjDecisionPromise;
  expect(pjDecision.status()).toBe(200);
  const reportId = new URL(pjDecision.url()).pathname.split("/")[3];

  for (const [account, actionLabel] of [
    ["admin2", "Setujui & Kirim ke BMN"],
    ["admin3", "Verifikasi & Kirim ke PPK"],
    ["admin4It", "Setujui & Kirim ke PP"],
  ] as const) {
    await page.context().clearCookies();
    await login(page, account);
    await page.getByRole("row").filter({ hasText: itemName }).getByRole("button", { name: "Detail" }).click();
    await page.locator("textarea").fill(`Diteruskan oleh ${account}.`);
    const decisionPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/reports\/\d+\/decide$/.test(new URL(response.url()).pathname),
    );
    await page.getByRole("button", { name: actionLabel }).click();
    expect((await decisionPromise).status()).toBe(200);
  }

  await page.context().clearCookies();
  await login(page, "admin5");
  await page.getByRole("row").filter({ hasText: itemName }).getByRole("button", { name: "Detail" }).click();
  await expect(page.getByRole("button", { name: "Kirim Bukti & Minta Konfirmasi Pelapor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tolak & Hentikan Proses" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Setujui.*Konfirmasi Pelapor/i })).toHaveCount(0);

  const forbiddenApproval = await page.request.post(
    `/api/reports/${reportId}/decide`,
    {
      headers: { Origin: new URL(page.url()).origin },
      data: {
        action: "ACC",
        note: "Aksi PP yang seharusnya tidak tersedia.",
        repairCost: "150000",
      },
    },
  );
  expect(forbiddenApproval.status()).toBe(403);
  expect((await forbiddenApproval.json()).message).toMatch(/tidak tersedia untuk PP/i);

  await page.locator("textarea").fill("Perbaikan selesai dan barang siap diuji pelapor.");
  await page.getByLabel(/Anggaran PP/i).fill("150000");
  await page.locator('input[type="file"]').setInputFiles({
    name: "completion-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const completionPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/reports\/\d+\/decide$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Kirim Bukti & Minta Konfirmasi Pelapor" }).click();
  expect((await completionPromise).status()).toBe(200);

  await page.context().clearCookies();
  await login(page, "userUi");
  // Pergantian sesi role dapat membatalkan polling notifikasi akun sebelumnya
  // dengan 401 yang memang diharapkan; mulai observasi bersih untuk alur user.
  failures.length = 0;
  await page.goto("/dashboard/user/status");
  const reportCard = page.locator("article").filter({ hasText: itemName });
  await expect(reportCard.getByText("Konfirmasi Penerimaan Barang")).toBeVisible();
  await expect(reportCard.getByText("Bukti penyelesaian", { exact: true }).first()).toBeVisible();
  await expect(reportCard.getByText("Diunggah oleh", { exact: true }).first()).toBeVisible();
  await expect(reportCard.getByText("Peran", { exact: true }).first()).toBeVisible();
  await expect(reportCard.getByText("PP", { exact: true }).first()).toBeVisible();

  await reportCard.locator('input[type="checkbox"]').check();
  await reportCard.locator("select").selectOption("TIDAK_DAPAT_DIGUNAKAN");
  await reportCard
    .locator("textarea")
    .fill("Barang masih gagal menyala setelah penyelesaian pertama.");
  const confirmationPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/reports\/\d+\/confirm$/.test(new URL(response.url()).pathname),
  );
  await reportCard.getByRole("button", { name: "Kirim Konfirmasi" }).click();
  const confirmationResponse = await confirmationPromise;
  expect(confirmationResponse.status()).toBe(200);

  await expect(reportCard.getByRole("link", { name: "Kirim Ulang Request" })).toBeVisible();
  await reportCard.getByRole("link", { name: "Kirim Ulang Request" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/user/report\\?repeat=${reportId}$`));
  await expect(page.getByRole("heading", { name: "Kirim Ulang Laporan Perbaikan" })).toBeVisible();
  await expect(page.getByLabel("Nama Ruangan")).toHaveValue("Ruang IT");
  await expect(page.getByLabel("Nama Barang")).toHaveValue(itemName);
  await expect(page.getByLabel("Subkategori")).toHaveValue("Komputer");
  await expect(page.getByLabel("Kode Barang")).toHaveValue("1.23.45.67.890.123");
  await expect(page.getByLabel("Deskripsi")).toHaveValue(
    "Uji alur penyelesaian PJ dan PP.",
  );
  await expect(page.locator('input[type="file"]')).toHaveValue("");

  await page.locator('input[type="file"]').setInputFiles({
    name: "resubmission-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const resubmissionPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/reports",
  );
  await page.getByRole("button", { name: "Kirim Ulang Request" }).click();
  const resubmissionResponse = await resubmissionPromise;
  expect(resubmissionResponse.status()).toBe(200);
  expect((await resubmissionResponse.json()).report.resubmittedFromId).toBe(
    Number(reportId),
  );
  await expect(page).toHaveURL(/\/dashboard\/user\/status/);
  expect(failures).toEqual([]);
});

test("super admin user and master-data screens load successfully", async ({ page }) => {
  const failures = observeBrowserFailures(page);
  await login(page, "superAdmin");
  await page.getByRole("button", { name: /kelola pengguna/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/users$/);
  await expect(page.getByRole("heading", { name: /kelola pengguna/i })).toBeVisible();
  await page
    .getByPlaceholder(/cari nama, nip, atau peran minimal 3 karakter/i)
    .fill(fixture.accounts.userUi.nip);
  await expect(page.getByText(fixture.accounts.userUi.nip).first()).toBeVisible();

  await page
    .getByPlaceholder(/cari nama, nip, atau peran minimal 3 karakter/i)
    .fill("");
  const loadMore = page.getByRole("button", {
    name: /Tampilkan \d+ pengguna lagi/i,
  });
  await expect(loadMore).toBeVisible();
  await loadMore.dblclick();
  const countSummary = page.getByText(/\d+ dari \d+ pengguna ditampilkan/i);
  await expect(countSummary).toBeVisible();
  const counts = (await countSummary.innerText()).match(/(\d+) dari (\d+)/);
  expect(Number(counts?.[1])).toBeLessThanOrEqual(Number(counts?.[2]));

  await page.goto("/dashboard/admin");
  await page.getByRole("button", { name: /master data/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/master-data$/);
  await expect(page.getByText(/template/i).first()).toBeVisible();
  expect(failures).toEqual([]);
});

test("master data entries can be edited through an impact confirmation", async ({
  page,
}, testInfo) => {
  const failures = observeBrowserFailures(page);
  const suffix = `${fixture.runId}-${testInfo.project.name}-${Date.now().toString(36)}`;
  const roomName = `UI Room ${suffix}`;
  const editedRoomName = `UI Edited Room ${suffix}`;
  const subcategoryName = `UI Subcategory ${suffix}`;
  const editedSubcategoryName = `UI Edited Subcategory ${suffix}`;
  const templateName = `UI Template ${suffix}`;
  const editedTemplateName = `UI Edited Template ${suffix}`;

  await login(page, "superAdmin");
  await page.goto("/dashboard/admin/master-data");

  await page.getByRole("button", { name: /Tambah Ruangan/i }).click();
  await page.getByRole("dialog", { name: /Tambah Ruangan/i }).getByLabel("Nama Ruangan").fill(roomName);
  await page.getByRole("dialog", { name: /Tambah Ruangan/i }).getByLabel("Kode Ruangan").fill(`UI-${suffix}`);
  await page.getByRole("dialog", { name: /Tambah Ruangan/i }).getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(roomName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Edit ${roomName}` }).click();
  await page.getByRole("dialog", { name: /Edit Ruangan/i }).getByLabel("Nama Ruangan").fill(editedRoomName);
  await page.getByRole("dialog", { name: /Edit Ruangan/i }).getByLabel("Kode Ruangan").fill(`UI2-${suffix}`);
  await page.getByRole("dialog", { name: /Edit Ruangan/i }).getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/laporan.*aktif.*riwayat/i);
  await page.getByRole("alertdialog").getByRole("button", { name: /Edit & Sinkronkan/i }).click();
  await expect(page.getByText(editedRoomName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Subkategori", exact: true }).click();
  await page.getByRole("button", { name: /Tambah Subkategori/i }).click();
  await page
    .getByRole("dialog", { name: /Tambah Subkategori/i })
    .getByLabel("Kategori", { exact: true })
    .selectOption("IT_ELEKTRONIK");
  await page.getByRole("dialog", { name: /Tambah Subkategori/i }).getByLabel("Nama Subkategori").fill(subcategoryName);
  await page.getByRole("dialog", { name: /Tambah Subkategori/i }).getByRole("button", { name: "Simpan" }).click();
  await page.getByRole("button", { name: `Edit ${subcategoryName}` }).click();
  await page.getByRole("dialog", { name: /Edit Subkategori/i }).getByLabel("Nama Subkategori").fill(editedSubcategoryName);
  await page.getByRole("dialog", { name: /Edit Subkategori/i }).getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/laporan.*aktif.*riwayat/i);
  await page.getByRole("alertdialog").getByRole("button", { name: /Edit & Sinkronkan/i }).click();
  await expect(page.getByText(editedSubcategoryName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Template Pesan", exact: true }).click();
  await page.getByRole("button", { name: /Tambah Template/i }).click();
  const addTemplate = page.getByRole("dialog", { name: /Tambah Template Pesan/i });
  await addTemplate.getByLabel("Jenis").selectOption("CUSTOM");
  await addTemplate.getByLabel("Jenis Custom").fill(`UI_TYPE_${suffix}`);
  await addTemplate.getByLabel("Nama").fill(templateName);
  await addTemplate.getByLabel("Deskripsi").fill(`UI description ${suffix}`);
  await addTemplate.getByRole("button", { name: "Simpan" }).click();
  await page.getByRole("button", { name: `Edit ${templateName}` }).click();
  const editTemplate = page.getByRole("dialog", { name: /Edit Template Pesan/i });
  await editTemplate.getByLabel("Nama").fill(editedTemplateName);
  await editTemplate.getByLabel("Deskripsi").fill(`UI edited description ${suffix}`);
  await editTemplate.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/pemakaian berikutnya/i);
  await page.getByRole("alertdialog").getByRole("button", { name: /Simpan Perubahan/i }).click();
  await expect(page.getByText(editedTemplateName, { exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Hapus ${editedTemplateName}` }).click();
  await expect(
    page.getByRole("button", { name: `Hapus ${editedTemplateName}` }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Subkategori", exact: true }).click();
  await page.getByRole("button", { name: `Hapus ${editedSubcategoryName}` }).click();
  await expect(
    page.getByRole("button", { name: `Hapus ${editedSubcategoryName}` }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ruangan", exact: true }).click();
  await page.getByRole("button", { name: `Hapus ${editedRoomName}` }).click();
  await expect(
    page.getByRole("button", { name: `Hapus ${editedRoomName}` }),
  ).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("hard back navigation escapes a deliberately stalled status request", async ({ page }) => {
  await login(page, "userUi");
  await page.route("**/api/reports?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.abort("timedout");
  });

  await page.locator("a:visible", { hasText: /^Status$/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/user\/status/);
  await page.getByRole("button", { name: /kembali/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/user$/, { timeout: 3_000 });
});

test("rendered pages do not overflow the active viewport", async ({ page }) => {
  await login(page, "userUi");
  for (const route of ["/dashboard/user", "/dashboard/user/report", "/dashboard/user/status"]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  }
});

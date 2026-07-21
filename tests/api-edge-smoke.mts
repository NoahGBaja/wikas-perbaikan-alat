import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/passwords.ts";

const baseUrl =
  process.env.E2E_BASE_URL || process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const password = "EdgeSmoke123!";
const runId = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

const createdUserIds: number[] = [];
const createdReportIds: number[] = [];

type LoginResult = {
  cookie: string;
  body: {
    redirectTo?: string;
    user?: {
      id: number;
      role: string;
      nip: string | null;
    };
  };
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur.");
  }

  const parsed = new URL(connectionString);
  const database = parsed.pathname.replace(/^\//, "");
  const host =
    parsed.hostname === "localhost" || parsed.hostname === "::1"
      ? "127.0.0.1"
      : parsed.hostname;

  return new PrismaClient({
    adapter: new PrismaMariaDb(
      {
        host,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username || ""),
        password: decodeURIComponent(parsed.password || ""),
        database,
        connectionLimit: 4,
        acquireTimeout: 10_000,
        connectTimeout: 10_000,
      },
      { database },
    ),
  });
}

const prisma = createPrismaClient();

function logStep(message: string) {
  console.log(`[ok] ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getContentLength(body: string) {
  return String(Buffer.byteLength(body));
}

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    expectedStatus?: number;
    origin?: string | null;
    contentType?: string;
  } = {},
) {
  const body =
    options.body === undefined
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  const headers: Record<string, string> = {};

  if (options.origin !== null) {
    headers.Origin = options.origin || origin;
  }

  if (body !== undefined) {
    headers["Content-Type"] = options.contentType || "application/json";
    headers["Content-Length"] = getContentLength(body);
  }

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body,
  });
  const data = await readJsonResponse(res);
  const expectedStatus = options.expectedStatus ?? 200;

  assert(
    res.status === expectedStatus,
    `${options.method || "GET"} ${path} expected ${expectedStatus}, got ${
      res.status
    }: ${JSON.stringify(data)}`,
  );

  return { res, data };
}

async function requestForm(
  path: string,
  form: FormData,
  options: {
    method?: string;
    cookie?: string;
    expectedStatus?: number;
  } = {},
) {
  const headers: Record<string, string> = {
    Origin: origin,
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || "POST",
    headers,
    body: form,
  });
  const data = await readJsonResponse(res);
  const expectedStatus = options.expectedStatus ?? 200;

  assert(
    res.status === expectedStatus,
    `${options.method || "POST"} ${path} expected ${expectedStatus}, got ${
      res.status
    }: ${JSON.stringify(data)}`,
  );

  return { res, data };
}

async function requestDownload(
  path: string,
  options: {
    cookie?: string;
    expectedStatus?: number;
  } = {},
) {
  const headers: Record<string, string> = {
    Origin: origin,
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    headers,
  });
  const expectedStatus = options.expectedStatus ?? 200;

  assert(
    res.status === expectedStatus,
    `GET ${path} expected ${expectedStatus}, got ${res.status}.`,
  );

  return res;
}

async function login(nip: string): Promise<LoginResult> {
  const { res, data } = await request("/api/login", {
    method: "POST",
    body: { nip, password },
  });
  const setCookie = res.headers.get("set-cookie");

  assert(setCookie, `Login for ${nip} did not return auth cookie.`);

  return {
    cookie: setCookie.split(";")[0],
    body: data,
  };
}

async function submitNativeLoginForm(nip: string, expectedRedirect: string) {
  const body = new URLSearchParams({ nip, password }).toString();
  const res = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": getContentLength(body),
    },
    body,
    redirect: "manual",
  });

  assert(res.status === 303, `Native login form expected 303, got ${res.status}.`);

  const location = res.headers.get("location") || "";

  assert(
    location.endsWith(expectedRedirect),
    `Native login form redirect expected ${expectedRedirect}, got ${location}.`,
  );
  assert(
    !location.includes("nip=") && !location.includes("password="),
    `Native login form leaked credentials in redirect URL: ${location}`,
  );
  assert(
    res.headers.get("set-cookie")?.startsWith("auth_token="),
    "Native login form did not set auth cookie.",
  );
}

function validReportForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData();

  form.set("kategori", "IT_ELEKTRONIK");
  form.set("namaPelapor", `Edge User ${runId}`);
  form.set("nomorRuangan", "R-EDGE");
  form.set("namaRuangan", "Ruang Edge");
  form.set("kodeUakpb", `Laptop Edge ${runId.slice(0, 6)}`);
  form.set("kode", "123456789012");
  form.set("nup", `NUP-${runId.slice(0, 6)}`);
  form.set("subcategory", "Komputer");
  form.set("itemType", "Laptop");
  form.set("namaBarang", `Laptop Edge ${runId.slice(0, 6)}`);
  form.set("repairCost", "");
  form.set("deskripsi", `Edge smoke report ${runId}`);

  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }

  return form;
}

async function createReport(cookie: string) {
  const form = validReportForm();
  form.append(
    "attachments",
    new Blob(["%PDF-1.4\nedge-report\n"], { type: "application/pdf" }),
    `report-${runId}.pdf`,
  );

  const { data } = await requestForm("/api/reports", form, {
    cookie,
  });

  assert(data?.report?.id, "Create report response did not include report.id.");
  createdReportIds.push(data.report.id);

  return data.report as { id: number; status: string };
}

async function setupUsers() {
  const passwordHash = await hashPassword(password);
  const users = await Promise.all([
    prisma.user.create({
      data: {
        nama: `Edge User ${runId}`,
        jabatan: "QA",
        nip: `EDGEUSER${runId}`,
        role: "USER",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Other User ${runId}`,
        jabatan: "QA",
        nip: `EDGEOTH${runId}`,
        role: "USER",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Admin IT ${runId}`,
        jabatan: "Admin 1",
        nip: `EDGEA1I${runId}`,
        role: "ADMIN_1",
        categoryScope: "IT_ELEKTRONIK",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Admin Lab ${runId}`,
        jabatan: "Admin 1",
        nip: `EDGEA1L${runId}`,
        role: "ADMIN_1",
        categoryScope: "LABORATORIUM",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Admin 2 ${runId}`,
        jabatan: "Admin 2",
        nip: `EDGEA2${runId}`,
        role: "ADMIN_2",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Admin 3 ${runId}`,
        jabatan: "Admin 3",
        nip: `EDGEA3${runId}`,
        role: "ADMIN_3",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Admin 4 IT ${runId}`,
        jabatan: "Admin 4",
        nip: `EDGEA4I${runId}`,
        role: "ADMIN_4",
        categoryScope: "IT_ELEKTRONIK",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Admin 5 ${runId}`,
        jabatan: "Admin 5",
        nip: `EDGEA5${runId}`,
        role: "ADMIN_5",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Super Admin ${runId}`,
        jabatan: "Admin Utama",
        nip: `EDGESUP${runId}`,
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        nama: `Executive ${runId}`,
        jabatan: "Kepala Balai",
        nip: `EDGEEXE${runId}`,
        role: "EXECUTIVE",
        passwordHash,
      },
    }),
  ]);

  createdUserIds.push(...users.map((user) => user.id));

  return {
    userNip: users[0].nip!,
    otherUserNip: users[1].nip!,
    adminItNip: users[2].nip!,
    adminLabNip: users[3].nip!,
    admin2Nip: users[4].nip!,
    admin3Nip: users[5].nip!,
    admin4ItNip: users[6].nip!,
    admin5Nip: users[7].nip!,
    superAdminNip: users[8].nip!,
    executiveNip: users[9].nip!,
  };
}

async function cleanup() {
  try {
    if (createdReportIds.length > 0) {
      await prisma.report.deleteMany({
        where: {
          id: { in: createdReportIds },
        },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: createdUserIds },
        },
      });
    }

    await prisma.messageTemplate.deleteMany({
      where: {
        title: { contains: runId },
      },
    });

    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { summary: { contains: runId } },
            { metadata: { contains: runId } },
            ...(createdReportIds.length > 0
              ? [{ reportId: { in: createdReportIds } }]
              : []),
          ],
        },
      });
    } catch {
      // The app creates AuditLog lazily, so early setup failures may happen before it exists.
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(`Running API edge smoke tests against ${baseUrl}`);

  const loginPage = await fetch(`${baseUrl}/login`);
  assert(loginPage.ok, "/login should be reachable.");
  const forgotPage = await fetch(`${baseUrl}/forgot-password`);
  assert(forgotPage.ok, "/forgot-password should be reachable.");
  logStep("Public auth pages are reachable");

  const leakedLoginUrl = await fetch(
    `${baseUrl}/login?nip=197207061999031001&password=password123%21`,
    { redirect: "manual" },
  );
  const cleanedLocation = leakedLoginUrl.headers.get("location") || "";

  assert(
    [307, 308].includes(leakedLoginUrl.status),
    `Credential query cleanup expected redirect, got ${leakedLoginUrl.status}.`,
  );
  assert(
    cleanedLocation.endsWith("/login") &&
      !cleanedLocation.includes("nip=") &&
      !cleanedLocation.includes("password="),
    `Credential query cleanup leaked data in location: ${cleanedLocation}`,
  );
  logStep("Login page strips credential query strings from the address bar");

  await request("/api/reports", { expectedStatus: 401 });
  await request("/api/login", {
    method: "POST",
    body: { nip: "", password: "" },
    expectedStatus: 400,
  });
  await request("/api/login", {
    method: "POST",
    body: { nip: "nobody", password: "wrong" },
    expectedStatus: 401,
  });
  await request("/api/login", {
    method: "POST",
    body: { nip: "nobody", password: "wrong" },
    origin: "https://evil.example",
    expectedStatus: 403,
  });
  logStep("Authentication and same-origin guards reject bad requests");

  const nips = await setupUsers();
  const user = await login(nips.userNip);
  const otherUser = await login(nips.otherUserNip);
  const adminIt = await login(nips.adminItNip);
  const adminLab = await login(nips.adminLabNip);
  const admin2 = await login(nips.admin2Nip);
  const admin3 = await login(nips.admin3Nip);
  const admin4It = await login(nips.admin4ItNip);
  const admin5 = await login(nips.admin5Nip);
  const superAdmin = await login(nips.superAdminNip);
  const executive = await login(nips.executiveNip);

  assert(user.body.redirectTo === "/dashboard/user", "User redirect mismatch.");
  assert(adminIt.body.redirectTo === "/dashboard/admin", "Admin redirect mismatch.");
  assert(
    executive.body.redirectTo === "/dashboard/admin/statistik",
    "Executive redirect should go straight to statistics page.",
  );
  const executiveAdminPage = await fetch(`${baseUrl}/dashboard/admin`, {
    headers: {
      Cookie: executive.cookie,
    },
    redirect: "manual",
  });
  assert(
    [307, 308].includes(executiveAdminPage.status) &&
      (executiveAdminPage.headers.get("location") || "").endsWith(
        "/dashboard/admin/statistik",
      ),
    "Executive opening /dashboard/admin should redirect to statistics page.",
  );
  const executiveStatsPage = await fetch(`${baseUrl}/dashboard/admin/statistik`, {
    headers: {
      Cookie: executive.cookie,
    },
  });
  const executiveStatsHtml = await executiveStatsPage.text();
  assert(executiveStatsPage.ok, "Executive statistics page should be reachable.");
  assert(
    executiveStatsHtml.includes("Akun") && executiveStatsHtml.includes("Keluar"),
    "Executive statistics page should still expose account and logout actions.",
  );
  assert(
    executiveStatsHtml.includes("Ringkasan Eksekutif") &&
      executiveStatsHtml.includes("Gambaran menyeluruh periode aktif"),
    "Executive statistics page should open with the operational summary.",
  );
  const adminStatsPage = await fetch(`${baseUrl}/dashboard/admin/statistik`, {
    headers: {
      Cookie: adminIt.cookie,
    },
    redirect: "manual",
  });
  assert(
    [307, 308].includes(adminStatsPage.status) &&
      (adminStatsPage.headers.get("location") || "").endsWith("/dashboard/admin"),
    "Non-executive admins must be redirected away from statistics.",
  );
  const userStatsPage = await fetch(`${baseUrl}/dashboard/admin/statistik`, {
    headers: { Cookie: user.cookie },
    redirect: "manual",
  });
  assert(
    [307, 308].includes(userStatsPage.status) &&
      (userStatsPage.headers.get("location") || "").endsWith("/dashboard/user"),
    "Users must be redirected away from statistics.",
  );
  const superAdminStatsPage = await fetch(`${baseUrl}/dashboard/admin/statistik`, {
    headers: { Cookie: superAdmin.cookie },
    redirect: "manual",
  });
  assert(
    [307, 308].includes(superAdminStatsPage.status) &&
      (superAdminStatsPage.headers.get("location") || "").endsWith("/dashboard/admin"),
    "Super admins must be redirected away from Executive statistics.",
  );
  for (const cookie of [user.cookie, adminIt.cookie, superAdmin.cookie]) {
    await request("/api/reports/stats/monthly", {
      cookie,
      expectedStatus: 403,
    });
  }
  await request("/api/reports/stats/monthly", {
    cookie: executive.cookie,
  });
  const executiveAccountPage = await fetch(`${baseUrl}/dashboard/account`, {
    headers: {
      Cookie: executive.cookie,
    },
  });
  assert(executiveAccountPage.ok, "Executive should be able to open account settings.");
  const executiveLogout = await fetch(`${baseUrl}/api/logout`, {
    method: "POST",
    headers: {
      Cookie: executive.cookie,
      Origin: origin,
    },
  });
  assert(executiveLogout.ok, "Executive should be able to log out.");
  await submitNativeLoginForm(nips.userNip, "/dashboard/user");
  logStep("Temporary user, other user, admins, super admin, and executive can log in");

  await request("/api/account/password", {
    method: "POST",
    cookie: user.cookie,
    body: {
      currentPassword: password,
      newPassword: "weakpass",
      confirmPassword: "weakpass",
    },
    expectedStatus: 400,
  });
  await request("/api/admin/users", {
    method: "POST",
    cookie: superAdmin.cookie,
    body: {
      nama: `Weak User ${runId}`,
      nip: `EDGEWEAK${runId}`,
      role: "USER",
      password: "weakpass",
    },
    expectedStatus: 400,
  });
  assert(user.body.user?.id, "User login response did not include user id.");
  await request(`/api/admin/users/${user.body.user.id}/password`, {
    method: "POST",
    cookie: superAdmin.cookie,
    body: { password: "weakpass" },
    expectedStatus: 400,
  });
  logStep("Every password write API rejects weak passwords");

  await request("/api/admin/master-data", {
    method: "POST",
    cookie: superAdmin.cookie,
    body: {
      kind: "messageTemplate",
      type: "COMPLETE",
      title: `Edge Template ${runId}`,
      body: `Template body ${runId}`,
    },
  });
  await request("/api/admin/master-data", {
    method: "DELETE",
    cookie: superAdmin.cookie,
    body: {
      kind: "messageTemplate",
      type: "COMPLETE",
      title: `Edge Template ${runId}`,
    },
  });
  logStep("Super admin can create and delete response templates");

  await requestForm("/api/reports", validReportForm(), {
    cookie: adminIt.cookie,
    expectedStatus: 403,
  });
  await requestForm("/api/reports", validReportForm({ namaBarang: "" }), {
    cookie: user.cookie,
    expectedStatus: 400,
  });
  await requestForm("/api/reports", validReportForm({ kategori: "LAINNYA" }), {
    cookie: user.cookie,
    expectedStatus: 400,
  });
  await requestForm("/api/reports", validReportForm({ kode: "123" }), {
    cookie: user.cookie,
    expectedStatus: 400,
  });
  await requestForm(
    "/api/reports",
    validReportForm({ deskripsi: "x".repeat(2001) }),
    {
      cookie: user.cookie,
      expectedStatus: 400,
    },
  );

  const missingAttachment = await requestForm(
    "/api/reports",
    validReportForm(),
    {
      cookie: user.cookie,
      expectedStatus: 400,
    },
  );
  assert(
    missingAttachment.data?.message === "Lampiran wajib diunggah.",
    "Report creation without an attachment should explain that it is required.",
  );

  const manyAttachments = validReportForm();
  for (let index = 0; index < 11; index += 1) {
    manyAttachments.append(
      "attachments",
      new Blob(["%PDF-1.4\n"], { type: "application/pdf" }),
      `edge-${index}.pdf`,
    );
  }
  await requestForm("/api/reports", manyAttachments, {
    cookie: user.cookie,
    expectedStatus: 400,
  });

  const badAttachment = validReportForm();
  badAttachment.set(
    "attachments",
    new Blob(["hello"], { type: "text/plain" }),
    "notes.txt",
  );
  await requestForm("/api/reports", badAttachment, {
    cookie: user.cookie,
    expectedStatus: 400,
  });
  logStep("Report creation requires an attachment and rejects invalid input");

  const report = await createReport(user.cookie);
  assert(
    report.status === "MENUNGGU_ADMIN_1",
    `New report should wait for Admin 1, got ${report.status}`,
  );
  logStep(`Created report #${report.id} for authorization and workflow checks`);

  await request(`/api/reports/${report.id}/pdf`, {
    cookie: user.cookie,
    expectedStatus: 404,
  });
  logStep("Generated report PDF export is unavailable");

  assert(adminIt.body.user?.id, "Admin login response did not include user id.");
  const extraAdminNotification = await prisma.notification.create({
    data: {
      userId: adminIt.body.user.id,
      reportId: report.id,
      title: `Unread edge notification ${runId}`,
      message: "This entry should remain unread.",
    },
  });
  const userNotification = await prisma.notification.create({
    data: {
      userId: user.body.user.id,
      reportId: report.id,
      title: `User edge notification ${runId}`,
      message: "Open the linked report.",
    },
  });
  const adminNotifications = await request("/api/notifications", {
    cookie: adminIt.cookie,
  });
  const workflowNotification = adminNotifications.data?.notifications?.find(
    (notification: { id: number; reportId: number }) =>
      notification.reportId === report.id &&
      notification.id !== extraAdminNotification.id,
  );
  assert(workflowNotification, "Report creation should notify the responsible admin.");
  assert(
    workflowNotification.createdAt && workflowNotification.readAt === null,
    "Unread notifications should include a creation date and null read date.",
  );
  assert(
    workflowNotification.href === `/dashboard/admin?report=${report.id}`,
    "Admin notification should link to the report detail.",
  );
  await request("/api/notifications", {
    method: "PATCH",
    cookie: user.cookie,
    body: { notificationId: workflowNotification.id },
    expectedStatus: 404,
  });
  await request("/api/notifications", {
    method: "PATCH",
    cookie: adminIt.cookie,
    body: { notificationId: workflowNotification.id },
  });
  const updatedAdminNotifications = await request("/api/notifications", {
    cookie: adminIt.cookie,
  });
  assert(
    updatedAdminNotifications.data?.notifications?.find(
      (notification: { id: number }) => notification.id === workflowNotification.id,
    )?.readAt,
    "Clicked notification should be marked read.",
  );
  assert(
    updatedAdminNotifications.data?.notifications?.find(
      (notification: { id: number }) => notification.id === extraAdminNotification.id,
    )?.readAt === null,
    "Reading one notification must not mark another entry read.",
  );
  await request("/api/notifications", {
    method: "PATCH",
    cookie: adminIt.cookie,
    body: { readAll: true },
  });
  const allReadAdminNotifications = await request("/api/notifications", {
    cookie: adminIt.cookie,
  });
  assert(
    allReadAdminNotifications.data?.unreadCount === 0 &&
      allReadAdminNotifications.data?.notifications?.every(
        (notification: { readAt: string | null }) => notification.readAt !== null,
      ),
    "Read-all should clear every unread notification for the current user.",
  );
  const userNotifications = await request("/api/notifications", {
    cookie: user.cookie,
  });
  const linkedUserNotification = userNotifications.data?.notifications?.find(
    (notification: { id: number }) => notification.id === userNotification.id,
  );
  assert(
    linkedUserNotification?.href === `/dashboard/user/status?report=${report.id}`,
    "User notification should link to and focus the report status entry.",
  );
  assert(
    linkedUserNotification.readAt === null,
    "Admin read-all must not change another user's notifications.",
  );
  await request("/api/notifications", {
    method: "PATCH",
    cookie: adminIt.cookie,
    body: {},
    expectedStatus: 400,
  });
  logStep("Notifications support dates, report links, per-entry reads, and read-all");

  await request(`/api/reports/${report.id}`, {
    cookie: otherUser.cookie,
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}`, {
    cookie: adminLab.cookie,
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}`, {
    cookie: superAdmin.cookie,
    expectedStatus: 200,
  });
  await request("/api/reports/abc", {
    cookie: user.cookie,
    expectedStatus: 400,
  });
  await request("/api/reports/999999999", {
    cookie: user.cookie,
    expectedStatus: 404,
  });
  logStep("Report detail access respects ownership, category scope, and ID validation");

  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: user.cookie,
    body: { action: "ACC", note: "user should not approve" },
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminLab.cookie,
    body: { action: "ACC", note: "wrong category" },
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin2.cookie,
    body: { action: "ACC", note: "too early" },
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: superAdmin.cookie,
    body: { action: "ACC", note: "monitor only" },
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminIt.cookie,
    body: { action: "MAYBE", note: "invalid action" },
    expectedStatus: 400,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminIt.cookie,
    body: { action: "TOLAK", note: "not allowed for admin 1" },
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminIt.cookie,
    body: { action: "ACC", note: "" },
    expectedStatus: 400,
  });
  logStep("Decision endpoint rejects wrong actors and invalid actions");

  const approval = await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminIt.cookie,
    body: { action: "ACC", note: `Edge approve ${runId}` },
  });

  assert(
    approval.data?.report?.status === "MENUNGGU_ADMIN_2",
    `Admin 1 approval should move report to Admin 2, got ${approval.data?.report?.status}`,
  );

  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminIt.cookie,
    body: { action: "ACC", note: "same admin cannot approve twice" },
    expectedStatus: 403,
  });
  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin2.cookie,
    body: { action: "TOLAK", note: "" },
    expectedStatus: 400,
  });
  logStep("Workflow advances once and enforces the next required role");

  const admin2Approval = await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin2.cookie,
    body: { action: "ACC", note: `Admin 2 forward ${runId}` },
  });
  assert(
    admin2Approval.data?.report?.status === "MENUNGGU_ADMIN_3",
    `Admin 2 approval should move report to Admin 3, got ${admin2Approval.data?.report?.status}`,
  );

  const admin3Approval = await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin3.cookie,
    body: { action: "ACC", note: `Admin 3 forward ${runId}` },
  });
  assert(
    admin3Approval.data?.report?.status === "MENUNGGU_ADMIN_4",
    `Admin 3 approval should move report to Admin 4, got ${admin3Approval.data?.report?.status}`,
  );

  const admin4Approval = await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin4It.cookie,
    body: { action: "ACC", note: `Admin 4 forward ${runId}` },
  });
  assert(
    admin4Approval.data?.report?.status === "MENUNGGU_ADMIN_5",
    `Admin 4 approval should move report to Admin 5, got ${admin4Approval.data?.report?.status}`,
  );

  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin5.cookie,
    body: { action: "SELESAI", note: "", repairCost: "1000000" },
    expectedStatus: 400,
  });

  await request(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: admin5.cookie,
    body: { action: "ACC", note: `Accept without budget ${runId}` },
    expectedStatus: 400,
  });

  const badCompletionForm = new FormData();
  badCompletionForm.set("action", "SELESAI");
  badCompletionForm.set("note", `Bad completion proof ${runId}`);
  badCompletionForm.set("repairCost", "1250000");
  badCompletionForm.append(
    "proofs",
    new Blob(["not allowed"], { type: "text/plain" }),
    "bad.txt",
  );
  await requestForm(`/api/reports/${report.id}/decide`, badCompletionForm, {
    cookie: admin5.cookie,
    expectedStatus: 400,
  });

  const completionForm = new FormData();
  completionForm.set("action", "SELESAI");
  completionForm.set("note", `Completed with proofs ${runId}`);
  completionForm.set("repairCost", "1250000");
  completionForm.append(
    "proofs",
    new Blob(["%PDF-1.4\nreceipt\n"], { type: "application/pdf" }),
    `receipt-${runId}.pdf`,
  );
  completionForm.append(
    "proofs",
    new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], { type: "image/png" }),
    `proof-${runId}.png`,
  );
  const completion = await requestForm(
    `/api/reports/${report.id}/decide`,
    completionForm,
    {
      cookie: admin5.cookie,
    },
  );
  assert(
    completion.data?.report?.status === "MENUNGGU_KONFIRMASI",
    `Admin 5 completion should wait for reporter confirmation, got ${completion.data?.report?.status}`,
  );
  assert(
    Number(completion.data?.report?.repairCost || 0) === 1250000,
    "Completion should store numeric expense amount.",
  );
  assert(
    Array.isArray(completion.data?.report?.attachments) &&
      completion.data.report.attachments.length >= 3,
    "Completion should keep original report attachment and add multiple proof files.",
  );
  logStep("Workflow reaches PP completion with an optional budget and multiple proof files");

  const ppDeclineReport = await createReport(user.cookie);
  for (const [cookie, label] of [
    [adminIt.cookie, "PJ Perbaikan"],
    [admin2.cookie, "K.TU"],
    [admin3.cookie, "BMN"],
    [admin4It.cookie, "PPK"],
  ]) {
    await request(`/api/reports/${ppDeclineReport.id}/decide`, {
      method: "POST",
      cookie,
      body: { action: "ACC", note: `${label} meneruskan ${runId}` },
    });
  }
  const ppDecline = await request(
    `/api/reports/${ppDeclineReport.id}/decide`,
    {
      method: "POST",
      cookie: admin5.cookie,
      body: { action: "TOLAK", note: `PP menolak tanpa anggaran ${runId}` },
    },
  );
  assert(
    ppDecline.data?.report?.status === "DITOLAK",
    "PP should be able to decline without entering a budget.",
  );
  logStep("PP budget is required for acceptance but optional for rejection");

  const ppAcceptedReport = await createReport(user.cookie);
  for (const [cookie, label] of [
    [adminIt.cookie, "PJ Perbaikan"],
    [admin2.cookie, "K.TU"],
    [admin3.cookie, "BMN"],
    [admin4It.cookie, "PPK"],
  ]) {
    await request(`/api/reports/${ppAcceptedReport.id}/decide`, {
      method: "POST",
      cookie,
      body: { action: "ACC", note: `${label} meneruskan ${runId}` },
    });
  }
  const ppAcceptance = await request(
    `/api/reports/${ppAcceptedReport.id}/decide`,
    {
      method: "POST",
      cookie: admin5.cookie,
      body: {
        action: "ACC",
        note: `PP menerima ${runId}`,
        repairCost: "1500000",
      },
    },
  );
  assert(
    ppAcceptance.data?.report?.status === "MENUNGGU_KONFIRMASI",
    "PP acceptance should return the report to the reporter for confirmation.",
  );
  const reporterNotifications = await request("/api/notifications", {
    cookie: user.cookie,
  });
  const ppAcceptanceNotification =
    reporterNotifications.data?.notifications?.find(
      (notification: {
        reportId: number;
        title: string;
        href: string;
        readAt: string | null;
      }) =>
        notification.reportId === ppAcceptedReport.id &&
        notification.title === "Laporan diterima, perlu konfirmasi",
    );
  assert(
    ppAcceptanceNotification,
    "PP acceptance should notify the original reporter.",
  );
  assert(
    ppAcceptanceNotification.readAt === null,
    "The PP acceptance notification should initially be unread.",
  );
  assert(
    ppAcceptanceNotification.href ===
      `/dashboard/user/status?report=${ppAcceptedReport.id}`,
    "The PP acceptance notification should link to the reporter's report detail.",
  );
  logStep("PP acceptance notifies the reporter and links to the report detail");

  const attachmentId = completion.data.report.attachments[0].id;
  await requestDownload(
    `/api/reports/${report.id}/attachments/${attachmentId}/download`,
    {
      cookie: otherUser.cookie,
      expectedStatus: 403,
    },
  );
  const download = await requestDownload(
    `/api/reports/${report.id}/attachments/${attachmentId}/download`,
    {
      cookie: user.cookie,
    },
  );
  assert(
    download.headers.get("content-disposition")?.includes("filename="),
    "Attachment download should preserve a filename.",
  );
  logStep("Attachment download enforces permissions and returns downloadable files");

  await request(`/api/reports/${report.id}/confirm`, {
    method: "POST",
    cookie: user.cookie,
    body: { confirmed: false, finalStatus: "TELAH_BERFUNGSI" },
    expectedStatus: 400,
  });
  await request(`/api/reports/${report.id}/confirm`, {
    method: "POST",
    cookie: user.cookie,
    body: { confirmed: true, finalStatus: "TIDAK_DAPAT_DIGUNAKAN" },
    expectedStatus: 400,
  });
  const reopen = await request(`/api/reports/${report.id}/confirm`, {
    method: "POST",
    cookie: user.cookie,
    body: {
      confirmed: true,
      finalStatus: "TIDAK_DAPAT_DIGUNAKAN",
      description: `Still unusable ${runId}`,
    },
  });
  assert(
    reopen.data?.report?.status === "MENUNGGU_ADMIN_1",
    `Unusable confirmation should reopen to Admin 1, got ${reopen.data?.report?.status}`,
  );
  logStep("Reporter confirmation requires checkbox/description and can reopen reports");

  const finalReport = await createReport(user.cookie);
  await request(`/api/reports/${finalReport.id}/decide`, {
    method: "POST",
    cookie: adminIt.cookie,
    body: { action: "SELESAI", note: `Room PIC complete ${runId}` },
  });
  const finalConfirmation = await request(`/api/reports/${finalReport.id}/confirm`, {
    method: "POST",
    cookie: user.cookie,
    body: { confirmed: true, finalStatus: "TELAH_BERFUNGSI" },
  });
  assert(
    finalConfirmation.data?.report?.status === "TELAH_BERFUNGSI",
    `Functional confirmation should close report, got ${finalConfirmation.data?.report?.status}`,
  );
  logStep("Reporter can close a completed report as functioning properly");

  await requestDownload(
    `/api/reports/export?processState=UNFINISHED&responsibleRole=ADMIN_1&room=${encodeURIComponent(
      "Ruang Edge",
    )}&itemType=Laptop&budget=CUSTOM&budgetMin=0&budgetMax=2000000`,
    {
      cookie: superAdmin.cookie,
    },
  );
  await requestDownload(`/api/admin/users/export?q=${runId}`, {
    cookie: superAdmin.cookie,
  });
  await requestDownload("/api/reports/stats/monthly/export", {
    cookie: adminIt.cookie,
    expectedStatus: 403,
  });
  await requestDownload("/api/reports/stats/monthly/export", {
    cookie: superAdmin.cookie,
    expectedStatus: 403,
  });
  const executiveForExport = await login(nips.executiveNip);
  await requestDownload("/api/reports/stats/monthly/export", {
    cookie: executiveForExport.cookie,
  });
  logStep("Exports enforce role access and return files for authorized users");

  const auditCount = await prisma.auditLog.count({
    where: {
      OR: [
        { reportId: { in: createdReportIds } },
        { summary: { contains: runId } },
        { metadata: { contains: runId } },
      ],
    },
  });
  assert(auditCount > 0, "Workflow should create audit log entries.");
  logStep("Audit log records workflow, template, and download actions");

  console.log("API edge smoke tests passed.");
}

try {
  await main();
} finally {
  await cleanup();
}

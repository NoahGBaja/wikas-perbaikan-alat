import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/passwords.ts";

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

const baseUrl =
  process.env.E2E_BASE_URL || process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const password = `SmokeTest123!`;
const runId = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
const userNip = `E2EUSER${runId}`;
const adminNip = `E2EADM${runId}`;

const createdUserIds: number[] = [];
const createdReportIds: number[] = [];

function createSmokePrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur.");
  }

  const parsed = new URL(connectionString);
  const database = parsed.pathname.replace(/^\//, "");

  if (!database) {
    throw new Error("Nama database pada DATABASE_URL tidak valid.");
  }

  const host =
    parsed.hostname === "localhost" || parsed.hostname === "::1"
      ? "127.0.0.1"
      : parsed.hostname;

  const adapter = new PrismaMariaDb(
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
    {
      database,
    },
  );

  return new PrismaClient({ adapter });
}

const prisma = createSmokePrismaClient();

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

async function requestJson(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    expectedStatus?: number;
  } = {},
) {
  const body =
    options.body === undefined ? undefined : JSON.stringify(options.body);

  const headers: Record<string, string> = {
    Origin: origin,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = getContentLength(body);
  }

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  let res: Response;

  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body,
    });
  } catch (error) {
    throw new Error(
      `Cannot reach ${baseUrl}${path}. Start the app first with "npm run dev", or set E2E_BASE_URL to the running app URL. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

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

async function login(nip: string): Promise<LoginResult> {
  const { res, data } = await requestJson("/api/login", {
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

async function createReport(cookie: string) {
  const form = new FormData();
  form.set("kategori", "IT_ELEKTRONIK");
  form.set("namaPelapor", `Smoke User ${runId}`);
  form.set("nomorRuangan", "R-005");
  form.set("namaRuangan", "Ruang IT");
  form.set("kodeUakpb", `Laptop Smoke ${runId.slice(0, 6)}`);
  form.set("kode", "123456789012");
  form.set("nup", `NUP-${runId.slice(0, 6)}`);
  form.set("subcategory", "Komputer");
  form.set("namaBarang", `Laptop Smoke ${runId.slice(0, 6)}`);
  form.set("repairCost", "");
  form.set("deskripsi", `Smoke test report ${runId}`);
  form.append(
    "attachments",
    new Blob(["%PDF-1.4\nsmoke-report\n"], { type: "application/pdf" }),
    `report-${runId}.pdf`,
  );

  let res: Response;

  try {
    res = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
      },
      body: form,
    });
  } catch (error) {
    throw new Error(
      `Cannot reach ${baseUrl}/api/reports. Start the app first with "npm run dev", or set E2E_BASE_URL to the running app URL. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const data = await readJsonResponse(res);

  assert(
    res.status === 200,
    `POST /api/reports expected 200, got ${res.status}: ${JSON.stringify(data)}`,
  );

  assert(data?.report?.id, "Create report response did not include report.id.");
  createdReportIds.push(data.report.id);

  return data.report as { id: number; status: string };
}

async function setupUsers() {
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      nama: `Smoke User ${runId}`,
      jabatan: "QA",
      nip: userNip,
      role: "USER",
      passwordHash,
    },
  });

  const admin = await prisma.user.create({
    data: {
      nama: `Smoke Admin ${runId}`,
      jabatan: "Admin 1",
      nip: adminNip,
      role: "ADMIN_1",
      categoryScope: "IT_ELEKTRONIK",
      passwordHash,
    },
  });

  createdUserIds.push(user.id, admin.id);
  logStep(`Created temporary USER ${userNip} and ADMIN_1 ${adminNip}`);
}

async function cleanup() {
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

  await prisma.$disconnect();
}

async function waitForApp() {
  const attempts = 15;
  const delayMs = 1000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(`${baseUrl}/login`, {
        headers: {
          Origin: origin,
        },
      });

      if (res.ok) {
        logStep(`App is reachable at ${baseUrl}`);
        return;
      }
    } catch {
      // Keep retrying until the app has had a fair chance to boot.
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Cannot reach ${baseUrl}/login. Start the app first with "npm run dev", or set E2E_BASE_URL to the running app URL.`,
  );
}

async function main() {
  console.log(`Running smoke flow against ${baseUrl}`);

  await waitForApp();
  await setupUsers();

  const userLogin = await login(userNip);
  assert(userLogin.body.redirectTo === "/dashboard/user", "User redirect mismatch.");
  logStep("Logged in as temporary user through /api/login");

  const report = await createReport(userLogin.cookie);
  assert(
    report.status === "MENUNGGU_ADMIN_1",
    `New report should wait for Admin 1, got ${report.status}`,
  );
  logStep(`Submitted report #${report.id} through /api/reports`);

  const userReports = await requestJson("/api/reports", {
    cookie: userLogin.cookie,
  });
  assert(
    Array.isArray(userReports.data?.reports) &&
      userReports.data.reports.some((item: { id: number }) => item.id === report.id),
    "User report list did not include the new report.",
  );
  logStep("Verified user can see the submitted report");

  const adminLogin = await login(adminNip);
  assert(
    adminLogin.body.redirectTo === "/dashboard/admin",
    "Admin redirect mismatch.",
  );
  logStep("Logged in as temporary Admin 1 through /api/login");

  const adminReports = await requestJson("/api/reports/admin", {
    cookie: adminLogin.cookie,
  });
  assert(
    Array.isArray(adminReports.data?.reports) &&
      adminReports.data.reports.some((item: { id: number }) => item.id === report.id),
    "Admin report list did not include the new report.",
  );
  logStep("Verified Admin 1 can see the submitted report");

  const decision = await requestJson(`/api/reports/${report.id}/decide`, {
    method: "POST",
    cookie: adminLogin.cookie,
    body: {
      action: "ACC",
      note: `Smoke approve ${runId}`,
    },
  });

  assert(
    decision.data?.report?.status === "MENUNGGU_ADMIN_2",
    `Admin 1 ACC should move report to MENUNGGU_ADMIN_2, got ${decision.data?.report?.status}`,
  );
  logStep("Approved report as Admin 1 and verified it moved to Admin 2");

  const finalUserReports = await requestJson("/api/reports", {
    cookie: userLogin.cookie,
  });
  const updatedReport = finalUserReports.data?.reports?.find(
    (item: { id: number }) => item.id === report.id,
  );
  assert(updatedReport, "Updated report was not visible to user.");
  assert(
    updatedReport.status === "MENUNGGU_ADMIN_2",
    `User should see MENUNGGU_ADMIN_2, got ${updatedReport.status}`,
  );
  logStep("Verified user sees the updated approval status");

  console.log("Smoke flow passed.");
}

try {
  await main();
} finally {
  await cleanup();
}

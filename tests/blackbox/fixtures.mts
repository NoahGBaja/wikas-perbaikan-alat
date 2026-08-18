import "dotenv/config";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { hash } from "bcryptjs";

const artifactDirectory = path.join(process.cwd(), ".data", "blackbox");
const artifactPath = path.join(artifactDirectory, "fixtures.json");
const password = process.env.BLACKBOX_PASSWORD || "Blackbox-Test-2026!";
const command = process.argv[2] || "setup";

function createClient() {
  const parsed = new URL(process.env.DATABASE_URL || "");
  const database = parsed.pathname.replace(/^\//, "");

  if (!parsed.hostname || !database) {
    throw new Error("DATABASE_URL tidak valid untuk fixture black-box.");
  }

  return new PrismaClient({
    adapter: new PrismaMariaDb(
      {
        host: parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database,
        connectionLimit: 3,
      },
      { database },
    ),
  });
}

const prisma = createClient();

async function cleanup() {
  let ids: number[] = [];
  let storedRunId = "";
  let storedNips: string[] = [];
  const storedAttachmentReferences = new Set<string>();

  try {
    const stored = JSON.parse(await readFile(artifactPath, "utf8"));
    storedRunId = typeof stored.runId === "string" ? stored.runId : "";
    storedNips = Object.values(stored.accounts || {})
      .map((account) =>
        typeof account === "object" &&
        account !== null &&
        "nip" in account &&
        typeof account.nip === "string"
          ? account.nip
          : "",
      )
      .filter(Boolean);
    ids = Array.isArray(stored.userIds)
      ? stored.userIds.filter((id: unknown) => Number.isInteger(id))
      : [];
  } catch {
    // Tidak ada fixture aktif.
  }

  if (ids.length > 0) {
    const reports = await prisma.report.findMany({
      where: { userId: { in: ids } },
      select: {
        fotoUrl: true,
        attachmentUrl: true,
        completionPhotoUrl: true,
        attachments: { select: { url: true } },
      },
    });

    for (const report of reports) {
      for (const reference of [
        report.fotoUrl,
        report.attachmentUrl,
        report.completionPhotoUrl,
        ...report.attachments.map((attachment) => attachment.url),
      ]) {
        if (reference) storedAttachmentReferences.add(reference);
      }
    }

    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  if (process.env.STORAGE_DRIVER?.toLowerCase() !== "s3") {
    const privateStorageRoot = path.resolve(
      process.cwd(),
      process.env.STORAGE_LOCAL_ROOT?.trim() || ".data/storage",
    );
    const publicRoot = path.resolve(process.cwd(), "public");

    for (const reference of storedAttachmentReferences) {
      const target = reference.startsWith("private://")
        ? path.resolve(privateStorageRoot, reference.slice("private://".length))
        : reference.startsWith("/uploads/")
          ? path.resolve(publicRoot, reference.slice(1))
          : "";
      const expectedRoot = reference.startsWith("private://")
        ? privateStorageRoot
        : publicRoot;

      if (!target || !target.startsWith(`${expectedRoot}${path.sep}`)) continue;
      await unlink(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  if (storedRunId) {
    await prisma.messageTemplate.deleteMany({
      where: { title: { contains: storedRunId } },
    });
    await prisma.masterSubcategory.deleteMany({
      where: { name: { contains: storedRunId } },
    });
    await prisma.masterRoom.deleteMany({
      where: {
        OR: [
          { name: { contains: storedRunId } },
          { code: { contains: storedRunId } },
        ],
      },
    });
  }

  if (process.env.BLACKBOX_RESET_RATE_LIMITS === "true") {
    await prisma.rateLimitBucket.deleteMany({
      where: {
        key: {
          in: [
            "login:ip:unknown",
            "login:ip:::1",
            "login:ip:127.0.0.1",
            ...storedNips.map((nip) => `login:nip:${nip.toLowerCase()}`),
          ],
        },
      },
    });
  }

  console.log(JSON.stringify({ cleanedUserIds: ids, cleanedRunId: storedRunId }));
}

async function setup() {
  await cleanup();
  const runId = Date.now().toString(36).toUpperCase();
  const passwordHash = await hash(password, 12);
  const definitions = [
    ["userUi", "USER", null],
    ["userA", "USER", null],
    ["userB", "USER", null],
    ["adminIt", "ADMIN_1", "IT_ELEKTRONIK"],
    ["adminLab", "ADMIN_1", "LABORATORIUM"],
    ["admin2", "ADMIN_2", null],
    ["admin3", "ADMIN_3", null],
    ["admin4It", "ADMIN_4", "IT_ELEKTRONIK"],
    ["admin5", "ADMIN_5", null],
    ["superAdmin", "SUPER_ADMIN", null],
    ["executive", "EXECUTIVE", null],
    ["listUser1", "USER", null],
    ["listUser2", "USER", null],
    ["listUser3", "USER", null],
  ] as const;

  const accounts: Record<string, { id: number; nip: string; role: string }> = {};
  const userIds: number[] = [];

  for (const [key, role, categoryScope] of definitions) {
    const nip = `BBX-${runId}-${key.toUpperCase()}`;
    const user = await prisma.user.create({
      data: {
        nama: `Blackbox ${key}`,
        jabatan: "Security Test",
        nip,
        activeNip: nip,
        passwordHash,
        role,
        isSuperAdmin: role === "SUPER_ADMIN",
        categoryScope,
      },
      select: { id: true, nip: true, role: true },
    });

    userIds.push(user.id);
    accounts[key] = { id: user.id, nip: user.nip || nip, role: user.role };
  }

  const fixture = {
    runId,
    password,
    accounts,
    userIds,
    createdAt: new Date().toISOString(),
  };

  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(artifactPath, JSON.stringify(fixture, null, 2), "utf8");
  console.log(JSON.stringify({ ...fixture, password: "[stored in artifact]" }));
}

try {
  if (command === "cleanup") await cleanup();
  else await setup();
} finally {
  await prisma.$disconnect();
}

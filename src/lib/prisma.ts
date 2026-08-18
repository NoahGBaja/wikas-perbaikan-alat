import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur.");
  }

  const parsed = new URL(connectionString);
  const database = parsed.pathname.replace(/^\//, "");
  const connectionLimit = Number(process.env.DATABASE_CONNECTION_LIMIT || 10);

  if (!database) {
    throw new Error("Nama database pada DATABASE_URL tidak valid.");
  }

  const adapter = new PrismaMariaDb(
    {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      database,
      connectionLimit:
        Number.isInteger(connectionLimit) && connectionLimit > 0
          ? Math.min(connectionLimit, 100)
          : 10,
      acquireTimeout: 10_000,
      connectTimeout: 10_000,
    },
    {
      database,
    }
  );

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

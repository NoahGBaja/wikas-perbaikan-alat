import "server-only";

import { prisma } from "@/src/lib/prisma";

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
};

type RateLimitResult = {
  allowed: boolean;
  limited: boolean;
  remaining: number;
  resetAt: Date;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
let requestsSinceCleanup = 0;

function resolveOptions(options?: RateLimitOptions) {
  return {
    limit: Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
    windowMs: Math.max(options?.windowMs ?? DEFAULT_WINDOW_MS, 1_000),
  };
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function cleanupExpiredBuckets() {
  requestsSinceCleanup += 1;
  if (requestsSinceCleanup < 100) return;

  requestsSinceCleanup = 0;
  const retentionBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await prisma.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: retentionBoundary } },
  });
}

export async function checkRateLimitBucket(
  key: string,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const { limit, windowMs } = resolveOptions(options);
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  await prisma.$executeRaw`
    INSERT INTO RateLimitBucket (
      bucketKey,
      count,
      resetAt,
      updatedAt
    ) VALUES (
      ${key},
      1,
      ${nextResetAt},
      ${now}
    )
    ON DUPLICATE KEY UPDATE
      count = IF(
        resetAt <= ${now},
        1,
        LEAST(count + 1, ${limit + 1})
      ),
      resetAt = IF(resetAt <= ${now}, ${nextResetAt}, resetAt),
      updatedAt = ${now}
  `;

  const current = await prisma.rateLimitBucket.findUnique({
    where: { key },
    select: { count: true, resetAt: true },
  });

  void cleanupExpiredBuckets().catch((error) => {
    console.error("RATE_LIMIT_CLEANUP_ERROR:", error);
  });

  const count = current?.count ?? limit + 1;
  const resetAt = current?.resetAt ?? nextResetAt;
  const allowed = count <= limit;

  return {
    allowed,
    limited: !allowed,
    remaining: Math.max(limit - count, 0),
    resetAt,
  };
}

export async function consumeRateLimitBucket(
  key: string,
  options?: RateLimitOptions,
) {
  return checkRateLimitBucket(key, options);
}

export async function resetRateLimitBucket(key: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export async function clearRateLimitBucket(key: string) {
  await resetRateLimitBucket(key);
}

export async function isRateLimited(key: string, options?: RateLimitOptions) {
  const result = await checkRateLimitBucket(key, options);
  return result.limited;
}

export async function clearRateLimit(key: string) {
  await resetRateLimitBucket(key);
}

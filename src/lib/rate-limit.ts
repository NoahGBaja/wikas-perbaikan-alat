type RateLimitEntry = {
  count: number;
  resetAt: number;
};

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

const buckets = new Map<string, RateLimitEntry>();

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function resolveOptions(options?: RateLimitOptions) {
  return {
    limit: options?.limit ?? DEFAULT_LIMIT,
    windowMs: options?.windowMs ?? DEFAULT_WINDOW_MS,
  };
}

function cleanupExpiredBuckets() {
  const now = nowMs();

  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export async function checkRateLimitBucket(
  key: string,
  options?: RateLimitOptions
): Promise<RateLimitResult> {
  cleanupExpiredBuckets();

  const { limit, windowMs } = resolveOptions(options);
  const now = nowMs();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      limited: false,
      remaining: Math.max(limit - 1, 0),
      resetAt: new Date(now + windowMs),
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      limited: true,
      remaining: 0,
      resetAt: new Date(current.resetAt),
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    limited: false,
    remaining: Math.max(limit - current.count, 0),
    resetAt: new Date(current.resetAt),
  };
}

export async function consumeRateLimitBucket(
  key: string,
  options?: RateLimitOptions
) {
  return checkRateLimitBucket(key, options);
}

export async function resetRateLimitBucket(key: string) {
  buckets.delete(key);
}

export async function clearRateLimitBucket(key: string) {
  buckets.delete(key);
}

export async function isRateLimited(
  key: string,
  options?: RateLimitOptions
) {
  const result = await checkRateLimitBucket(key, options);
  return result.limited;
}

export async function clearRateLimit(key: string) {
  buckets.delete(key);
}

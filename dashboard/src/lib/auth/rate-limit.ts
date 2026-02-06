import "server-only";

type Entry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, Entry>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = entries.get(key);

  if (!existing || now >= existing.resetAt) {
    entries.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

import "server-only";
import { NextRequest } from "next/server";

type Entry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, Entry>();

const CLEANUP_INTERVAL_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of entries.entries()) {
    if (now >= entry.resetAt) {
      entries.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export const RATE_LIMITS = {
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },           // 10 attempts / 15 min
  CHANGE_PASSWORD: { limit: 5, windowMs: 15 * 60 * 1000 },  // 5 attempts / 15 min
  API_KEYS: { limit: 10, windowMs: 60 * 1000 },             // 10 requests / 1 min
  CUSTOM_PROVIDERS: { limit: 10, windowMs: 60 * 1000 },     // 10 requests / 1 min
  CONFIG_SYNC_TOKENS: { limit: 5, windowMs: 60 * 1000 },    // 5 requests / 1 min
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMITS;

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

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

export function checkRateLimitWithPreset(
  request: NextRequest,
  routeKey: string,
  preset: RateLimitPreset
): RateLimitResult {
  const ip = getClientIp(request);
  const { limit, windowMs } = RATE_LIMITS[preset];
  return checkRateLimit(`${routeKey}:${ip}`, limit, windowMs);
}

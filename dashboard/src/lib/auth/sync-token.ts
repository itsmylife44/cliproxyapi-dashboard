import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

interface TokenResult {
  token: string;
  hash: string;
}

interface ValidSyncTokenResult {
  ok: true;
  userId: string;
  syncApiKey: string | null;
}

interface InvalidSyncTokenResult {
  ok: false;
  reason: "unauthorized" | "expired";
}

type SyncTokenValidationResult = ValidSyncTokenResult | InvalidSyncTokenResult;

const DEFAULT_SYNC_TOKEN_MAX_AGE_DAYS = 90;

function getSyncTokenMaxAgeDays(): number {
  const envValue = process.env.SYNC_TOKEN_MAX_AGE_DAYS;
  if (!envValue) return DEFAULT_SYNC_TOKEN_MAX_AGE_DAYS;

  const parsed = parseInt(envValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_SYNC_TOKEN_MAX_AGE_DAYS;
  }

  return parsed;
}

function isTokenExpired(createdAt: Date): boolean {
  const maxAgeDays = getSyncTokenMaxAgeDays();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const tokenAgeMs = now - createdAt.getTime();

  return tokenAgeMs > maxAgeMs;
}

export function generateSyncToken(): TokenResult {
  const tokenBuffer = crypto.randomBytes(32);
  const token = tokenBuffer.toString("base64url");

  const hash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, hash };
}

export function verifySyncToken(token: string, hash: string): boolean {
  const computedHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  } catch {
    return false;
  }
}

export async function validateSyncTokenFromHeader(
  request: NextRequest
): Promise<SyncTokenValidationResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "unauthorized" };
  }

  const token = authHeader.slice(7);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    const syncToken = await prisma.syncToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
        syncApiKey: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    if (!syncToken) {
      return { ok: false, reason: "unauthorized" };
    }

    if (isTokenExpired(syncToken.createdAt)) {
      return { ok: false, reason: "expired" };
    }

    const LAST_USED_THROTTLE_MS = 60 * 60 * 1000;
    const shouldUpdate = !syncToken.lastUsedAt ||
      Date.now() - syncToken.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;

    if (shouldUpdate) {
      prisma.syncToken.update({
        where: { id: syncToken.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});
    }

    return { ok: true, userId: syncToken.userId, syncApiKey: syncToken.syncApiKey };
  } catch {
    return { ok: false, reason: "unauthorized" };
  }
}

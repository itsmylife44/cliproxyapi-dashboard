import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateSyncToken } from "@/lib/auth/sync-token";
import { prisma } from "@/lib/db";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "config-sync-tokens", "CONFIG_SYNC_TOKENS");
  if (!rateLimit.allowed) {
    return apiError("Too many token creation requests. Try again later.", 429);
  }

  const session = await verifySession();
  if (!session) {
    return apiError("Unauthorized", 401);
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const { token, hash } = generateSyncToken();

    // Fetch user's API key (most recent one)
    const userApiKey = await prisma.userApiKey.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!userApiKey) {
      return apiError("User API key not found. Please create an API key first.", 400);
    }

    const syncToken = await prisma.syncToken.create({
      data: {
        userId: session.userId,
        name: "Default",
        tokenHash: hash,
        syncApiKey: userApiKey.id,
      },
    });

    return apiSuccess({
      id: syncToken.id,
      token,
      name: syncToken.name,
      syncApiKeyId: syncToken.syncApiKey,
      createdAt: syncToken.createdAt.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to create sync token");
    return apiError("Failed to create token", 500);
  }
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return apiError("Unauthorized", 401);
  }

  try {
    const syncTokens = await prisma.syncToken.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        syncApiKey: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    // Resolve syncApiKey IDs to key names
    const keyIds = syncTokens
      .map((t) => t.syncApiKey)
      .filter((id): id is string => id !== null);

    const userKeys = keyIds.length > 0 ? await prisma.userApiKey.findMany({
      where: { id: { in: keyIds }, userId: session.userId },
      select: { id: true, name: true },
    }) : [];

    const keyNameMap = new Map(userKeys.map((k) => [k.id, k.name]));

    const tokens = syncTokens.map((token) => ({
      id: token.id,
      name: token.name,
      syncApiKeyId: token.syncApiKey,
      syncApiKeyName: token.syncApiKey ? keyNameMap.get(token.syncApiKey) || null : null,
      createdAt: token.createdAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() || null,
      isRevoked: token.revokedAt !== null,
    }));

    // Fetch all user API keys for the dropdown
    const allUserKeys = await prisma.userApiKey.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ tokens, apiKeys: allUserKeys });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch sync tokens");
    return apiError("Failed to fetch tokens", 500);
  }
}

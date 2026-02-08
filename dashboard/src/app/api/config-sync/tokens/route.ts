import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateSyncToken } from "@/lib/auth/sync-token";
import { prisma } from "@/lib/db";
import { checkRateLimitWithPreset } from "@/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimitWithPreset(request, "config-sync-tokens", "CONFIG_SYNC_TOKENS");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many token creation requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        { error: "User API key not found. Please create an API key first." },
        { status: 400 }
      );
    }

    const syncToken = await prisma.syncToken.create({
      data: {
        userId: session.userId,
        name: "Default",
        tokenHash: hash,
        syncApiKey: userApiKey.id,
      },
    });

    return NextResponse.json({
      id: syncToken.id,
      token,
      name: syncToken.name,
      syncApiKeyId: syncToken.syncApiKey,
      createdAt: syncToken.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to create sync token:", error);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({ tokens, apiKeys: allUserKeys });
  } catch (error) {
    console.error("Failed to fetch sync tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}

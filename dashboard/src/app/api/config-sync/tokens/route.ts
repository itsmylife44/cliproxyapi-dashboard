import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { generateSyncToken } from "@/lib/auth/sync-token";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
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
        syncApiKey: userApiKey.key,
      },
    });

    return NextResponse.json({
      id: syncToken.id,
      token,
      name: syncToken.name,
      syncApiKey: syncToken.syncApiKey,
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

export async function GET(_request: NextRequest) {
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

    const tokens = syncTokens.map((token) => ({
      id: token.id,
      name: token.name,
      syncApiKey: token.syncApiKey,
      createdAt: token.createdAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() || null,
      isRevoked: token.revokedAt !== null,
    }));

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Failed to fetch sync tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}

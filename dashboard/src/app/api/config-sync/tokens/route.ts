import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { generateSyncToken } from "@/lib/auth/sync-token";
import { prisma } from "@/lib/db";

export async function POST(_request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, hash } = generateSyncToken();
    
    const syncToken = await prisma.syncToken.create({
      data: {
        userId: session.userId,
        name: "Default",
        tokenHash: hash,
      },
    });

    return NextResponse.json({
      id: syncToken.id,
      token,
      name: syncToken.name,
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
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    const tokens = syncTokens.map((token) => ({
      id: token.id,
      name: token.name,
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

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const syncApiKeyId = typeof body.syncApiKey === "string" && body.syncApiKey.length > 0 ? body.syncApiKey : null;

    const existingToken = await prisma.syncToken.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingToken) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    if (existingToken.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (syncApiKeyId) {
      const ownedKey = await prisma.userApiKey.findFirst({
        where: { id: syncApiKeyId, userId: session.userId },
        select: { id: true },
      });

      if (!ownedKey) {
        return NextResponse.json({ error: "API key not found or not owned by you" }, { status: 403 });
      }
    }

    await prisma.syncToken.update({
      where: { id },
      data: { syncApiKey: syncApiKeyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update sync token:", error);
    return NextResponse.json(
      { error: "Failed to update token" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const { id } = await params;

  try {
    const existingToken = await prisma.syncToken.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingToken) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    if (existingToken.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.syncToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke sync token:", error);
    return NextResponse.json(
      { error: "Failed to revoke token" },
      { status: 500 }
    );
  }
}

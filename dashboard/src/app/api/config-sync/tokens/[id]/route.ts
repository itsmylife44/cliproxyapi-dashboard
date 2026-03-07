import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return apiError("Unauthorized", 401);
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
      return apiError("Token not found", 404);
    }

    if (existingToken.userId !== session.userId) {
      return apiError("Forbidden", 403);
    }

    if (syncApiKeyId) {
      const ownedKey = await prisma.userApiKey.findFirst({
        where: { id: syncApiKeyId, userId: session.userId },
        select: { id: true },
      });

      if (!ownedKey) {
        return apiError("API key not found or not owned by you", 403);
      }
    }

    await prisma.syncToken.update({
      where: { id },
      data: { syncApiKey: syncApiKeyId },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to update sync token");
    return apiError("Failed to update token", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return apiError("Unauthorized", 401);
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
      return apiError("Token not found", 404);
    }

    if (existingToken.userId !== session.userId) {
      return apiError("Forbidden", 403);
    }

    await prisma.syncToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to revoke sync token");
    return apiError("Failed to revoke token", 500);
  }
}

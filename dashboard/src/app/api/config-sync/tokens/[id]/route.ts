import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
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
      return Errors.notFound("Token");
    }

    if (existingToken.userId !== session.userId) {
      return Errors.forbidden();
    }

    if (syncApiKeyId) {
      const ownedKey = await prisma.userApiKey.findFirst({
        where: { id: syncApiKeyId, userId: session.userId },
        select: { id: true },
      });

      if (!ownedKey) {
        return Errors.forbidden();
      }
    }

    await prisma.syncToken.update({
      where: { id },
      data: { syncApiKey: syncApiKeyId },
    });

    return apiSuccess({});
  } catch (error) {
    return Errors.internal("Failed to update sync token", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
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
      return Errors.notFound("Token");
    }

    if (existingToken.userId !== session.userId) {
      return Errors.forbidden();
    }

    await prisma.syncToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return apiSuccess({});
  } catch (error) {
    return Errors.internal("Failed to revoke sync token", error);
  }
}

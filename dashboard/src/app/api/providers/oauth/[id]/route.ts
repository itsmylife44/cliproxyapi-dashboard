import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { removeOAuthAccountByIdOrName, toggleOAuthAccountByIdOrName } from "@/lib/providers/dual-write";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

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

  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return apiError("Invalid or missing id parameter", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await removeOAuthAccountByIdOrName(session.userId, id, isAdmin);

    if (!result.ok) {
      if (result.error?.includes("Access denied")) {
        return apiError(result.error, 403);
      }
      if (result.error?.includes("not found")) {
        return apiError(result.error, 404);
      }
      return apiError(result.error ?? "Operation failed", 500);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error({ err: error }, "DELETE /api/providers/oauth/[id] error");
    return apiError("Failed to remove OAuth account", 500);
  }
}

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

  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return apiError("Invalid or missing id parameter", 400);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.disabled !== "boolean") {
      return apiError("Request body must include 'disabled' (boolean)", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await toggleOAuthAccountByIdOrName(session.userId, id, body.disabled, isAdmin);

    if (!result.ok) {
      if (result.error?.includes("Access denied")) {
        return apiError(result.error, 403);
      }
      if (result.error?.includes("not found")) {
        return apiError(result.error, 404);
      }
      return apiError(result.error ?? "Operation failed", 500);
    }

    return apiSuccess({ disabled: result.disabled });
  } catch (error) {
    logger.error({ err: error }, "PATCH /api/providers/oauth/[id] error");
    return apiError("Failed to toggle OAuth account", 500);
  }
}

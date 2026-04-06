import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { removeOAuthAccountByIdOrName, toggleOAuthAccountByIdOrName } from "@/lib/providers/dual-write";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";

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

  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Errors.missingFields(["id"]);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await removeOAuthAccountByIdOrName(session.userId, id, isAdmin);

    if (!result.ok) {
      if (result.error?.includes("Access denied")) {
        return Errors.forbidden();
      }
      if (result.error?.includes("not found")) {
        return Errors.notFound("OAuth account");
      }
      return Errors.internal("Failed to remove OAuth account", result.error ? new Error(result.error) : undefined);
    }

    return apiSuccess({});
  } catch (error) {
    return Errors.internal("Failed to remove OAuth account", error);
  }
}

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

  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Errors.missingFields(["id"]);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.disabled !== "boolean") {
      return Errors.validation("Request body must include 'disabled' (boolean)");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await toggleOAuthAccountByIdOrName(session.userId, id, body.disabled, isAdmin);

    if (!result.ok) {
      if (result.error?.includes("Access denied")) {
        return Errors.forbidden();
      }
      if (result.error?.includes("not found")) {
        return Errors.notFound("OAuth account");
      }
      return Errors.internal("Failed to toggle OAuth account", result.error ? new Error(result.error) : undefined);
    }

    return apiSuccess({ disabled: result.disabled });
  } catch (error) {
    return Errors.internal("Failed to toggle OAuth account", error);
  }
}

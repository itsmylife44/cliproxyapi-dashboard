import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { removeOAuthAccountByIdOrName, toggleOAuthAccountByIdOrName } from "@/lib/providers/dual-write";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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

  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing id parameter" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await removeOAuthAccountByIdOrName(session.userId, id, isAdmin);

    if (!result.ok) {
      if (result.error?.includes("Access denied")) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      if (result.error?.includes("not found")) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "DELETE /api/providers/oauth/[id] error");
    return NextResponse.json(
      { error: "Failed to remove OAuth account" },
      { status: 500 }
    );
  }
}

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

  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing id parameter" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.disabled !== "boolean") {
      return NextResponse.json(
        { error: "Request body must include 'disabled' (boolean)" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const result = await toggleOAuthAccountByIdOrName(session.userId, id, body.disabled, isAdmin);

    if (!result.ok) {
      if (result.error?.includes("Access denied")) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      if (result.error?.includes("not found")) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, disabled: result.disabled });
  } catch (error) {
    logger.error({ err: error }, "PATCH /api/providers/oauth/[id] error");
    return NextResponse.json(
      { error: "Failed to toggle OAuth account" },
      { status: 500 }
    );
  }
}

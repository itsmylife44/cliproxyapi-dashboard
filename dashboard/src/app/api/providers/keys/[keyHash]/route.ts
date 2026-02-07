import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { removeKey, removeKeyByAdmin } from "@/lib/providers/dual-write";
import { prisma } from "@/lib/db";
import { PROVIDER, type Provider } from "@/lib/providers/constants";

function isValidProvider(provider: string): provider is Provider {
  return Object.values(PROVIDER).includes(provider as Provider);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyHash: string }> }
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
    const { keyHash } = await params;
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!keyHash || typeof keyHash !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing keyHash parameter" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    const isAdmin = user?.isAdmin ?? false;

    const ownership = await prisma.providerKeyOwnership.findUnique({
      where: { keyHash },
    });

    let result: { ok: boolean; error?: string };

    if (!ownership && isAdmin && provider && isValidProvider(provider)) {
      result = await removeKeyByAdmin(keyHash, provider);
    } else {
      result = await removeKey(session.userId, keyHash, isAdmin);
    }

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
    console.error("DELETE /api/providers/keys/[keyHash] error:", error);
    return NextResponse.json(
      { error: "Failed to remove provider key" },
      { status: 500 }
    );
  }
}

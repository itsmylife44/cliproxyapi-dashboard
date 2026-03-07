import { NextRequest, NextResponse } from "next/server";
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";
import { generateConfigBundle } from "@/lib/config-sync/generate-bundle";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const authResult = await validateSyncTokenFromHeader(request);

  if (!authResult.ok) {
    return Errors.unauthorized();
  }

  try {
    const bundle = await generateConfigBundle(authResult.userId, authResult.syncApiKey);

    await prisma.configSubscription.updateMany({
      where: {
        userId: authResult.userId,
        isActive: true,
      },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      version: bundle.version,
      opencode: bundle.opencode,
      ohMyOpencode: bundle.ohMyOpencode,
    });
  } catch (error) {
    const isSyncTokenError =
      error instanceof Error && error.message.includes("sync token");
    if (isSyncTokenError) {
      return Errors.validation("Invalid or expired sync token");
    }
    return Errors.internal("Config sync bundle error", error);
  }
}

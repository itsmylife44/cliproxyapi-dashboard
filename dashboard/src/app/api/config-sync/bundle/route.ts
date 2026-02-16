import { NextRequest, NextResponse } from "next/server";
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";
import { generateConfigBundle } from "@/lib/config-sync/generate-bundle";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const authResult = await validateSyncTokenFromHeader(request);

  if (!authResult.ok) {
    const errorMessage = authResult.reason === "expired" ? "Sync token expired" : "Unauthorized";
    return NextResponse.json({ error: errorMessage }, { status: 401 });
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
    logger.error({ err: error }, "Config sync bundle error");
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("sync token") ? 400 : 500;
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

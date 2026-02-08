import { NextRequest, NextResponse } from "next/server";
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";
import { generateConfigBundle } from "@/lib/config-sync/generate-bundle";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await validateSyncTokenFromHeader(request);

  if (!authResult.ok) {
    const errorMessage = authResult.reason === "expired" ? "Sync token expired" : "Unauthorized";
    return NextResponse.json({ error: errorMessage }, { status: 401 });
  }

  try {
    const bundle = await generateConfigBundle(authResult.userId, authResult.syncApiKey);

    // Fire-and-forget: update lastSyncedAt for active subscribers
    void prisma.configSubscription.updateMany({
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
    console.error("Config sync bundle error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

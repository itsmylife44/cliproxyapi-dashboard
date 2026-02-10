import { NextRequest, NextResponse } from "next/server";
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";
import { generateConfigBundle } from "@/lib/config-sync/generate-bundle";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const authResult = await validateSyncTokenFromHeader(request);

  if (!authResult.ok) {
    const errorMessage = authResult.reason === "expired" ? "Sync token expired" : "Unauthorized";
    return NextResponse.json({ error: errorMessage }, { status: 401 });
  }

  try {
    const bundle = await generateConfigBundle(authResult.userId);

    return NextResponse.json({ version: bundle.version });
  } catch (error) {
    logger.error({ err: error }, "Config sync version error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

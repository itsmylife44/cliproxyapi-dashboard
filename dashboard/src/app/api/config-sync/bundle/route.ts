import { NextRequest, NextResponse } from "next/server";
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";
import { generateConfigBundle } from "@/lib/config-sync/generate-bundle";

export async function GET(request: NextRequest) {
  const authResult = await validateSyncTokenFromHeader(request);

  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bundle = await generateConfigBundle(authResult.userId);

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

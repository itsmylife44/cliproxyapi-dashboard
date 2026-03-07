import { NextRequest, NextResponse } from "next/server";
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";
import { generateConfigBundle } from "@/lib/config-sync/generate-bundle";
import { Errors } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const authResult = await validateSyncTokenFromHeader(request);

  if (!authResult.ok) {
    return Errors.unauthorized();
  }

  try {
    const bundle = await generateConfigBundle(authResult.userId);

    return NextResponse.json({ version: bundle.version });
  } catch (error) {
    return Errors.internal("Config sync version error", error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { deleteSession, verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const session = await verifySession();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || request.headers.get("x-real-ip") 
      || "unknown";

    await deleteSession();

    if (session) {
      logger.info({ userId: session.userId, username: session.username, ip }, "User logged out");
    }

    return apiSuccess({ loggedOut: true });
  } catch (error) {
    logger.error({ err: error }, "Logout error");
    return apiError("Internal server error", 500);
  }
}

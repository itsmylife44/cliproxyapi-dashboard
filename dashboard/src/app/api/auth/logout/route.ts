import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { deleteSession, verifySession } from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await verifySession();
    await deleteSession();

    if (session) {
      logger.info({ userId: session.userId, username: session.username }, "User logged out");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Logout error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    await deleteSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Logout error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

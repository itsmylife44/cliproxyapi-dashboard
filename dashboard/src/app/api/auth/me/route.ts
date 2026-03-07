import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await verifySession();
    
    if (!session) {
      return apiError("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      return apiError("User not found", 404);
    }

    return apiSuccess({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch current user");
    return apiError("Internal server error", 500);
  }
}

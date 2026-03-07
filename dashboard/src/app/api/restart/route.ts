import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ConfirmActionSchema } from "@/lib/validation/schemas";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "cliproxyapi";

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session) {
    return apiError("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return apiError("Forbidden: Admin access required", 403);
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  try {
    const body = await request.json();
    const parsed = ConfirmActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Confirmation required", 400);
    }

    await execFileAsync("docker", ["restart", CONTAINER_NAME]);

    return apiSuccess({
      success: true,
      message: "Restart completed",
    });
  } catch (error) {
    logger.error({ err: error }, "Restart endpoint error");
    return apiError("Internal server error", 500);
  }
}

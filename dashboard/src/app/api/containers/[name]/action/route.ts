import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { CONTAINER_CONFIG, isValidContainerName } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { ContainerActionSchema, formatZodError } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError } from "@/lib/api-response";

const execFileAsync = promisify(execFile);

type ActionValue = "start" | "stop" | "restart";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
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

  const { name } = await params;

  if (!isValidContainerName(name)) {
    return apiError("Invalid or unrecognized container name", 400);
  }

  try {
    const body = await request.json();
    const validated = ContainerActionSchema.parse(body);

    const typedAction: ActionValue = validated.action;
    const config = CONTAINER_CONFIG[name];

    const permissionKey = `allow${typedAction.charAt(0).toUpperCase()}${typedAction.slice(1)}` as
      | "allowStart"
      | "allowStop"
      | "allowRestart";

    if (!config[permissionKey]) {
      return apiError(`Action '${typedAction}' is not allowed on container '${config.displayName}'`, 403);
    }

    await execFileAsync("docker", [typedAction, name]);

    return apiSuccess({
      message: `Container '${config.displayName}' ${typedAction} completed`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("Validation failed", 400, formatZodError(error));
    }
    logger.error({ err: error, containerName: name }, "Container action error");
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to perform action: ${message}`, 500);
  }
}

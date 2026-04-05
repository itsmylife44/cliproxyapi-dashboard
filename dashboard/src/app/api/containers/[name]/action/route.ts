import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { CONTAINER_CONFIG, isValidContainerName } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { ContainerActionSchema } from "@/lib/validation/schemas";
import { Errors, apiSuccess } from "@/lib/errors";

const execFileAsync = promisify(execFile);

type ActionValue = "start" | "stop" | "restart";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await verifySession();

  if (!session) {
    return Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const { name } = await params;

  if (!isValidContainerName(name)) {
    return Errors.validation("Invalid or unrecognized container name");
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
      return Errors.forbidden();
    }

    await execFileAsync("docker", [typedAction, name]);

    return apiSuccess({
      message: `Container '${config.displayName}' ${typedAction} completed`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Errors.zodValidation(error.issues);
    }
    return Errors.internal("Container action failed", error);
  }
}

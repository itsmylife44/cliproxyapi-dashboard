import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { CONTAINER_CONFIG, isValidContainerName } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const ALLOWED_ACTIONS = {
  START: "start",
  STOP: "stop",
  RESTART: "restart",
} as const;

type ActionValue = (typeof ALLOWED_ACTIONS)[keyof typeof ALLOWED_ACTIONS];

const VALID_ACTIONS = new Set<string>(Object.values(ALLOWED_ACTIONS));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  const { name } = await params;

  if (!isValidContainerName(name)) {
    return NextResponse.json(
      { error: "Invalid or unrecognized container name" },
      { status: 400 }
    );
  }

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      !("confirm" in body)
    ) {
      return NextResponse.json(
        { error: "Request body must include 'action' and 'confirm'" },
        { status: 400 }
      );
    }

    const { action, confirm } = body as { action: string; confirm: unknown };

    if (confirm !== true) {
      return NextResponse.json(
        { error: "Confirmation required: set confirm to true" },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Allowed: ${[...VALID_ACTIONS].join(", ")}` },
        { status: 400 }
      );
    }

    const typedAction = action as ActionValue;
    const config = CONTAINER_CONFIG[name];

    const permissionKey = `allow${typedAction.charAt(0).toUpperCase()}${typedAction.slice(1)}` as
      | "allowStart"
      | "allowStop"
      | "allowRestart";

    if (!config[permissionKey]) {
      return NextResponse.json(
        { error: `Action '${typedAction}' is not allowed on container '${config.displayName}'` },
        { status: 403 }
      );
    }

    await execFileAsync("docker", [typedAction, name]);

    return NextResponse.json({
      success: true,
      message: `Container '${config.displayName}' ${typedAction} completed`,
    });
  } catch (error) {
    console.error(`Container action error for ${name}:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to perform action: ${message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "cliproxyapi";
const COMPOSE_FILE = "/opt/cliproxyapi/infrastructure/docker-compose.yml";
const IMAGE_NAME = "eceasy/cli-proxy-api";
const VERSION_PATTERN = /^(latest|v\d+\.\d+\.\d+)$/;
async function runCompose(args: string[]) {
  return execFileAsync("docker", ["compose", "-f", COMPOSE_FILE, ...args]);
}

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const { version = "latest", confirm } = body;

    if (confirm !== true) {
      return NextResponse.json(
        { error: "Confirmation required" },
        { status: 400 }
      );
    }

    if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
      return NextResponse.json(
        { error: "Invalid version format" },
        { status: 400 }
      );
    }

    const imageTag = `${IMAGE_NAME}:${version}`;

    const pullResult = await execFileAsync("docker", ["pull", imageTag]);
    logger.info({ stdout: pullResult.stdout }, "Pull result");

    if (version !== "latest") {
      await execFileAsync("docker", ["tag", imageTag, `${IMAGE_NAME}:latest`]);
      logger.info({ version }, "Tagged selected version as latest for compose rollout");
    }

    await runCompose(["up", "-d", "--no-deps", "--force-recreate", CONTAINER_NAME]);

    return NextResponse.json({
      success: true,
      message: `Updated to ${version}`,
      version,
    });
  } catch (error) {
    logger.error({ err: error }, "Update error");

    try {
      await runCompose(["up", "-d", "--no-deps", CONTAINER_NAME]);
      logger.info("Recovery: compose ensured proxy service is up");
    } catch (restartError) {
      logger.error({ err: restartError }, "Recovery failed");
    }

    return NextResponse.json(
      { error: "Update failed. Container may need manual restart." },
      { status: 500 }
    );
  }
}

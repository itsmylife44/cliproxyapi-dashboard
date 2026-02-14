import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";

const execFileAsync = promisify(execFile);

const COMPOSE_FILE = "/opt/cliproxyapi/infrastructure/docker-compose.yml";
const GITHUB_REPO = process.env.GITHUB_REPO || "itsmylife44/cliproxyapi-dashboard";
const GHCR_IMAGE = `ghcr.io/${GITHUB_REPO}/dashboard`;
const LOCAL_IMAGE = "cliproxyapi-dashboard:latest";
const VERSION_PATTERN = /^(latest|v\d+\.\d+\.\d+)$/;

function getCommandErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function runCompose(args: string[]) {
  return execFileAsync("docker", ["compose", "-f", COMPOSE_FILE, ...args]);
}

async function isComposeAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["compose", "version"]);
    return true;
  } catch (error) {
    const errorText = getCommandErrorText(error);
    const composeMissing =
      errorText.includes("unknown command: docker compose") ||
      errorText.includes("unknown shorthand flag: 'f' in -f");

    if (composeMissing) {
      logger.info("Docker compose not available in runtime");
    } else {
      logger.warn({ err: error }, "Compose availability check failed");
    }

    return false;
  }
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

  let composeAvailable = false;

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

    const ghcrTag = `${GHCR_IMAGE}:${version}`;
    composeAvailable = await isComposeAvailable();

    const pullResult = await execFileAsync("docker", ["pull", ghcrTag]);
    logger.info({ stdout: pullResult.stdout }, "Pull result");

    await execFileAsync("docker", ["tag", ghcrTag, LOCAL_IMAGE]);
    logger.info({ version }, "Tagged GHCR image as local compose image");

    if (composeAvailable) {
      await runCompose([
        "up",
        "-d",
        "--no-deps",
        "--force-recreate",
        "dashboard",
      ]);
    } else {
      logger.info("Compose unavailable — tagged image locally. Manual restart required.");
      return NextResponse.json({
        success: true,
        message: `Pulled ${version}. Restart the dashboard container manually to apply.`,
        version,
        manualRestart: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Updated dashboard to ${version}`,
      version,
    });
  } catch (error) {
    logger.error({ err: error }, "Update error");

    try {
      if (composeAvailable) {
        await runCompose(["up", "-d", "--no-deps", "dashboard"]);
        logger.info("Recovery: compose ensured dashboard service is up");
      }
    } catch (restartError) {
      logger.error({ err: restartError }, "Recovery failed");
    }

    return NextResponse.json(
      { error: "Update failed. Container may need manual restart." },
      { status: 500 }
    );
  }
}

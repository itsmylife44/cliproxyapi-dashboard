import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifySession } from "@/lib/auth/session";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const CONTAINER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

function getContainerName(): string {
  const containerName = process.env.CLIPROXYAPI_CONTAINER_NAME || "cliproxyapi";

  if (!CONTAINER_NAME_PATTERN.test(containerName)) {
    throw new Error("Invalid CLIPROXYAPI_CONTAINER_NAME");
  }

  return containerName;
}

export async function GET() {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const containerName = getContainerName();
    const { stdout } = await execFileAsync("docker", [
      "ps",
      "--filter",
      `name=^${containerName}$`,
      "--filter",
      "status=running",
      "--format",
      "{{.Names}}",
    ]);
    const isRunning = stdout.trim() === containerName;

    let uptime = null;
    if (isRunning) {
      try {
        const { stdout: startTimeStr } = await execFileAsync("docker", [
          "inspect",
          containerName,
          "--format",
          "{{.State.StartedAt}}",
        ]);
        const startTime = new Date(startTimeStr.trim());
        const now = new Date();
        const uptimeMs = now.getTime() - startTime.getTime();
        uptime = Math.floor(uptimeMs / 1000);
      } catch {
        uptime = null;
      }
    }

    return NextResponse.json({
      running: isRunning,
      containerName,
      uptime,
    });
  } catch (error) {
    logger.error({ err: error }, "Status check error:");
    return NextResponse.json(
      { 
        running: false,
        error: "Failed to check container status"
      },
      { status: 200 }
    );
  }
}

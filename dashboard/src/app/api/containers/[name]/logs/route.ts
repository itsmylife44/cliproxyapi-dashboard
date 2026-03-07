import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CONTAINER_CONFIG, isValidContainerName } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";
import { apiSuccess, apiError } from "@/lib/api-response";

const execFileAsync = promisify(execFile);

const DEFAULT_LINES = 100;
const MAX_LINES = 500;

export async function GET(
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

  const { name } = await params;

  if (!isValidContainerName(name)) {
    return apiError("Invalid or unrecognized container name", 400);
  }

  const linesParam = request.nextUrl.searchParams.get("lines");
  let lines = DEFAULT_LINES;

  if (linesParam !== null) {
    const parsed = parseInt(linesParam, 10);
    if (isNaN(parsed) || parsed < 1) {
      return apiError("Parameter 'lines' must be a positive integer", 400);
    }
    lines = Math.min(parsed, MAX_LINES);
  }

  try {
    const { stdout, stderr } = await execFileAsync("docker", [
      "logs", name,
      "--tail", String(lines),
      "--timestamps",
    ]);

    // Docker outputs recent logs to stdout, older logs to stderr
    const allOutput = [stderr, stdout]
      .filter(Boolean)
      .join("\n")
      .trim();

    const logLines = allOutput ? allOutput.split("\n") : [];
    const config = CONTAINER_CONFIG[name];

    return apiSuccess({
      lines: logLines,
      containerName: config.displayName,
    });
  } catch (error) {
    logger.error({ err: error, containerName: name }, "Container logs error");
    return apiError("Failed to fetch container logs", 500);
  }
}

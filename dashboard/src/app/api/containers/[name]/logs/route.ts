import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CONTAINER_CONFIG, isValidContainerName } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";
import { Errors, apiSuccess } from "@/lib/errors";

const execFileAsync = promisify(execFile);

const DEFAULT_LINES = 100;
const MAX_LINES = 500;

export async function GET(
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

  const { name } = await params;

  if (!isValidContainerName(name)) {
    return Errors.validation("Invalid or unrecognized container name");
  }

  const linesParam = request.nextUrl.searchParams.get("lines");
  let lines = DEFAULT_LINES;

  if (linesParam !== null) {
    const parsed = parseInt(linesParam, 10);
    if (isNaN(parsed) || parsed < 1) {
      return Errors.validation("Parameter 'lines' must be a positive integer");
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
    return Errors.internal("Failed to fetch container logs", error);
  }
}

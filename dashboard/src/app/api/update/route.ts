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

interface PortBinding {
  HostIp: string;
  HostPort: string;
}

interface ContainerConfig {
  env: string[];
  volumes: string[];
  networks: string[];
  ports: string[];
  restartPolicy: string;
}

function getCommandErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function getContainerConfig(): Promise<ContainerConfig> {
  const { stdout } = await execFileAsync("docker", ["inspect", CONTAINER_NAME]);
  const inspect = JSON.parse(stdout)[0];
  const config = inspect.Config;
  const hostConfig = inspect.HostConfig;

  const ports: string[] = [];
  const portBindings: Record<string, PortBinding[]> =
    hostConfig.PortBindings || {};

  for (const containerPort of Object.keys(portBindings)) {
    for (const binding of portBindings[containerPort] || []) {
      const hostIp = binding.HostIp || "";
      const hostPort = binding.HostPort;
      const port = containerPort.replace("/tcp", "");
      ports.push(hostIp ? `${hostIp}:${hostPort}:${port}` : `${hostPort}:${port}`);
    }
  }

  return {
    env: config.Env || [],
    volumes: hostConfig.Binds || [],
    networks: Object.keys(inspect.NetworkSettings?.Networks || {}),
    ports,
    restartPolicy: hostConfig.RestartPolicy?.Name || "unless-stopped",
  };
}

function buildRunArgs(cfg: ContainerConfig, imageTag: string): string[] {
  const args = [
    "run",
    "-d",
    "--name",
    CONTAINER_NAME,
    "--restart",
    cfg.restartPolicy || "unless-stopped",
  ];

  for (const env of cfg.env) {
    args.push("-e", env);
  }

  for (const vol of cfg.volumes) {
    args.push("-v", vol);
  }

  for (const port of cfg.ports) {
    args.push("-p", port);
  }

  for (const net of cfg.networks) {
    args.push("--network", net);
  }

  args.push(
    "--health-cmd",
    "wget --no-verbose --tries=1 -O /dev/null http://localhost:8317/",
    "--health-interval",
    "30s",
    "--health-timeout",
    "10s",
    "--health-retries",
    "3",
    "--health-start-period",
    "20s"
  );

  args.push(imageTag);
  return args;
}

async function removeContainerIfExists() {
  try {
    await execFileAsync("docker", ["rm", "-f", CONTAINER_NAME]);
  } catch (error) {
    const errorText = getCommandErrorText(error);
    if (!errorText.includes("No such container")) {
      throw error;
    }
  }
}

async function recreateWithDockerRun(config: ContainerConfig, imageTag: string) {
  await removeContainerIfExists();
  await execFileAsync("docker", buildRunArgs(config, imageTag));
}

async function runCompose(args: string[]) {
  return execFileAsync("docker", ["compose", "-f", COMPOSE_FILE, ...args]);
}

async function isComposeAvailable() {
  try {
    await execFileAsync("docker", ["compose", "version"]);
    return true;
  } catch (error) {
    const errorText = getCommandErrorText(error);
    const composeMissing =
      errorText.includes("unknown command: docker compose") ||
      errorText.includes("unknown shorthand flag: 'f' in -f");

    if (composeMissing) {
      logger.info("Docker compose not available in runtime, using docker run fallback");
    } else {
      logger.warn({ err: error }, "Compose availability check failed, using fallback");
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

  let configSnapshot: ContainerConfig | null = null;
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

    const imageTag = `${IMAGE_NAME}:${version}`;
    configSnapshot = await getContainerConfig();
    composeAvailable = await isComposeAvailable();

    const pullResult = await execFileAsync("docker", ["pull", imageTag]);
    logger.info({ stdout: pullResult.stdout }, "Pull result");

    if (composeAvailable && version !== "latest") {
      await execFileAsync("docker", ["tag", imageTag, `${IMAGE_NAME}:latest`]);
      logger.info({ version }, "Tagged selected version as latest for compose rollout");
    }

    if (composeAvailable) {
      await runCompose([
        "up",
        "-d",
        "--no-deps",
        "--force-recreate",
        CONTAINER_NAME,
      ]);
    } else {
      await recreateWithDockerRun(configSnapshot, imageTag);
    }

    return NextResponse.json({
      success: true,
      message: `Updated to ${version}`,
      version,
    });
  } catch (error) {
    logger.error({ err: error }, "Update error");

    try {
      if (composeAvailable) {
        await runCompose(["up", "-d", "--no-deps", CONTAINER_NAME]);
        logger.info("Recovery: compose ensured proxy service is up");
      } else if (configSnapshot) {
        await recreateWithDockerRun(configSnapshot, `${IMAGE_NAME}:latest`);
        logger.info("Recovery: recreated proxy container with latest image");
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

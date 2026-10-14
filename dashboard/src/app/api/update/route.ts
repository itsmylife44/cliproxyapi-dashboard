import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { Errors, apiError, apiSuccess, ERROR_CODE } from "@/lib/errors";
import { UpdateProxySchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";
import { hostEnvFilePath, isWritableFile, withImageTag, writeInPlace } from "@/lib/proxy-image-pin";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "cliproxyapi";
const IMAGE_NAME = "eceasy/cli-proxy-api";

interface PortBinding {
  HostIp: string;
  HostPort: string;
}

interface ContainerConfig {
  image: string;
  env: string[];
  volumes: string[];
  networks: string[];
  ports: string[];
  restartPolicy: string;
  /** compose's own labels, so `docker compose` keeps treating the container as its service */
  composeLabels: string[];
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
    image: config.Image,
    env: config.Env || [],
    volumes: hostConfig.Binds || [],
    networks: Object.keys(inspect.NetworkSettings?.Networks || {}),
    ports,
    restartPolicy: hostConfig.RestartPolicy?.Name || "unless-stopped",
    composeLabels: Object.entries((config.Labels || {}) as Record<string, string>)
      .filter(([key]) => key.startsWith("com.docker.compose."))
      .map(([key, value]) => `${key}=${value}`),
  };
}

function buildRunArgs(cfg: ContainerConfig, imageTag: string): string[] {
  const args = [
    "run", "-d", "--name", CONTAINER_NAME,
    "--restart", cfg.restartPolicy || "unless-stopped",
  ];

  for (const env of cfg.env) { args.push("-e", env); }
  for (const vol of cfg.volumes) { args.push("-v", vol); }
  for (const port of cfg.ports) { args.push("-p", port); }
  for (const net of cfg.networks) { args.push("--network", net); }
  for (const label of cfg.composeLabels) { args.push("--label", label); }

  args.push(
    "--health-cmd", "wget --no-verbose --tries=1 -O /dev/null http://localhost:8317/",
    "--health-interval", "30s",
    "--health-timeout", "10s",
    "--health-retries", "3",
    "--health-start-period", "20s"
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

async function attemptRestore(what: string, restore: () => Promise<void>) {
  try {
    await restore();
    logger.info({ what }, "Recovery: restored after failed proxy update");
  } catch (error) {
    logger.error({ err: error, what }, "Recovery failed");
  }
}

/**
 * Switches CLIProxyAPI to `version`: pull, pin the tag in the host .env so
 * compose keeps it on the next `up`, then recreate the container (docker run,
 * as the dashboard image has no compose plugin). On failure the previous image
 * and env file come back.
 */
async function switchProxyVersion(version: string): Promise<void> {
  const envFile = hostEnvFilePath();
  const imageTag = `${IMAGE_NAME}:${version}`;
  const previous = await getContainerConfig();
  const envBefore = await readFile(envFile, "utf8");
  const envAfter = withImageTag(envBefore, version);

  const pullResult = await execFileAsync("docker", ["pull", imageTag]);
  logger.info({ stdout: pullResult.stdout }, "Pull result");

  let containerReplaced = false;
  try {
    await writeInPlace(envFile, envAfter);
    containerReplaced = true;
    await recreateWithDockerRun(previous, imageTag);
  } catch (error) {
    await attemptRestore("env file", () => writeInPlace(envFile, envBefore));
    if (containerReplaced) {
      await attemptRestore("proxy container", () => recreateWithDockerRun(previous, previous.image));
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
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
  if (originError) return originError;

  try {
    const body = await request.json();
    const result = UpdateProxySchema.safeParse(body);

    if (!result.success) {
      return Errors.zodValidation(result.error.issues);
    }

    const { version } = result.data;

    // Without the pin, the next `docker compose up` would silently undo the switch.
    if (!(await isWritableFile(hostEnvFilePath()))) {
      return apiError(
        ERROR_CODE.PROXY_VERSION_PIN_UNAVAILABLE,
        `Cannot pin the CLIProxyAPI version: ${hostEnvFilePath()} is not mounted or not writable. See docs/ENV.md (CLIPROXYAPI_IMAGE_TAG).`,
        409
      );
    }

    await switchProxyVersion(version);

    return apiSuccess({ message: `Updated to ${version}`, version });
  } catch (error) {
    return Errors.internal("Update failed", error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "cliproxyapi";
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

async function getContainerConfig(): Promise<ContainerConfig> {
  const { stdout } = await execFileAsync("docker", [
    "inspect",
    CONTAINER_NAME,
  ]);

  const inspect = JSON.parse(stdout)[0];
  const config = inspect.Config;
  const hostConfig = inspect.HostConfig;

  const ports: string[] = [];
  const portBindings: Record<string, PortBinding[]> = hostConfig.PortBindings || {};
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
    "run", "-d",
    "--name", CONTAINER_NAME,
    "--restart", cfg.restartPolicy || "unless-stopped",
  ];

  for (const env of cfg.env) args.push("-e", env);
  for (const vol of cfg.volumes) args.push("-v", vol);
  for (const port of cfg.ports) args.push("-p", port);
  for (const net of cfg.networks) args.push("--network", net);

  args.push(
    "--health-cmd", "wget --no-verbose --tries=1 -O /dev/null http://localhost:8317/",
    "--health-interval", "30s",
    "--health-timeout", "10s",
    "--health-retries", "3",
    "--health-start-period", "20s",
  );

  args.push(imageTag);
  return args;
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

    const pullResult = await execFileAsync("docker", ["pull", imageTag]);
    console.log("Pull result:", pullResult.stdout);

    await execFileAsync("docker", ["stop", CONTAINER_NAME]);
    await execFileAsync("docker", ["rm", CONTAINER_NAME]);

    await execFileAsync("docker", buildRunArgs(configSnapshot, imageTag));

    return NextResponse.json({
      success: true,
      message: `Updated to ${version}`,
      version,
    });
  } catch (error) {
    console.error("Update error:", error);

    if (configSnapshot) {
      try {
        const { stdout } = await execFileAsync("docker", [
          "ps", "-a",
          "--filter", `name=^/${CONTAINER_NAME}$`,
          "--format", "{{.Status}}",
        ]);

        if (!stdout.trim()) {
          await execFileAsync(
            "docker",
            buildRunArgs(configSnapshot, `${IMAGE_NAME}:latest`),
          );
          console.log("Recovery: container recreated with previous image");
        } else if (stdout.includes("Exited")) {
          await execFileAsync("docker", ["start", CONTAINER_NAME]);
          console.log("Recovery: started stopped container");
        }
      } catch (restartError) {
        console.error("Recovery failed:", restartError);
      }
    }

    return NextResponse.json(
      { error: "Update failed. Container may need manual restart." },
      { status: 500 }
    );
  }
}

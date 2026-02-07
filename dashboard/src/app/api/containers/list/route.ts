import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CONTAINER_CONFIG, getAllowedActions, type ContainerAction } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const DOCKER_COMMAND_TIMEOUT_MS = 8000;
const DOCKER_MAX_BUFFER_BYTES = 1024 * 1024;

async function runDockerCommand(args: string[]) {
  return execFileAsync("docker", args, {
    timeout: DOCKER_COMMAND_TIMEOUT_MS,
    maxBuffer: DOCKER_MAX_BUFFER_BYTES,
  });
}

interface ContainerInfo {
  name: string;
  displayName: string;
  status: string;
  state: "running" | "exited" | "paused" | "restarting" | "dead" | "created" | "removing";
  uptime: number | null;
  cpu: string | null;
  memory: string | null;
  memoryPercent: string | null;
  actions: ContainerAction[];
}

export async function GET() {
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

  try {
    const filterArgs = Object.keys(CONTAINER_CONFIG).flatMap(
      (name) => ["--filter", `name=^/${name}$`]
    );

    const { stdout } = await runDockerCommand([
      "ps", "-a",
      ...filterArgs,
      "--format", "{{.Names}}\t{{.Status}}\t{{.State}}",
    ]);

    const lines = stdout.trim().split("\n").filter(Boolean);

    const results = await Promise.all(
      lines.map(async (line) => {
        const [name, status, state] = line.split("\t");
        const config = CONTAINER_CONFIG[name];

        if (!config) {
          return null;
        }

        let uptime: number | null = null;
        let cpu: string | null = null;
        let memory: string | null = null;
        let memoryPercent: string | null = null;

        if (state === "running") {
          try {
            const { stdout: startedAt } = await runDockerCommand([
              "inspect", name,
              "--format", "{{.State.StartedAt}}",
            ]);
            const startTime = new Date(startedAt.trim());
            uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
          } catch (err) {
            console.error(`Failed to get uptime for ${name}:`, err);
          }

          try {
            const { stdout: statsOutput } = await runDockerCommand([
              "stats", name,
              "--no-stream",
              "--format", "{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}",
            ]);
            const [cpuVal, memVal, memPercVal] = statsOutput.trim().split("\t");
            cpu = cpuVal ?? null;
            memory = memVal ?? null;
            memoryPercent = memPercVal ?? null;
          } catch (err) {
            console.error(`Failed to get stats for ${name}:`, err);
          }
        }

        const validStates = ["running", "exited", "paused", "restarting", "dead", "created", "removing"] as const;
        type ContainerState = (typeof validStates)[number];
        const normalizedState: ContainerState = validStates.includes(state as ContainerState)
          ? (state as ContainerState)
          : "exited";

        return {
          name,
          displayName: config.displayName,
          status,
          state: normalizedState,
          uptime,
          cpu,
          memory,
          memoryPercent,
          actions: getAllowedActions(name, normalizedState),
        };
      })
    );

    const containers = results.filter((c): c is ContainerInfo => c !== null);

    return NextResponse.json(containers);
  } catch (error) {
    console.error("Container list error:", error);
    return NextResponse.json(
      { error: "Failed to list containers" },
      { status: 500 }
    );
  }
}

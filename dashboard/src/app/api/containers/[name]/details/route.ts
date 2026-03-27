import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isValidContainerName, normalizeHealthStatus, extractEnvKeys, parseRestartInfo, parseServiceLabels } from "@/lib/containers";
import { execFile } from "child_process";
import { promisify } from "util";
import { Errors, apiSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ContainerPort, ContainerMount } from "@/lib/containers";

const execFileAsync = promisify(execFile);

export async function GET(
  _request: NextRequest,
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

  try {
    const { stdout } = await execFileAsync("docker", ["inspect", name], {
      timeout: 8000,
      maxBuffer: 1024 * 1024,
    });

    const data = JSON.parse(stdout);
    const container = data[0];

    const rawHealth = container.State?.Health;
    const healthStatus = normalizeHealthStatus(rawHealth?.Status ?? "");
    const health: { status: ReturnType<typeof normalizeHealthStatus>; failingStreak?: number; log?: string[] } = {
      status: healthStatus,
    };

    if (rawHealth !== undefined) {
      health.failingStreak = rawHealth.FailingStreak ?? 0;
      health.log = (rawHealth.Log ?? []).map(
        (entry: { Output: string }) => entry.Output
      );
    }

    const restart = parseRestartInfo(
      container.RestartCount ?? 0,
      container.State?.ExitCode,
      container.State?.Error || undefined
    );

    const service = parseServiceLabels(container.Config?.Labels ?? {});

    const rawPorts = container.NetworkSettings?.Ports ?? {};
    const ports: ContainerPort[] = [];
    for (const [portProto, bindings] of Object.entries(rawPorts)) {
      const slashIdx = portProto.lastIndexOf("/");
      const portStr = portProto.slice(0, slashIdx);
      const protocol = portProto.slice(slashIdx + 1) as "tcp" | "udp";
      const containerPort = parseInt(portStr, 10);
      if (!Array.isArray(bindings) || bindings.length === 0) {
        ports.push({ containerPort, protocol });
        continue;
      }
      for (const binding of bindings as Array<{ HostIp: string; HostPort: string }>) {
        const port: ContainerPort = { containerPort, protocol };
        if (binding.HostIp) port.hostIp = binding.HostIp;
        if (binding.HostPort) port.hostPort = parseInt(binding.HostPort, 10);
        ports.push(port);
      }
    }

    const rawMounts: Array<{ Type: string; Source: string; Destination: string; RW: boolean }> =
      container.Mounts ?? [];
    const mounts: ContainerMount[] = rawMounts.map((m) => ({
      type: m.Type as "bind" | "volume" | "tmpfs",
      source: m.Source,
      destination: m.Destination,
      readOnly: !m.RW,
    }));

    const env = extractEnvKeys(container.Config?.Env ?? []);

    return apiSuccess({ health, restart, service, ports, mounts, env });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ container: name, error }, "docker inspect failed");
    return new Response(JSON.stringify({ available: false, reason }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

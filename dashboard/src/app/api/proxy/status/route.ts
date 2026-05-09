import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";
import {
  MANAGEMENT_BASE_URL,
  MANAGEMENT_API_KEY,
  fetchWithTimeout,
} from "@/lib/providers/management-api";

const execFileAsync = promisify(execFile);
const CONTAINER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

/**
 * Returns the configured container name, or `null` when the value is invalid
 * or unusable. The container name is now a cosmetic input only — it powers the
 * best-effort `uptime` enrichment via `docker inspect` but is never required
 * to determine liveness. Liveness is decided by probing the Management API,
 * which works under any orchestrator (Compose, Swarm, Kubernetes, bare-metal)
 * and does not depend on container naming or Docker socket access.
 *
 * See https://github.com/itsmylife44/cliproxyapi-dashboard/issues/215.
 */
function getContainerName(): string | null {
  const raw = process.env.CLIPROXYAPI_CONTAINER_NAME || "cliproxyapi";
  if (!CONTAINER_NAME_PATTERN.test(raw)) {
    logger.warn(
      { value: raw },
      "Invalid CLIPROXYAPI_CONTAINER_NAME; uptime lookup disabled"
    );
    return null;
  }
  return raw;
}

/**
 * Probes the CLIProxyAPI Management API for liveness. A 2xx response means the
 * proxy is reachable and the dashboard is correctly authenticated against it.
 * Any failure (network error, timeout, non-2xx, auth failure) is treated as
 * "not running" — which is the only honest answer the indicator can give.
 */
async function probeManagementApi(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${MANAGEMENT_BASE_URL}/config`, {
      headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
    });
    // We only care about `res.ok`, but on Node's undici-based fetch an
    // unconsumed body keeps the underlying socket out of the connection pool
    // until garbage collection. Cancelling the body returns the socket
    // immediately, which matters because this route is polled on a fixed
    // interval per signed-in tab.
    try {
      await res.body?.cancel();
    } catch {
      // Cancellation can race with the response settling; ignore.
    }
    return res.ok;
  } catch (err) {
    logger.debug({ err }, "Management API probe failed");
    return false;
  }
}

/**
 * Best-effort uptime lookup via `docker inspect`. Returns `null` if Docker is
 * unavailable, the container name does not resolve (e.g. Swarm task IDs), or
 * the timestamp cannot be parsed. Never throws — the caller treats `null` as
 * "uptime unknown" and continues to render the liveness indicator.
 */
async function lookupUptimeSeconds(containerName: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      containerName,
      "--format",
      "{{.State.StartedAt}}",
    ]);
    const startedAt = new Date(stdout.trim());
    if (Number.isNaN(startedAt.getTime())) return null;
    const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    return seconds >= 0 ? seconds : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const containerName = getContainerName();
  const isRunning = await probeManagementApi();
  const uptime =
    isRunning && containerName ? await lookupUptimeSeconds(containerName) : null;

  return NextResponse.json({
    running: isRunning,
    containerName,
    uptime,
  });
}

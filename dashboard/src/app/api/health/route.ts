import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const HEALTH_CHECK_TIMEOUT_MS = 5000;

interface HealthStatus {
  status: "ok" | "degraded";
  database: "connected" | "error";
  proxy: "connected" | "error";
}

async function checkDatabase(): Promise<boolean> {
  try {
    const checkPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database check timeout")), HEALTH_CHECK_TIMEOUT_MS);
    });

    await Promise.race([checkPromise, timeoutPromise]);
    return true;
  } catch {
    return false;
  }
}

async function checkProxy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    // Use the root endpoint (/) instead of /v0/management which has no route handler
    // and produces 404 warn spam in cliproxyapi logs every healthcheck interval
    const proxyRoot = env.CLIPROXYAPI_MANAGEMENT_URL.replace(/\/v0\/management\/?$/, "/");
    const response = await fetch(proxyRoot, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  const [databaseHealthy, proxyHealthy] = await Promise.all([
    checkDatabase(),
    checkProxy(),
  ]);

  const healthStatus: HealthStatus = {
    status: databaseHealthy && proxyHealthy ? "ok" : "degraded",
    database: databaseHealthy ? "connected" : "error",
    proxy: proxyHealthy ? "connected" : "error",
  };

  const statusCode = healthStatus.status === "ok" ? 200 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}

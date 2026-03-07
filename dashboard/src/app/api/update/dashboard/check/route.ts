import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { updateCheckCache, CACHE_TTL } from "@/lib/cache";
import { apiSuccess, apiError } from "@/lib/api-response";

const GITHUB_REPO = process.env.GITHUB_REPO || "itsmylife44/cliproxyapi-dashboard";
const DASHBOARD_VERSION = process.env.DASHBOARD_VERSION || "dev";

interface RemoteVersionData {
  version: string;
  tag: string;
  releaseUrl: string;
  releaseNotes: string;
}

interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  buildInProgress: boolean;
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

function parseVersion(tag: string): number[] | null {
  const match = tag.replace(/^.*v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewerVersion(current: string, latest: string): boolean {
  const cur = parseVersion(current);
  const lat = parseVersion(latest);
  if (!cur || !lat) return false;

  for (let i = 0; i < 3; i++) {
    if (lat[i] > cur[i]) return true;
    if (lat[i] < cur[i]) return false;
  }
  return false;
}

async function getRemoteVersion(): Promise<RemoteVersionData | null> {
  const cacheKey = `version-json:${GITHUB_REPO}`;
  const cached = updateCheckCache.get(cacheKey) as RemoteVersionData | null;
  if (cached) return cached;

  const response = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json`,
    {
      headers: {
        "User-Agent": `cliproxyapi-dashboard/${DASHBOARD_VERSION}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }

  const data: RemoteVersionData = await response.json();
  updateCheckCache.set(cacheKey, data, CACHE_TTL.VERSION_CHECK);
  return data;
}

export async function GET() {
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

  try {
    const remote = await getRemoteVersion();

    const latestVersion = remote?.tag ?? DASHBOARD_VERSION;

    const updateAvailable = remote
      ? isNewerVersion(DASHBOARD_VERSION, remote.tag)
      : false;

    const versionInfo: VersionInfo = {
      currentVersion: DASHBOARD_VERSION,
      latestVersion,
      updateAvailable,
      buildInProgress: false,
      availableVersions: remote ? [remote.tag] : [],
      releaseUrl: remote?.releaseUrl ?? null,
      releaseNotes: remote?.releaseNotes?.slice(0, 2000) ?? null,
    };

    return apiSuccess(versionInfo);
  } catch (error) {
    logger.error({ err: error }, "Update check error");
    return apiError("Failed to check for updates", 500);
  }
}

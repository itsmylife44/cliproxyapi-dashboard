import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { updateCheckCache, CACHE_TTL } from "@/lib/cache";

const GITHUB_REPO = process.env.GITHUB_REPO || "itsmylife44/cliproxyapi-dashboard";
const DASHBOARD_VERSION = process.env.DASHBOARD_VERSION || "dev";

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
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

interface GitHubRunsResponse {
  total_count?: number;
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

async function getGitHubReleases(): Promise<GitHubRelease[]> {
  const cacheKey = `github-releases:${GITHUB_REPO}`;
  const cached = updateCheckCache.get(cacheKey) as GitHubRelease[] | null;
  if (cached) return cached;

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `cliproxyapi-dashboard/${DASHBOARD_VERSION}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const releases: GitHubRelease[] = await response.json();
  updateCheckCache.set(cacheKey, releases, CACHE_TTL.GITHUB_RELEASES);
  return releases;
}

async function checkGitHubBuildStatus(): Promise<boolean> {
  const cacheKey = `github-build-status:${GITHUB_REPO}`;
  const cached = updateCheckCache.get(cacheKey) as boolean | null;
  if (cached !== null) return cached;

  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": `cliproxyapi-dashboard/${DASHBOARD_VERSION}`,
    };
    const base = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=1`;

    const [inProgressRes, queuedRes] = await Promise.all([
      fetch(`${base}&status=in_progress`, { cache: "no-store", headers }),
      fetch(`${base}&status=queued`, { cache: "no-store", headers }),
    ]);

    const [inProgressData, queuedData]: GitHubRunsResponse[] = await Promise.all([
      inProgressRes.ok
        ? inProgressRes.json()
        : inProgressRes.body?.cancel().then(() => ({})) ?? Promise.resolve({}),
      queuedRes.ok
        ? queuedRes.json()
        : queuedRes.body?.cancel().then(() => ({})) ?? Promise.resolve({}),
    ]);

    const isBuilding = (inProgressData.total_count ?? 0) > 0 || (queuedData.total_count ?? 0) > 0;
    updateCheckCache.set(cacheKey, isBuilding, CACHE_TTL.GITHUB_BUILD_STATUS);
    return isBuilding;
  } catch {
    return false;
  }
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
    const [releases, buildInProgress] = await Promise.all([
      getGitHubReleases(),
      checkGitHubBuildStatus(),
    ]);

    const stableReleases = releases.filter((r) => !r.prerelease && !r.draft);

    const sortedReleases = stableReleases
      .filter((r) => parseVersion(r.tag_name) !== null)
      .sort((a, b) => {
        const aParts = parseVersion(a.tag_name)!;
        const bParts = parseVersion(b.tag_name)!;
        for (let i = 0; i < 3; i++) {
          if (bParts[i] !== aParts[i]) return bParts[i] - aParts[i];
        }
        return 0;
      });

    const latestRelease = sortedReleases[0] ?? null;
    const latestVersion = latestRelease?.tag_name ?? DASHBOARD_VERSION;

    const updateAvailable = latestRelease
      ? isNewerVersion(DASHBOARD_VERSION, latestRelease.tag_name)
      : false;

    const versionInfo: VersionInfo = {
      currentVersion: DASHBOARD_VERSION,
      latestVersion,
      updateAvailable: buildInProgress ? false : updateAvailable,
      buildInProgress,
      availableVersions: sortedReleases.slice(0, 10).map((r) => r.tag_name),
      releaseUrl: latestRelease?.html_url ?? null,
      releaseNotes: latestRelease?.body?.slice(0, 2000) ?? null,
    };

    return NextResponse.json(versionInfo);
  } catch (error) {
    logger.error({ err: error }, "Update check error");
    return NextResponse.json(
      { error: "Failed to check for updates" },
      { status: 500 }
    );
  }
}

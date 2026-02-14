import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

function parseVersion(tag: string): number[] | null {
  const match = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
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
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
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
    const releases = await getGitHubReleases();

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

    const versionInfo: VersionInfo = {
      currentVersion: DASHBOARD_VERSION,
      latestVersion,
      updateAvailable: latestRelease
        ? isNewerVersion(DASHBOARD_VERSION, latestRelease.tag_name)
        : false,
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

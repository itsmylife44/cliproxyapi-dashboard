import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";
import { updateCheckCache, CACHE_TTL } from "@/lib/cache";

const execFileAsync = promisify(execFile);

interface DockerHubTag {
  name: string;
  last_updated: string;
  digest: string;
}

interface VersionInfo {
  currentVersion: string;
  currentDigest: string;
  latestVersion: string;
  latestDigest: string;
  updateAvailable: boolean;
  buildInProgress: boolean;
  availableVersions: string[];
}

interface GitHubRunsResponse {
  total_count?: number;
}

async function getDockerHubTags(): Promise<DockerHubTag[]> {
  const cacheKey = "docker-hub-tags:eceasy/cli-proxy-api";
  const cached = updateCheckCache.get(cacheKey) as DockerHubTag[] | null;
  if (cached) return cached;

  const response = await fetch(
    "https://hub.docker.com/v2/repositories/eceasy/cli-proxy-api/tags?page_size=20",
    { cache: "no-store" }
  );
  
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Failed to fetch Docker Hub tags");
  }
  
  const data = await response.json();
  const tags: DockerHubTag[] = data.results || [];
  updateCheckCache.set(cacheKey, tags, CACHE_TTL.DOCKER_HUB_TAGS);
  return tags;
}

async function getCurrentImageDigest(): Promise<{ version: string; digest: string; fullDigest: string }> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "cliproxyapi",
      "--format",
      "{{.Config.Image}} {{.Image}}",
    ]);
    
    const [image, fullDigest] = stdout.trim().split(" ");
    const tagVersion = image.includes(":") ? image.split(":")[1] : "latest";
    const cleanDigest = fullDigest.replace("sha256:", "");
    
    return { 
      version: tagVersion, 
      digest: cleanDigest.substring(0, 12),
      fullDigest: cleanDigest 
    };
  } catch {
    return { version: "unknown", digest: "unknown", fullDigest: "unknown" };
  }
}

async function checkGitHubBuildStatus(): Promise<boolean> {
  const cacheKey = "github-build-status:router-for-me/CLIProxyAPI";
  const cached = updateCheckCache.get(cacheKey) as boolean | null;
  if (cached !== null) return cached;

  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "cliproxyapi-dashboard/update-check",
    };
    const base = "https://api.github.com/repos/router-for-me/CLIProxyAPI/actions/runs?per_page=1";

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
    const [tags, current, buildInProgress] = await Promise.all([
      getDockerHubTags(),
      getCurrentImageDigest(),
      checkGitHubBuildStatus(),
    ]);

    const latestTag = tags.find((t) => t.name === "latest");
    const latestDigest = latestTag 
      ? latestTag.digest.replace("sha256:", "").substring(0, 12)
      : "unknown";

    const versionedTags = tags
      .filter((t) => t.name !== "latest" && t.name.startsWith("v"))
      .map((t) => ({ name: t.name, digest: t.digest.replace("sha256:", "") }))
      .sort((a, b) => {
        const aParts = a.name.replace("v", "").split(".").map(Number);
        const bParts = b.name.replace("v", "").split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if ((bParts[i] || 0) !== (aParts[i] || 0)) {
            return (bParts[i] || 0) - (aParts[i] || 0);
          }
        }
        return 0;
      });

    let resolvedCurrentVersion = current.version;
    if (current.version === "latest" && current.fullDigest !== "unknown") {
      const matchingTag = versionedTags.find((t) => 
        t.digest.startsWith(current.fullDigest.substring(0, 12)) ||
        current.fullDigest.startsWith(t.digest.substring(0, 12))
      );
      if (matchingTag) {
        resolvedCurrentVersion = matchingTag.name;
      }
    }

    const versionNames = versionedTags.map((t) => t.name);

    const updateAvailable = latestDigest !== "unknown" && 
      current.digest !== "unknown" && 
      latestDigest !== current.digest;

    const versionInfo: VersionInfo = {
      currentVersion: resolvedCurrentVersion,
      currentDigest: current.digest,
      latestVersion: versionNames[0] || "latest",
      latestDigest,
      updateAvailable: buildInProgress ? false : updateAvailable,
      buildInProgress,
      availableVersions: versionNames.slice(0, 10),
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

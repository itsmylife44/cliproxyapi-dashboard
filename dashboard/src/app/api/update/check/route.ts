import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";

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
  availableVersions: string[];
}

async function getDockerHubTags(): Promise<DockerHubTag[]> {
  const response = await fetch(
    "https://hub.docker.com/v2/repositories/eceasy/cli-proxy-api/tags?page_size=20",
    { next: { revalidate: 60 } }
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch Docker Hub tags");
  }
  
  const data = await response.json();
  return data.results || [];
}

async function getCurrentImageDigest(): Promise<{ version: string; digest: string }> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "cliproxyapi",
      "--format",
      "{{.Config.Image}} {{.Image}}",
    ]);
    
    const [image, digest] = stdout.trim().split(" ");
    const version = image.includes(":") ? image.split(":")[1] : "latest";
    
    return { version, digest: digest.replace("sha256:", "").substring(0, 12) };
  } catch {
    return { version: "unknown", digest: "unknown" };
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
    const [tags, current] = await Promise.all([
      getDockerHubTags(),
      getCurrentImageDigest(),
    ]);

    const latestTag = tags.find((t) => t.name === "latest");
    const latestDigest = latestTag 
      ? latestTag.digest.replace("sha256:", "").substring(0, 12)
      : "unknown";

    const versionedTags = tags
      .filter((t) => t.name !== "latest" && t.name.startsWith("v"))
      .map((t) => t.name)
      .sort((a, b) => {
        const aParts = a.replace("v", "").split(".").map(Number);
        const bParts = b.replace("v", "").split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if ((bParts[i] || 0) !== (aParts[i] || 0)) {
            return (bParts[i] || 0) - (aParts[i] || 0);
          }
        }
        return 0;
      });

    const updateAvailable = latestDigest !== "unknown" && 
      current.digest !== "unknown" && 
      latestDigest !== current.digest;

    const versionInfo: VersionInfo = {
      currentVersion: current.version,
      currentDigest: current.digest,
      latestVersion: versionedTags[0] || "latest",
      latestDigest,
      updateAvailable,
      availableVersions: versionedTags.slice(0, 10),
    };

    return NextResponse.json(versionInfo);
  } catch (error) {
    console.error("Update check error:", error);
    return NextResponse.json(
      { error: "Failed to check for updates" },
      { status: 500 }
    );
  }
}

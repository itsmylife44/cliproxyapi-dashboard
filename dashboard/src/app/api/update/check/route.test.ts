import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const verifySessionMock = vi.fn();
const findUniqueMock = vi.fn();
const execFileMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("child_process", () => ({
  execFile: (
    cmd: string,
    args: string[],
    cb: (err: Error | null, result?: { stdout: string; stderr: string }) => void
  ) => {
    try {
      cb(null, { stdout: String(execFileMock(cmd, args) ?? ""), stderr: "" });
    } catch (err) {
      cb(err as Error);
    }
  },
}));

const HUB_LATEST = "sha256:b98590c9aaaa1111222233334444555566667777888899990000aaaabbbbcccc";
const HUB_OLDER = "sha256:0123456789ab1111222233334444555566667777888899990000aaaabbbbcccc";
const LOCAL_CONFIG_ID = "sha256:ffffeeee0000111122223333444455556666777788889999aaaabbbbccccdddd";

function hubTags(latestDigest: string) {
  return {
    results: [
      { name: "latest", last_updated: "", digest: latestDigest },
      { name: "v6.2.0", last_updated: "", digest: HUB_LATEST },
      { name: "v6.1.0", last_updated: "", digest: HUB_OLDER },
    ],
  };
}

/** Simulates the docker CLI: container inspect returns `.Config.Image .Image`, image inspect returns RepoDigests JSON. */
function mockDocker(configImage: string, imageField: string, repoDigests: string[] | Error) {
  execFileMock.mockImplementation((_cmd: string, args: string[]) => {
    if (args[0] === "inspect") return `${configImage} ${imageField}\n`;
    if (args[0] === "image" && args[1] === "inspect") {
      if (repoDigests instanceof Error) throw repoDigests;
      return `${JSON.stringify(repoDigests)}\n`;
    }
    throw new Error(`unexpected docker call: ${args.join(" ")}`);
  });
}

async function callRoute() {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest("http://localhost/api/update/check"));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/update/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    verifySessionMock.mockResolvedValue({ userId: "admin" });
    findUniqueMock.mockResolvedValue({ isAdmin: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("hub.docker.com")) {
          return new Response(JSON.stringify(hubTags(HUB_LATEST)), { status: 200 });
        }
        return new Response(JSON.stringify({ total_count: 0 }), { status: 200 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports no update on the classic store when RepoDigest matches Hub latest", async () => {
    mockDocker("eceasy/cli-proxy-api:latest", LOCAL_CONFIG_ID, [`eceasy/cli-proxy-api@${HUB_LATEST}`]);

    const { status, body } = await callRoute();

    expect(status).toBe(200);
    expect(body.updateAvailable).toBe(false);
    expect(body.currentDigest).toBe(HUB_LATEST.slice(7, 19));
  });

  it("reports no update on the containerd store (no regression)", async () => {
    mockDocker("eceasy/cli-proxy-api:latest", HUB_LATEST, [`docker.io/eceasy/cli-proxy-api@${HUB_LATEST}`]);

    const { body } = await callRoute();

    expect(body.updateAvailable).toBe(false);
  });

  it("reports an update when the running RepoDigest differs from Hub latest", async () => {
    mockDocker("eceasy/cli-proxy-api:latest", LOCAL_CONFIG_ID, [`eceasy/cli-proxy-api@${HUB_OLDER}`]);

    const { body } = await callRoute();

    expect(body.updateAvailable).toBe(true);
  });

  it("resolves a running latest tag to the versioned tag with the same registry digest", async () => {
    mockDocker("eceasy/cli-proxy-api:latest", LOCAL_CONFIG_ID, [`eceasy/cli-proxy-api@${HUB_OLDER}`]);

    const { body } = await callRoute();

    expect(body.currentVersion).toBe("v6.1.0");
  });

  it("falls back to .Image when the image has no RepoDigests", async () => {
    mockDocker("eceasy/cli-proxy-api:latest", HUB_OLDER, []);

    const { status, body } = await callRoute();

    expect(status).toBe(200);
    expect(body.currentDigest).toBe(HUB_OLDER.slice(7, 19));
    expect(body.updateAvailable).toBe(true);
  });

  it("falls back to .Image when image inspect fails", async () => {
    mockDocker("eceasy/cli-proxy-api:latest", HUB_LATEST, new Error("forbidden"));

    const { status, body } = await callRoute();

    expect(status).toBe(200);
    expect(body.updateAvailable).toBe(false);
  });
});

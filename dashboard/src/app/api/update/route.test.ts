import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

vi.mock("server-only", () => ({}));

const verifySessionMock = vi.fn();
const findUniqueMock = vi.fn();
const dockerMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({ verifySession: verifySessionMock }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin: () => null }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: findUniqueMock } } }));
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
      cb(null, { stdout: String(dockerMock(args) ?? ""), stderr: "" });
    } catch (err) {
      cb(err as Error);
    }
  },
}));

const COMPOSE_LABELS = {
  "com.docker.compose.project": "infrastructure",
  "com.docker.compose.service": "cliproxyapi",
  "com.docker.compose.container-number": "1",
  "com.docker.compose.config-hash": "abc123",
};

function inspectOutput() {
  return JSON.stringify([
    {
      Config: {
        Image: "eceasy/cli-proxy-api:v8.0.29",
        Env: ["TZ=UTC"],
        Labels: { ...COMPOSE_LABELS, "org.opencontainers.image.version": "8.0.29" },
      },
      HostConfig: { Binds: [], PortBindings: {}, RestartPolicy: { Name: "unless-stopped" } },
      NetworkSettings: { Networks: { cliproxyapi_backend: {} } },
    },
  ]);
}

/** Fake docker CLI without the compose plugin, as in the dashboard image. */
function fakeDocker(args: string[]) {
  if (args[0] === "inspect") return inspectOutput();
  if (args[0] === "compose") throw new Error("docker: unknown command: docker compose");
  return "";
}

function runCalls(): string[][] {
  return dockerMock.mock.calls.map(([args]) => args as string[]).filter((args) => args[0] === "run");
}

async function postUpdate(version?: string) {
  const { POST } = await import("./route");
  const res = await POST(
    new NextRequest("http://localhost/api/update", {
      method: "POST",
      body: JSON.stringify({ version, confirm: true }),
    })
  );
  return { status: res.status, body: await res.json() };
}

const ENV_BEFORE = "# stack\nTZ=UTC\nCLIPROXYAPI_IMAGE_TAG=v8.0.29\nJWT_SECRET=s3cret\n";
let envFile: string;

function dockerCalls(): string[][] {
  return dockerMock.mock.calls.map(([args]) => args as string[]);
}

describe("POST /api/update", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    envFile = path.join(await mkdtemp(path.join(tmpdir(), "update-")), ".env");
    await writeFile(envFile, ENV_BEFORE);
    vi.stubEnv("CLIPROXYAPI_HOST_ENV_FILE", envFile);
    verifySessionMock.mockResolvedValue({ userId: "admin" });
    findUniqueMock.mockResolvedValue({ isAdmin: true });
    dockerMock.mockImplementation(fakeDocker);
  });

  it("recreates the container with its compose labels so compose still owns it", async () => {
    const { status } = await postUpdate("v8.0.28");

    expect(status).toBe(200);
    const [run = []] = runCalls();
    for (const [key, value] of Object.entries(COMPOSE_LABELS)) {
      expect(run).toContain(`${key}=${value}`);
      expect(run[run.indexOf(`${key}=${value}`) - 1]).toBe("--label");
    }
    expect(run.join(" ")).not.toContain("org.opencontainers");
    expect(run.at(-1)).toBe("eceasy/cli-proxy-api:v8.0.28");
  });

  it.each([
    ["no version", undefined],
    ["latest", "latest"],
  ])("rejects %s instead of unpinning the image", async (_label, version) => {
    const { status } = await postUpdate(version);

    expect(status).toBe(400);
    expect(dockerCalls()).toEqual([]);
    expect(await readFile(envFile, "utf8")).toBe(ENV_BEFORE);
  });

  it("refuses before touching docker when the host env file is not mounted", async () => {
    vi.stubEnv("CLIPROXYAPI_HOST_ENV_FILE", "/nonexistent/host.env");

    const { status, body } = await postUpdate("v8.0.28");

    expect(status).toBe(409);
    expect(body.error.code).toBe("PROXY_VERSION_PIN_UNAVAILABLE");
    expect(dockerCalls()).toEqual([]);
  });

  it("pins the chosen tag in the env file after pulling it, before recreating", async () => {
    const order: string[] = [];
    dockerMock.mockImplementation((args: string[]) => {
      if (args[0] === "pull" || args[0] === "run") order.push(args[0]);
      return fakeDocker(args);
    });

    const { status } = await postUpdate("v8.0.28");

    expect(status).toBe(200);
    expect(order).toEqual(["pull", "run"]);
    expect(await readFile(envFile, "utf8")).toBe(ENV_BEFORE.replace("v8.0.29", "v8.0.28"));
  });

  it("restores the previous image and env line when the new container fails to start", async () => {
    dockerMock.mockImplementation((args: string[]) => {
      if (args[0] === "run" && args.at(-1) === "eceasy/cli-proxy-api:v8.0.28") {
        throw new Error("port already allocated");
      }
      return fakeDocker(args);
    });

    const { status } = await postUpdate("v8.0.28");

    expect(status).toBe(500);
    expect(runCalls().map((args) => args.at(-1))).toEqual([
      "eceasy/cli-proxy-api:v8.0.28",
      "eceasy/cli-proxy-api:v8.0.29",
    ]);
    expect(await readFile(envFile, "utf8")).toBe(ENV_BEFORE);
  });

  it("leaves the container and env file alone when the pull fails", async () => {
    dockerMock.mockImplementation((args: string[]) => {
      if (args[0] === "pull") throw new Error("manifest unknown");
      return fakeDocker(args);
    });

    const { status } = await postUpdate("v9.9.9");

    expect(status).toBe(500);
    expect(dockerCalls().filter((args) => args[0] === "rm" || args[0] === "run")).toEqual([]);
    expect(await readFile(envFile, "utf8")).toBe(ENV_BEFORE);
  });
});

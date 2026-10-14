import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

async function postUpdate(version: string) {
  const { POST } = await import("./route");
  const res = await POST(
    new NextRequest("http://localhost/api/update", {
      method: "POST",
      body: JSON.stringify({ version, confirm: true }),
    })
  );
  return { status: res.status, body: await res.json() };
}

describe("POST /api/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
});

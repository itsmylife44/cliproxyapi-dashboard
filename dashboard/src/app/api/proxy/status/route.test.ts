import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const verifySessionMock = vi.fn();
const fetchWithTimeoutMock = vi.fn();
const execFileMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/providers/management-api", () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
  MANAGEMENT_BASE_URL: "http://cliproxyapi:8317/v0/management",
  MANAGEMENT_API_KEY: "stub-key",
}));

vi.mock("child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    cb: (
      err: NodeJS.ErrnoException | null,
      result?: { stdout: string; stderr: string }
    ) => void
  ) => {
    try {
      const result = execFileMock(_cmd, _args);
      if (result instanceof Error) {
        cb(result);
        return;
      }
      cb(null, { stdout: String(result ?? ""), stderr: "" });
    } catch (err) {
      cb(err as NodeJS.ErrnoException);
    }
  },
}));

async function importRoute() {
  // Re-import after env mutations so module-scope reads pick up changes.
  return await import("./route");
}

describe("GET /api/proxy/status", () => {
  const originalContainerName = process.env.CLIPROXYAPI_CONTAINER_NAME;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.CLIPROXYAPI_CONTAINER_NAME;
    verifySessionMock.mockResolvedValue({ userId: "test-user" });
  });

  afterEach(() => {
    if (originalContainerName === undefined) {
      delete process.env.CLIPROXYAPI_CONTAINER_NAME;
    } else {
      process.env.CLIPROXYAPI_CONTAINER_NAME = originalContainerName;
    }
  });

  it("returns 401 when there is no session", async () => {
    verifySessionMock.mockResolvedValue(null);
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns running:true when management API responds 2xx and emits uptime when docker inspect works", async () => {
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });
    const startedAt = new Date(Date.now() - 65_000).toISOString();
    execFileMock.mockReturnValue(`${startedAt}\n`);

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.running).toBe(true);
    expect(body.containerName).toBe("cliproxyapi");
    expect(body.uptime).toBeGreaterThanOrEqual(64);
    expect(body.uptime).toBeLessThanOrEqual(70);

    expect(fetchWithTimeoutMock).toHaveBeenCalledWith(
      "http://cliproxyapi:8317/v0/management/config",
      { headers: { Authorization: "Bearer stub-key" } }
    );
  });

  it("drains the response body to release the underlying socket on 2xx", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    fetchWithTimeoutMock.mockResolvedValue({ ok: true, body: { cancel } });
    execFileMock.mockReturnValue(`${new Date().toISOString()}\n`);

    const { GET } = await importRoute();
    await GET();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("drains the response body even on non-2xx so the socket is not leaked", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    fetchWithTimeoutMock.mockResolvedValue({ ok: false, status: 401, body: { cancel } });

    const { GET } = await importRoute();
    await GET();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("tolerates a body.cancel() that rejects (race with response settling)", async () => {
    const cancel = vi.fn().mockRejectedValue(new Error("stream already cancelled"));
    fetchWithTimeoutMock.mockResolvedValue({ ok: true, body: { cancel } });

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(body.running).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("returns running:false when management API responds non-2xx (e.g. bad API key)", async () => {
    fetchWithTimeoutMock.mockResolvedValue({ ok: false, status: 401 });

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      running: false,
      containerName: "cliproxyapi",
      uptime: null,
    });
    // Docker inspect must not be invoked when the proxy is not reachable.
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns running:false when management API throws (timeout, abort, network)", async () => {
    fetchWithTimeoutMock.mockRejectedValue(new Error("AbortError"));

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      running: false,
      containerName: "cliproxyapi",
      uptime: null,
    });
  });

  it("returns running:true with uptime:null when docker inspect fails (Swarm/K8s/no socket)", async () => {
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });
    execFileMock.mockImplementation(() => {
      throw new Error("Error: No such object: cliproxyapi");
    });

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      running: true,
      containerName: "cliproxyapi",
      uptime: null,
    });
  });

  it("returns running:true with uptime:null when docker inspect emits an unparseable timestamp", async () => {
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });
    execFileMock.mockReturnValue("not-a-date\n");

    const { GET } = await importRoute();
    const res = await GET();

    expect(await res.json()).toEqual({
      running: true,
      containerName: "cliproxyapi",
      uptime: null,
    });
  });

  it("clamps negative uptime (clock skew) to null", async () => {
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });
    const futureStart = new Date(Date.now() + 60_000).toISOString();
    execFileMock.mockReturnValue(`${futureStart}\n`);

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(body.running).toBe(true);
    expect(body.uptime).toBeNull();
  });

  it("respects CLIPROXYAPI_CONTAINER_NAME for the uptime lookup only", async () => {
    process.env.CLIPROXYAPI_CONTAINER_NAME = "cliproxyapi-dev-api";
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });
    const startedAt = new Date(Date.now() - 30_000).toISOString();
    execFileMock.mockReturnValue(`${startedAt}\n`);

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(body.containerName).toBe("cliproxyapi-dev-api");
    expect(execFileMock).toHaveBeenCalledWith(
      "docker",
      ["inspect", "cliproxyapi-dev-api", "--format", "{{.State.StartedAt}}"]
    );
    expect(body.running).toBe(true);
  });

  it("treats invalid CLIPROXYAPI_CONTAINER_NAME as cosmetic-only and still answers liveness", async () => {
    process.env.CLIPROXYAPI_CONTAINER_NAME = "bad name with spaces";
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      running: true,
      containerName: null,
      uptime: null,
    });
    // Never attempt docker inspect with an unsanitised name.
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("does not regress on Swarm: liveness is independent of docker name resolution", async () => {
    // Simulate the issue #215 scenario: the configured name is the static
    // service name, but the actual container name is suffixed with a Swarm
    // task ID, so `docker inspect cliproxyapi` fails. The indicator must
    // still go green because the management API responds.
    process.env.CLIPROXYAPI_CONTAINER_NAME = "cliproxyapi";
    fetchWithTimeoutMock.mockResolvedValue({ ok: true });
    execFileMock.mockImplementation(() => {
      throw new Error("Error: No such object: cliproxyapi");
    });

    const { GET } = await importRoute();
    const res = await GET();
    const body = await res.json();

    expect(body.running).toBe(true);
    expect(body.uptime).toBeNull();
  });
});

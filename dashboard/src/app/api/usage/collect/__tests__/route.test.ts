import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import yaml from "js-yaml";

const prismaMock = vi.hoisted(() => ({
  collectorState: {
    upsert: vi.fn(() => Promise.resolve({})),
    updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
  },
  userApiKey: { findMany: vi.fn(() => Promise.resolve([])) },
  providerOAuthOwnership: { findMany: vi.fn(() => Promise.resolve([])) },
  user: { findMany: vi.fn(() => Promise.resolve([])), findUnique: vi.fn() },
  usageRecord: {
    createMany: vi.fn((args: { data: unknown[] }) => Promise.resolve({ count: args.data.length })),
    updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
  },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(() => null) }));
vi.mock("@/lib/api-keys/sync", () => ({
  syncKeysToCliProxyApi: vi.fn(() => Promise.resolve({ ok: true })),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.stubEnv("MANAGEMENT_API_KEY", "mgmt-key");
vi.stubEnv("COLLECTOR_API_KEY", "collector-key");
vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "http://cpa:8317/v0/management");

function queueEntries(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 9, 14, 0, 0, offset + i)).toISOString(),
    auth_index: "idx-1",
    model: "gpt-test",
    source: "src",
    tokens: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  }));
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body), body: { cancel: vi.fn(() => Promise.resolve()) } };
}

/** CLIProxyAPI's config.yaml; PUT replaces it, GET /config reports its retention (upstream default 60). */
let configYaml = "";
let configPuts: string[] = [];
let failConfigPut = false;

function serveConfig(url: string, init?: RequestInit) {
  if (url.endsWith("/config")) {
    const retention = Number((yaml.load(configYaml) as Record<string, unknown>)["redis-usage-queue-retention-seconds"]);
    return Promise.resolve(jsonResponse({ "redis-usage-queue-retention-seconds": retention > 0 ? retention : 60 }));
  }
  if (init?.method === "PUT") {
    configPuts.push(String(init.body));
    if (failConfigPut) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), body: { cancel: vi.fn(() => Promise.resolve()) } });
    configYaml = String(init.body);
    return Promise.resolve(jsonResponse({ ok: true }));
  }
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(configYaml), body: { cancel: vi.fn() } });
}

/** Simulates CLIProxyAPI's drain-on-read queue holding `total` records. */
function serveQueue(total: number) {
  let remaining = queueEntries(total, 0);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/auth-files")) return Promise.resolve(jsonResponse({ files: [] }));
    if (url.includes("/config")) return serveConfig(url, init);
    const count = Number(new URL(url).searchParams.get("count"));
    const batch = remaining.slice(0, count);
    remaining = remaining.slice(count);
    return Promise.resolve(jsonResponse(batch));
  });
  return () => remaining.length;
}

function cronRequest() {
  return new NextRequest("http://localhost/api/usage/collect", {
    method: "POST",
    headers: { authorization: "Bearer collector-key" },
  });
}

describe("POST /api/usage/collect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // the retention check is memoized per process
    configYaml = "port: 8317\nredis-usage-queue-retention-seconds: 3600\n";
    configPuts = [];
    failConfigPut = false;
  });

  it("drains a queue larger than one batch in a single run (620 -> 500 + 120)", async () => {
    const remaining = serveQueue(620);
    const { POST } = await import("../route");

    const res = await POST(cronRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(620);
    expect(body.stored).toBe(620);
    expect(remaining()).toBe(0);
    const queueCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/usage-queue"));
    expect(queueCalls).toHaveLength(2);
  });

  it("keeps already-popped records when a follow-up read fails", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth-files")) return Promise.resolve(jsonResponse({ files: [] }));
      if (url.includes("/config")) return serveConfig(url, init);
      const queueCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/usage-queue"));
      if (queueCalls.length === 1) return Promise.resolve(jsonResponse(queueEntries(500, 0)));
      return Promise.reject(new Error("connection reset"));
    });
    const { POST } = await import("../route");

    const res = await POST(cronRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stored).toBe(500);
  });

  it("stops after one request when the first batch is not full", async () => {
    serveQueue(3);
    const { POST } = await import("../route");

    const res = await POST(cronRequest());
    const body = await res.json();

    expect(body.processed).toBe(3);
    const queueCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/usage-queue"));
    expect(queueCalls).toHaveLength(1);
  });

  describe("usage-queue retention", () => {
    it("raises a retention below 3600 with one config.yaml write, once per process", async () => {
      configYaml = "port: 8317\napi-keys:\n  - sk-a\nredis-usage-queue-retention-seconds: 60\n";
      serveQueue(3);
      const { POST } = await import("../route");

      const first = await (await POST(cronRequest())).json();
      await POST(cronRequest());

      expect(first.processed).toBe(3);
      expect(configPuts).toHaveLength(1);
      expect(yaml.load(configYaml)).toEqual({
        port: 8317,
        "api-keys": ["sk-a"],
        "redis-usage-queue-retention-seconds": 3600,
      });
      const configReads = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/config"));
      expect(configReads).toHaveLength(1);
    });

    it("adds the key at its v8 path on a v8 config", async () => {
      configYaml = "config-version: 8\nobservability:\n  usage:\n    usage-statistics-enabled: true\n";
      serveQueue(0);
      const { POST } = await import("../route");

      await POST(cronRequest());

      expect(yaml.load(configYaml)).toEqual({
        "config-version": 8,
        observability: { usage: { "usage-statistics-enabled": true, "redis-usage-queue-retention-seconds": 3600 } },
      });
    });

    it("never lowers a retention of 3600 or more", async () => {
      configYaml = "redis-usage-queue-retention-seconds: 7200\n";
      serveQueue(0);
      const { POST } = await import("../route");

      await POST(cronRequest());

      expect(configPuts).toHaveLength(0);
      expect(configYaml).toBe("redis-usage-queue-retention-seconds: 7200\n");
    });

    it("keeps collecting when the write fails, and retries on the next run", async () => {
      configYaml = "redis-usage-queue-retention-seconds: 60\n";
      failConfigPut = true;
      serveQueue(3);
      const { POST } = await import("../route");

      const res = await POST(cronRequest());
      await POST(cronRequest());

      expect(res.status).toBe(200);
      expect((await res.json()).processed).toBe(3);
      expect(configPuts).toHaveLength(2);
    });
  });
});

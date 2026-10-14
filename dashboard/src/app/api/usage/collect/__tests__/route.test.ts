import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
  return { ok: true, status: 200, json: () => Promise.resolve(body), body: { cancel: vi.fn() } };
}

/** Simulates CLIProxyAPI's drain-on-read queue holding `total` records. */
function serveQueue(total: number) {
  let remaining = queueEntries(total, 0);
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/auth-files")) return Promise.resolve(jsonResponse({ files: [] }));
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
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/auth-files")) return Promise.resolve(jsonResponse({ files: [] }));
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
});

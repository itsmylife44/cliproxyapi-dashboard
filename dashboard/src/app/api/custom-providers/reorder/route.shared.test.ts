import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: {
    ALLOW_LOCAL_PROVIDER_URLS: false,
    DATABASE_URL: "postgres://",
    JWT_SECRET: "x",
    MANAGEMENT_API_KEY: "x",
    CLIPROXYAPI_MANAGEMENT_URL: "http://proxy/v0/management",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(() => ({ userId: "user-1", username: "alice", sessionVersion: 0 })),
}));

vi.mock("@/lib/auth/origin", () => ({ validateOrigin: vi.fn(() => null) }));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTION: { CUSTOM_PROVIDER_REORDERED: "x" },
  extractIpAddress: vi.fn(() => "127.0.0.1"),
  logAuditAsync: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({ invalidateProxyModelsCache: vi.fn() }));

const adminMock = vi.fn<(userId?: string) => Promise<boolean>>(async () => false);
vi.mock("@/lib/auth/admin", () => ({
  isUserAdmin: (userId: string) => adminMock(userId),
}));

const findManyMock = vi.fn<(arg?: unknown) => unknown>();
const txMock = vi.fn<(ops: unknown) => Promise<unknown>>(async () => undefined);

vi.mock("@/lib/db", () => ({
  prisma: {
    customProvider: {
      findMany: (arg?: unknown) => findManyMock(arg),
      update: vi.fn(() => ({})),
    },
    $transaction: (ops: unknown) => txMock(ops),
  },
}));

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ "openai-compatibility": [] }), { status: 200 }));
vi.stubGlobal("fetch", fetchMock);

function buildRequest(providerIds: string[]): NextRequest {
  return new NextRequest("http://localhost/api/custom-providers/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerIds }),
  });
}

describe("PUT /api/custom-providers/reorder (shared/admin scope)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.mockResolvedValue(false);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ "openai-compatibility": [] }), { status: 200 })
    );
  });

  async function callPut(ids: string[]) {
    const { PUT } = await import("./route");
    return PUT(buildRequest(ids));
  }

  it("queries only the viewer's own providers when not admin", async () => {
    findManyMock.mockResolvedValue([
      { id: "p1", providerId: "a", userId: "user-1", isShared: false },
    ]);
    const res = await callPut(["p1"]);
    expect(res.status).toBe(200);
    const arg = findManyMock.mock.calls[0]?.[0] as { where: { OR?: unknown[] } };
    expect(arg.where.OR).toEqual([
      { userId: "user-1" },
      { isShared: true },
    ]);
  });

  it("rejects 403 when a non-admin includes a shared provider owned by someone else", async () => {
    findManyMock.mockResolvedValue([
      { id: "p1", providerId: "a", userId: "user-1", isShared: false },
      { id: "p2", providerId: "b", userId: "user-2", isShared: true },
    ]);
    const res = await callPut(["p1", "p2"]);
    expect(res.status).toBe(403);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("admins can reorder providers regardless of ownership", async () => {
    adminMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([
      { id: "p1", providerId: "a", userId: "user-1", isShared: false },
      { id: "p2", providerId: "b", userId: "user-2", isShared: true },
    ]);
    const res = await callPut(["p2", "p1"]);
    expect(res.status).toBe(200);
    const arg = findManyMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where.OR).toBeUndefined();
    expect(arg.where).toMatchObject({ id: { in: ["p2", "p1"] } });
    expect(txMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when an unknown provider id is submitted", async () => {
    findManyMock.mockResolvedValue([
      { id: "p1", providerId: "a", userId: "user-1", isShared: false },
    ]);
    const res = await callPut(["p1", "p2-missing"]);
    expect(res.status).toBe(400);
  });

  it("rejects duplicate ids", async () => {
    const res = await callPut(["p1", "p1"]);
    expect(res.status).toBe(400);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

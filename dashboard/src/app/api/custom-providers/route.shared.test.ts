import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: { ALLOW_LOCAL_PROVIDER_URLS: false, DATABASE_URL: "postgres://", JWT_SECRET: "x", MANAGEMENT_API_KEY: "x" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(() => ({ userId: "user-1", username: "alice", sessionVersion: 0 })),
}));

vi.mock("@/lib/auth/origin", () => ({
  validateOrigin: vi.fn(() => null),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimitWithPreset: vi.fn(() => ({ allowed: true })),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTION: { CUSTOM_PROVIDER_CREATED: "x" },
  extractIpAddress: vi.fn(() => "127.0.0.1"),
  logAuditAsync: vi.fn(),
}));

vi.mock("@/lib/providers/hash", () => ({ hashProviderKey: vi.fn(() => "hash") }));
vi.mock("@/lib/providers/encrypt", () => ({ encryptProviderKey: vi.fn(() => "enc") }));
vi.mock("@/lib/providers/custom-provider-sync", () => ({
  syncCustomProviderToProxy: vi.fn(async () => ({ syncStatus: "ok" as const, syncMessage: "" })),
}));

const adminMock = vi.fn<(userId?: string) => Promise<boolean>>(async () => false);
vi.mock("@/lib/auth/admin", () => ({
  isUserAdmin: (userId: string) => adminMock(userId),
}));

const findManyMock = vi.fn<(arg?: unknown) => unknown>();
const findFirstMock = vi.fn<(arg?: unknown) => unknown>();
const findUniqueMock = vi.fn<(arg?: unknown) => unknown>();
const createMock = vi.fn<(arg?: unknown) => unknown>();

vi.mock("@/lib/db", () => ({
  prisma: {
    customProvider: {
      findMany: (arg?: unknown) => findManyMock(arg),
      findFirst: (arg?: unknown) => findFirstMock(arg),
      findUnique: (arg?: unknown) => findUniqueMock(arg),
      create: (arg?: unknown) => createMock(arg),
    },
  },
}));

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/custom-providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/custom-providers (shared providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.mockResolvedValue(false);
  });

  it("filters with OR clause that includes shared providers", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");
    await GET();
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(arg.where.OR).toEqual([
      { userId: "user-1" },
      { isShared: true },
    ]);
  });

  it("returns isOwn=false and ownerUsername for shared providers from other users", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "p1",
        userId: "user-2",
        name: "z.ai",
        providerId: "zai",
        baseUrl: "https://api.z.ai",
        prefix: null,
        proxyUrl: null,
        groupId: null,
        sortOrder: 0,
        headers: {},
        models: [],
        excludedModels: [],
        apiKeyEncrypted: "enc",
        isShared: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user-2", username: "admin" },
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0]).toMatchObject({
      providerId: "zai",
      isShared: true,
      isOwn: false,
      ownerId: "user-2",
      ownerUsername: "admin",
    });
  });

  it("returns isOwn=true for the user's own providers", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "p2",
        userId: "user-1",
        name: "my-openrouter",
        providerId: "or-1",
        baseUrl: "https://openrouter.ai/api/v1",
        prefix: null,
        proxyUrl: null,
        groupId: null,
        sortOrder: 0,
        headers: {},
        models: [],
        excludedModels: [],
        apiKeyEncrypted: "enc",
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user-1", username: "alice" },
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.providers[0]).toMatchObject({ isShared: false, isOwn: true });
  });
});

describe("POST /api/custom-providers (isShared admin gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.mockResolvedValue(false);
    findFirstMock.mockResolvedValue(null);
    findUniqueMock.mockResolvedValue(null);
  });

  const validBody = {
    name: "x",
    providerId: "x-id",
    baseUrl: "https://example.com/v1",
    apiKey: "k",
    models: [{ upstreamName: "m", alias: "m" }],
  };

  it("rejects isShared=true for non-admins with 403", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ ...validBody, isShared: true }));
    expect(res.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepts isShared=true for admins and persists the flag", async () => {
    adminMock.mockResolvedValue(true);
    createMock.mockResolvedValue({
      id: "new",
      providerId: "x-id",
      prefix: null,
      baseUrl: "https://example.com/v1",
      proxyUrl: null,
      headers: {},
      models: [],
      excludedModels: [],
    });
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ ...validBody, isShared: true }));
    expect(res.status).toBe(201);
    const arg = createMock.mock.calls[0]?.[0] as { data: { isShared: boolean } };
    expect(arg.data.isShared).toBe(true);
  });

  it("defaults isShared to false when omitted", async () => {
    createMock.mockResolvedValue({
      id: "new",
      providerId: "x-id",
      prefix: null,
      baseUrl: "https://example.com/v1",
      proxyUrl: null,
      headers: {},
      models: [],
      excludedModels: [],
    });
    const { POST } = await import("./route");
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(201);
    const arg = createMock.mock.calls[0]?.[0] as { data: { isShared: boolean } };
    expect(arg.data.isShared).toBe(false);
  });
});

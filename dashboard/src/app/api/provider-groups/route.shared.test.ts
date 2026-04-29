import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: {
    ALLOW_LOCAL_PROVIDER_URLS: false,
    DATABASE_URL: "postgres://",
    JWT_SECRET: "x",
    MANAGEMENT_API_KEY: "x",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(() => ({ userId: "user-1", username: "alice", sessionVersion: 0 })),
}));

vi.mock("@/lib/auth/origin", () => ({ validateOrigin: vi.fn(() => null) }));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimitWithPreset: vi.fn(() => ({ allowed: true })),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTION: { PROVIDER_GROUP_CREATED: "x" },
  extractIpAddress: vi.fn(() => "127.0.0.1"),
  logAuditAsync: vi.fn(),
}));

const groupFindManyMock = vi.fn<(arg?: unknown) => unknown>();
const customFindManyMock = vi.fn<(arg?: unknown) => unknown>();

vi.mock("@/lib/db", () => ({
  prisma: {
    providerGroup: { findMany: (arg?: unknown) => groupFindManyMock(arg) },
    customProvider: { findMany: (arg?: unknown) => customFindManyMock(arg) },
  },
}));

const ownProvider = {
  id: "p-own",
  userId: "user-1",
  name: "my-provider",
  providerId: "mine",
  baseUrl: "https://mine.example.com",
  prefix: null,
  proxyUrl: null,
  groupId: null,
  sortOrder: 0,
  headers: {},
  apiKeyHash: "hash",
  apiKeyEncrypted: "enc",
  isShared: false,
  models: [],
  excludedModels: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: "user-1", username: "alice" },
};

const sharedUngrouped = {
  ...ownProvider,
  id: "p-shared-ungrouped",
  userId: "user-2",
  name: "z.ai",
  providerId: "zai",
  isShared: true,
  user: { id: "user-2", username: "admin" },
};

const sharedInOwnersGroup = {
  ...sharedUngrouped,
  id: "p-shared-grouped",
  groupId: "group-belonging-to-admin",
  sortOrder: 5,
};

describe("GET /api/provider-groups (shared providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupFindManyMock.mockResolvedValue([]);
  });

  async function callGet() {
    const { GET } = await import("./route");
    return GET();
  }

  it("issues three queries: viewer's groups, shared-in-others-groups, ungrouped", async () => {
    customFindManyMock.mockResolvedValue([]);
    await callGet();
    expect(groupFindManyMock).toHaveBeenCalledTimes(1);
    expect(customFindManyMock).toHaveBeenCalledTimes(2);
    const sharedGroupedArg = customFindManyMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(sharedGroupedArg.where).toMatchObject({
      isShared: true,
      groupId: { not: null },
      userId: { not: "user-1" },
    });
    const ungroupedArg = customFindManyMock.mock.calls[1]?.[0] as { where: { OR: unknown[] } };
    expect(ungroupedArg.where.OR).toEqual([
      { userId: "user-1", groupId: null },
      { isShared: true, groupId: null, userId: { not: "user-1" } },
    ]);
  });

  it("returns shared providers placed in their owner's group as ungrouped", async () => {
    customFindManyMock.mockResolvedValueOnce([sharedInOwnersGroup]).mockResolvedValueOnce([]);
    const res = await callGet();
    const body = await res.json();
    expect(body.ungrouped).toHaveLength(1);
    expect(body.ungrouped[0]).toMatchObject({
      providerId: "zai",
      isShared: true,
      isOwn: false,
      ownerUsername: "admin",
      groupId: null,
    });
  });

  it("includes ownership metadata for own ungrouped providers", async () => {
    customFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([ownProvider]);
    const res = await callGet();
    const body = await res.json();
    expect(body.ungrouped[0]).toMatchObject({
      providerId: "mine",
      isShared: false,
      isOwn: true,
      ownerUsername: "alice",
    });
  });

  it("does not return shared providers from the viewer themselves twice", async () => {
    const ownAndShared = { ...ownProvider, isShared: true };
    customFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([ownAndShared]);
    const res = await callGet();
    const body = await res.json();
    expect(body.ungrouped).toHaveLength(1);
    expect(body.ungrouped[0]).toMatchObject({ isOwn: true, isShared: true });
  });

  it("emits Shared/isOwn/ownerUsername fields on grouped providers", async () => {
    groupFindManyMock.mockResolvedValueOnce([
      {
        id: "g1",
        userId: "user-1",
        name: "my-group",
        sortOrder: 0,
        isActive: true,
        providers: [ownProvider],
      },
    ]);
    customFindManyMock.mockResolvedValue([]);
    const res = await callGet();
    const body = await res.json();
    expect(body.groups[0].providers[0]).toMatchObject({
      isShared: false,
      isOwn: true,
      ownerId: "user-1",
      ownerUsername: "alice",
    });
  });
});

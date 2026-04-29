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
  AUDIT_ACTION: { CUSTOM_PROVIDER_UPDATED: "x", CUSTOM_PROVIDER_DELETED: "y" },
  extractIpAddress: vi.fn(() => "127.0.0.1"),
  logAuditAsync: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({ invalidateProxyModelsCache: vi.fn() }));
vi.mock("@/lib/providers/hash", () => ({ hashProviderKey: vi.fn(() => "hash") }));
vi.mock("@/lib/providers/encrypt", () => ({
  encryptProviderKey: vi.fn(() => "enc"),
  decryptProviderKey: vi.fn(() => "decrypted"),
}));
vi.mock("@/lib/providers/custom-provider-sync", () => ({
  syncCustomProviderToProxy: vi.fn(async () => ({ syncStatus: "ok" as const, syncMessage: "" })),
}));

const adminMock = vi.fn<(userId?: string) => Promise<boolean>>(async () => false);
vi.mock("@/lib/auth/admin", () => ({
  isUserAdmin: (userId: string) => adminMock(userId),
}));

const findUniqueMock = vi.fn<(arg?: unknown) => unknown>();
const findFirstMock = vi.fn<(arg?: unknown) => unknown>();
const updateMock = vi.fn<(arg?: unknown) => unknown>();
const deleteMock = vi.fn<(arg?: unknown) => unknown>();
const txUpdate = vi.fn<(arg?: unknown) => unknown>();
const txDeleteMany = vi.fn<(arg?: unknown) => unknown>();

vi.mock("@/lib/db", () => ({
  prisma: {
    customProvider: {
      findUnique: (arg?: unknown) => findUniqueMock(arg),
      findFirst: (arg?: unknown) => findFirstMock(arg),
      update: (arg?: unknown) => updateMock(arg),
      delete: (arg?: unknown) => deleteMock(arg),
    },
    providerGroup: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: unknown) => {
      const fn = cb as (tx: unknown) => Promise<unknown>;
      return fn({
        customProviderModel: { deleteMany: txDeleteMany },
        customProviderExcludedModel: { deleteMany: txDeleteMany },
        customProvider: { update: txUpdate },
      });
    }),
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function buildPatch(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/custom-providers/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseProvider = {
  id: "p1",
  userId: "user-2", // Owned by someone else
  name: "z.ai",
  providerId: "zai",
  baseUrl: "https://api.z.ai",
  prefix: null,
  proxyUrl: null,
  groupId: null,
  headers: {},
  apiKeyHash: "hash",
  apiKeyEncrypted: "enc",
  isShared: true,
  models: [],
  excludedModels: [],
};

describe("PATCH /api/custom-providers/[id] (shared admin gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.mockResolvedValue(false);
    findUniqueMock.mockResolvedValue(baseProvider);
    txUpdate.mockResolvedValue({ ...baseProvider, models: [], excludedModels: [] });
  });

  async function callPatch(body: unknown) {
    const { PATCH } = await import("./route");
    return PATCH(buildPatch(body), {
      params: Promise.resolve({ id: "p1" }),
    });
  }

  it("rejects non-owner non-admin with 403", async () => {
    const res = await callPatch({ name: "renamed" });
    expect(res.status).toBe(403);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("allows admin to edit a shared provider owned by someone else", async () => {
    adminMock.mockResolvedValue(true);
    const res = await callPatch({ name: "renamed-by-admin" });
    expect(res.status).toBe(200);
  });

  it("rejects non-admin attempting to flip isShared", async () => {
    findUniqueMock.mockResolvedValue({ ...baseProvider, userId: "user-1", isShared: false });
    const res = await callPatch({ isShared: true });
    expect(res.status).toBe(403);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("allows admin to flip isShared", async () => {
    adminMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ ...baseProvider, userId: "user-1", isShared: false });
    const res = await callPatch({ isShared: true });
    expect(res.status).toBe(200);
    const updateArg = txUpdate.mock.calls[0]?.[0] as { data: { isShared?: boolean } };
    expect(updateArg.data.isShared).toBe(true);
  });

  it("ignores isShared when value matches existing flag (no admin needed)", async () => {
    findUniqueMock.mockResolvedValue({ ...baseProvider, userId: "user-1", isShared: false });
    const res = await callPatch({ isShared: false });
    expect(res.status).toBe(200);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_A_KEY = "sk-user-a-secret";
const PLACEHOLDER = "no-api-key-create-one-in-dashboard";

const mocks = vi.hoisted(() => ({
  fetchWithRetry: vi.fn(),
  userApiKeyFindFirst: vi.fn(),
}));

vi.mock("@/lib/fetch-utils", () => ({ fetchWithRetry: mocks.fetchWithRetry }));
vi.mock("@/lib/db", () => ({
  prisma: {
    modelPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    agentModelOverride: { findUnique: vi.fn().mockResolvedValue(null) },
    configSubscription: { findUnique: vi.fn().mockResolvedValue(null) },
    customProvider: { findMany: vi.fn().mockResolvedValue([]) },
    userApiKey: {
      findFirst: mocks.userApiKeyFindFirst,
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));
vi.mock("@/lib/config-generators/opencode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config-generators/opencode")>()),
  fetchModelsDevLimits: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/config-generators/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config-generators/shared")>()),
  fetchProxyModels: vi.fn().mockResolvedValue([]),
}));

import { generateConfigBundle } from "../generate-bundle";

// userApiKey rows in the DB: only user A owns a key.
const rows = [{ id: "key-a", userId: "user-a", key: USER_A_KEY, createdAt: new Date(0) }];

function matches(where: Record<string, unknown>, row: (typeof rows)[number]) {
  return Object.entries(where).every(([k, v]) => row[k as keyof typeof row] === v);
}

function bundleApiKey(bundle: Awaited<ReturnType<typeof generateConfigBundle>>) {
  const provider = bundle.opencode.provider as Record<string, { options: { apiKey: string } }>;
  return provider.cliproxyapi?.options.apiKey;
}

describe("generateConfigBundle API key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The management API lists every user's key instance-wide.
    mocks.fetchWithRetry.mockImplementation(async (url: string) =>
      Response.json(url.endsWith("/api-keys") ? { "api-keys": [USER_A_KEY] } : {})
    );
    mocks.userApiKeyFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((row) => matches(where, row)) ?? null
    );
  });

  it("uses the placeholder, never another user's key, when the caller owns no key", async () => {
    const bundle = await generateConfigBundle("user-b");

    expect(bundleApiKey(bundle)).toBe(PLACEHOLDER);
    expect(JSON.stringify(bundle)).not.toContain(USER_A_KEY);
  });

  it("does not resolve a sync API key id that belongs to another user", async () => {
    await expect(generateConfigBundle("user-b", "key-a")).rejects.toThrow(/sync token/);
  });
});

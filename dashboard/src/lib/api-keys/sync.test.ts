import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findKeys, findUsage, getPricing } = vi.hoisted(() => ({
  findKeys: vi.fn(), findUsage: vi.fn(), getPricing: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/db", () => ({ prisma: { userApiKey: { findMany: findKeys }, usageRecord: { findMany: findUsage } } }));
vi.mock("@/lib/management-url", () => ({ getManagementUrl: () => "https://management.example.test" }));
vi.mock("@/lib/model-pricing-catalog", () => ({ getLiveModelPricing: getPricing }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { getApiKeyUsageSummaries, invalidateApiKeyUsageCache, syncKeysToCliProxyApi } from "./sync";

const livePricing = {
  "quota-test-model": {
    displayName: "Test model", inputPer1M: 1, outputPer1M: 0,
    longContext: { thresholdTokens: 200_000, inputPer1M: 10, outputPer1M: 0 },
  },
};
const request = {
  apiKeyId: "key-id", model: "quota-test-model", timestamp: new Date("2026-11-28T12:00:00Z"),
  inputTokens: 300_000, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0,
};
const fetchManagement = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetAllMocks();
  invalidateApiKeyUsageCache();
  vi.stubEnv("MANAGEMENT_API_KEY", "test-management-key");
  vi.stubGlobal("fetch", fetchManagement);
  fetchManagement.mockImplementation(async () => new Response(null, { status: 204 }));
  getPricing.mockResolvedValue(livePricing);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function syncedKeys(): string[] {
  return JSON.parse(String(fetchManagement.mock.lastCall?.[1]?.body));
}

describe("API key spend enforcement", () => {
  it("revokes a key whose long-context cost crossed its limit and keeps authentication enabled", async () => {
    findKeys.mockResolvedValue([{ id: "key-id", key: "user-key", isActive: true, expiresAt: null, spendLimit: 2 }]);
    findUsage.mockResolvedValue([request]);
    expect(await syncKeysToCliProxyApi()).toEqual({ ok: true, keysCount: 0 });
    expect(syncedKeys()).toEqual([expect.any(String)]);
    expect(syncedKeys()).not.toContain("user-key");

    findKeys.mockResolvedValue([]);
    expect(await syncKeysToCliProxyApi()).toEqual({ ok: true, keysCount: 0 });
    expect(syncedKeys()).toEqual([expect.any(String)]);
  });

  it("recalculates a previously unpriced key when live pricing arrives", async () => {
    findUsage.mockResolvedValue([request]);
    getPricing.mockResolvedValueOnce({});
    expect((await getApiKeyUsageSummaries(["key-id"])).get("key-id")?.totalSpend).toBe(0);
    expect((await getApiKeyUsageSummaries(["key-id"])).get("key-id")?.totalSpend).toBeCloseTo(3);
  });

  it("does not let an older in-flight query overwrite spend after collection", async () => {
    const started = Promise.withResolvers<void>();
    const pending = Promise.withResolvers<[]>();
    findUsage.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    }).mockResolvedValue([request]);

    const oldRead = getApiKeyUsageSummaries(["key-id"]);
    await started.promise;
    invalidateApiKeyUsageCache(["key-id"]);
    expect((await getApiKeyUsageSummaries(["key-id"])).get("key-id")?.totalSpend).toBeCloseTo(3);
    pending.resolve([]);
    await oldRead;
    expect((await getApiKeyUsageSummaries(["key-id"])).get("key-id")?.totalSpend).toBeCloseTo(3);
  });
});

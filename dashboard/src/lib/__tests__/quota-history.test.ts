import { beforeEach, describe, expect, it, vi } from "vitest";

const { snapshotFindMany, snapshotCreateMany, snapshotDeleteMany, usageFindMany } = vi.hoisted(() => ({
  snapshotFindMany: vi.fn(),
  snapshotCreateMany: vi.fn(),
  snapshotDeleteMany: vi.fn(),
  usageFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    quotaSnapshot: {
      findMany: snapshotFindMany,
      createMany: snapshotCreateMany,
      deleteMany: snapshotDeleteMany,
    },
    usageRecord: {
      // Fixtures omit token columns whose database default is 0.
      findMany: async (...args: unknown[]) =>
        ((await usageFindMany(...args)) as object[]).map((row) => ({ reasoningTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0, totalTokens: 0, ...row })),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/model-pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/model-pricing")>();
  return {
    ...actual,
    DEFAULT_MODEL_PRICING: {
      "gemini-2.5-pro": { displayName: "Gemini 2.5 Pro", inputPer1M: 1000, outputPer1M: 2000 },
      "gemini-argon": { displayName: "Gemini Argon", inputPer1M: 1000, outputPer1M: 2000 },
      "gpt-6.1-sol": { displayName: "GPT 6.1 Sol", inputPer1M: 1000, outputPer1M: 2000 },
      "gpt-6.1-terra": { displayName: "GPT 6.1 Terra", inputPer1M: 1000, outputPer1M: 2000 },
      "gpt-5.6-luna": { displayName: "GPT 5.6 Luna", inputPer1M: 1000, outputPer1M: 2000 },
      "claude-opus-5-5-high": { displayName: "Claude Opus 5.5", inputPer1M: 1000, outputPer1M: 2000 },
    },
  };
});

import { quotaHistoryCache } from "@/lib/cache";
import { getAccountQuotaHistory, getAccountsQuotaHistory, recordQuotaSnapshots } from "../quota/quota-history";

describe("quota history multi-account batching and independent caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaHistoryCache.invalidateAll();
  });
  it("does not assign pre-reset usage to a replenished quota window", async () => {
    const start = new Date("2026-11-10T10:00:00Z");
    const end = new Date("2026-11-10T11:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "reset", groupId: "window", modelId: "", remaining: 0, resetTime: end, capturedAt: start },
      { authIndex: "reset", groupId: "window", modelId: "", remaining: 1, resetTime: new Date("2026-11-10T16:00:00Z"), capturedAt: end },
    ]);
    usageFindMany.mockResolvedValueOnce([{ authIndex: "reset", model: "gemini-2.5-pro", inputTokens: 1000000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:30:00Z") }]);
    const history = await getAccountQuotaHistory("reset");
    expect(history.windows.window?.estimatedFullWindowUsd).toBeNull();
    expect(history.models.every((model) => model.observedDelta === 0 && model.observedUsageUsd === 0)).toBe(true);
  });

  it("attributes first usage of an untouched window whose rolling reset time drifts", async () => {
    // Antigravity reports now+5h as the reset of an unused window; first use anchors it.
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "ag", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "", remaining: 1, resetTime: new Date("2026-11-13T12:40:30Z"), capturedAt: new Date("2026-11-13T07:40:30Z") },
      { authIndex: "ag", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "", remaining: 0.75, resetTime: new Date("2026-11-13T12:41:40Z"), capturedAt: new Date("2026-11-13T07:43:52Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([{ authIndex: "ag", model: "claude-opus-5-5-high", inputTokens: 1000000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-13T07:41:38Z") }]);
    const history = await getAccountQuotaHistory("ag");
    expect(history.windows["claude-gpt-5h"]?.estimatedFullWindowUsd).toBeCloseTo(4000);
  });

  it("prices Antigravity Claude cache reads without charging them as uncached input", async () => {
    const pricing = {
      "claude-opus-5-5": { displayName: "Opus", inputPer1M: 4, cacheReadPer1M: 0.2, outputPer1M: 20, cacheAccounting: "separate" as const, provider: "Anthropic" },
    };
    const resetTime = new Date("2026-11-13T12:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "ag-cache", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "", remaining: 1, resetTime, capturedAt: new Date("2026-11-13T07:00:00Z") },
      { authIndex: "ag-cache", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "", remaining: 0.5, resetTime, capturedAt: new Date("2026-11-13T08:00:00Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([{ authIndex: "ag-cache", model: "claude-opus-5-5-high", inputTokens: 1_000_000, cachedTokens: 900_000, outputTokens: 10_000, timestamp: new Date("2026-11-13T07:30:00Z") }]);
    const history = await getAccountQuotaHistory("ag-cache", pricing);
    expect(history.windows["claude-gpt-5h"]?.estimatedFullWindowUsd).toBeCloseTo(1.56);
  });

  it("prices native Claude 5-minute and 1-hour cache writes", async () => {
    const pricing = {
      "claude-opus-5-5": { displayName: "Opus", inputPer1M: 4, cacheReadPer1M: 0.2, outputPer1M: 20, cacheAccounting: "separate" as const, provider: "Anthropic" },
    };
    const resetTime = new Date("2026-11-13T12:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "claude-cache", provider: "claude", groupId: "five-hour", modelId: "", remaining: 1, resetTime, capturedAt: new Date("2026-11-13T07:00:00Z") },
      { authIndex: "claude-cache", provider: "claude", groupId: "five-hour", modelId: "", remaining: 0.5, resetTime, capturedAt: new Date("2026-11-13T08:00:00Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([{ authIndex: "claude-cache", model: "claude-opus-5-5", inputTokens: 100_000, cachedTokens: 900_000, cacheWriteTokens: 200_000, cacheWrite1hTokens: 100_000, outputTokens: 10_000, reasoningTokens: 0, totalTokens: 1_210_000, timestamp: new Date("2026-11-13T07:30:00Z") }]);
    const history = await getAccountQuotaHistory("claude-cache", pricing);
    // 0.4 input + 0.18 read + 0.5 5m write + 0.8 1h write + 0.2 output = 2.08, at 50% depletion
    expect(history.windows["five-hour"]?.estimatedFullWindowUsd).toBeCloseTo(4.16);
  });

  it("retains last qualifying estimate across reset until >=2% depletion, tracks previous full window, keeps unused models independent, excludes Argon from Gemini 5h, and orders models descending", async () => {
    const t0 = new Date("2026-11-10T08:00:00Z");
    const t1 = new Date("2026-11-10T09:00:00Z");
    const t2 = new Date("2026-11-10T10:00:00Z");
    const t2Reset = new Date("2026-11-10T10:01:00Z");
    const t3 = new Date("2026-11-10T11:00:00Z");
    const t4 = new Date("2026-11-10T12:00:00Z");
    const reset1 = new Date("2026-11-10T10:30:00Z");
    const reset2 = new Date("2026-11-10T15:00:00Z");

    snapshotFindMany.mockResolvedValueOnce([
      // Window 1: Terra depletes 10% ($2 -> $20 full), then Sol depletes 10% ($2 -> $20 full)
      { authIndex: "codex-acc", provider: "codex", groupId: "primary-window", modelId: "", remaining: 1.0, resetTime: reset1, capturedAt: t0 },
      { authIndex: "codex-acc", provider: "codex", groupId: "primary-window", modelId: "", remaining: 0.9, resetTime: reset1, capturedAt: t1 },
      { authIndex: "codex-acc", provider: "codex", groupId: "primary-window", modelId: "", remaining: 0.8, resetTime: reset1, capturedAt: t2 },
      // Reset to 1.0, then <2% Sol depletion (1% for $0.30) -> must retain $20
      { authIndex: "codex-acc", provider: "codex", groupId: "primary-window", modelId: "", remaining: 1.0, resetTime: reset2, capturedAt: t2Reset },
      { authIndex: "codex-acc", provider: "codex", groupId: "primary-window", modelId: "", remaining: 0.99, resetTime: reset2, capturedAt: t3 },
      // Reaching >=2% total Sol depletion in new window (10% total for $2.50 -> $25 full, previous = $20)
      { authIndex: "codex-acc", provider: "codex", groupId: "primary-window", modelId: "", remaining: 0.9, resetTime: reset2, capturedAt: t4 },
      // Gemini 5h window with only Argon usage -> Argon must not inflate gemini-5h
      { authIndex: "codex-acc", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset2, capturedAt: t0 },
      { authIndex: "codex-acc", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.5, resetTime: reset2, capturedAt: t1 },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "codex-acc", model: "gpt-6.1-terra", inputTokens: 2_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T08:30:00Z") },
      { authIndex: "codex-acc", model: "gemini-argon", inputTokens: 50_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T08:30:00Z") },
      { authIndex: "codex-acc", model: "gpt-6.1-sol", inputTokens: 2_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T09:30:00Z") },
      { authIndex: "codex-acc", model: "gpt-6.1-sol", inputTokens: 300, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:30:00Z") },
      { authIndex: "codex-acc", model: "gpt-6.1-sol", inputTokens: 2_200, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T11:30:00Z") },
      { authIndex: "codex-acc", model: "gpt-5.6-luna", inputTokens: 100, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-01T00:00:00Z") },
    ]);

    const history = await getAccountQuotaHistory("codex-acc");
    expect(history.windows["primary-window"]?.estimatedFullWindowUsd).toBeCloseTo(25);
    expect(history.windows["primary-window"]?.previousEstimatedFullWindowUsd).toBeCloseTo(20);
    expect(history.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeNull();

    const primaryModels = history.models.filter((m) => m.groupId === "primary-window");
    expect(primaryModels.map((m) => m.modelId)).toEqual(["gpt-6.1-sol", "gpt-6.1-terra"]);
    expect(primaryModels[0]?.estimatedFullWindowUsd).toBeCloseTo(25);
    expect(primaryModels[0]?.previousEstimatedFullWindowUsd).toBeCloseTo(20);
    expect(primaryModels[1]?.estimatedFullWindowUsd).toBeCloseTo(20);
    expect(primaryModels[1]?.previousEstimatedFullWindowUsd).toBeNull();
  });


  it("batches DB queries across uncached accounts, caches each independently, and invalidates only changed accounts", async () => {
    const t0 = new Date("2026-11-10T10:00:00Z");
    const t1 = new Date("2026-11-10T11:00:00Z");
    const reset = new Date("2026-11-10T15:00:00Z");

    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "acc-1", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: t0 },
      { authIndex: "acc-1", groupId: "gemini-5h", modelId: "", remaining: 0.5, resetTime: reset, capturedAt: t1 },
      { authIndex: "acc-2", groupId: "gemini-5h", modelId: "", remaining: 0.8, resetTime: reset, capturedAt: t0 },
    ]);
    usageFindMany.mockResolvedValueOnce([
      {
        authIndex: "acc-1",
        model: "gemini-2.5-pro",
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedTokens: 0,
        timestamp: new Date("2026-11-10T10:30:00Z"),
      },
    ]);

    const firstBatch = await getAccountsQuotaHistory(["acc-1", "acc-2"]);
    expect(snapshotFindMany).toHaveBeenCalledTimes(1);
    expect(usageFindMany).toHaveBeenCalledTimes(1);
    expect(firstBatch["acc-1"]?.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeCloseTo(2000);
    expect(firstBatch["acc-1"]?.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(1000);
    expect(firstBatch["acc-2"]?.hasAnySnapshots).toBe(true);

    // Subsequent single or batch calls for cached accounts must hit cache without DB queries
    const cachedSingle = await getAccountQuotaHistory("acc-1");
    expect(cachedSingle.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(1000);
    expect(snapshotFindMany).toHaveBeenCalledTimes(1);

    // Partial cache miss only queries the uncached account (acc-3)
    snapshotFindMany.mockResolvedValueOnce([]);
    usageFindMany.mockResolvedValueOnce([]);
    const mixedBatch = await getAccountsQuotaHistory(["acc-1", "acc-2", "acc-3"]);
    expect(snapshotFindMany).toHaveBeenCalledTimes(2);
    expect(snapshotFindMany.mock.calls[1]?.[0]).toMatchObject({
      where: { authIndex: { in: ["acc-3"] } },
    });
    expect(mixedBatch["acc-1"]?.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(1000);
    expect(mixedBatch["acc-3"]?.hasAnySnapshots).toBe(false);

    // Recording new snapshot for acc-2 invalidates only acc-2 while keeping acc-1 cached
    snapshotFindMany.mockResolvedValueOnce([]);
    snapshotCreateMany.mockResolvedValueOnce({ count: 1 });
    await recordQuotaSnapshots([
      {
        auth_index: "acc-2",
        provider: "antigravity",
        email: "two@example.com",
        supported: true,
        groups: [{ id: "gemini-5h", label: "Gemini 5h", remainingFraction: 0.6, resetTime: reset.toISOString(), models: [] }],
      },
    ]);

    // acc-1 still served from cache; acc-2 refetched
    snapshotFindMany.mockResolvedValueOnce([]);
    usageFindMany.mockResolvedValueOnce([]);
    await getAccountsQuotaHistory(["acc-1", "acc-2"]);
    expect(snapshotFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ authIndex: { in: ["acc-2"] } }),
      })
    );
  });

  it("does not treat small upward remaining jitter within the same resetTime as a window reset", async () => {
    const reset = new Date("2026-11-14T04:53:41Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "ag-jitter", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.96, resetTime: reset, capturedAt: new Date("2026-11-14T00:01:42Z") },
      { authIndex: "ag-jitter", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.941, resetTime: reset, capturedAt: new Date("2026-11-14T00:04:35Z") },
      { authIndex: "ag-jitter", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.949, resetTime: reset, capturedAt: new Date("2026-11-14T00:07:52Z") },
      { authIndex: "ag-jitter", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.939, resetTime: reset, capturedAt: new Date("2026-11-14T00:22:57Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "ag-jitter", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-14T00:02:00Z") },
      { authIndex: "ag-jitter", model: "gemini-2.5-pro", inputTokens: 500, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-14T00:20:00Z") },
    ]);

    const history = await getAccountQuotaHistory("ag-jitter");
    // Net depletion is 0.96 -> 0.939 = 0.021 (>= 0.02) and $1.50 total usage is preserved across the 0.941 -> 0.949 jitter
    expect(history.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeCloseTo(1.5 / 0.021);
    expect(history.models.map((m) => m.modelId)).toContain("gemini-2.5-pro");
    expect(history.models.find((m) => m.modelId === "gemini-2.5-pro")?.observedUsageUsd).toBeCloseTo(1.5);
  });
});

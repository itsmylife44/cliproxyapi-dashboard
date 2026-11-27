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
        ((await usageFindMany(...args)) as object[]).map((row) => ({
          reasoningTokens: 0,
          cacheWriteTokens: 0,
          cacheWrite1hTokens: 0,
          totalTokens: 0,
          ...row,
        })),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/model-pricing-catalog", () => ({
  getLiveModelPricing: async () => ({}),
}));

const TEST_PRICING = {
  "gemini-2.5-pro": { displayName: "Gemini 2.5 Pro", inputPer1M: 1000, outputPer1M: 2000, provider: "Google" },
  "gemini-argon": { displayName: "Gemini Argon", inputPer1M: 1000, outputPer1M: 2000, provider: "Google" },
  "gpt-6.1-sol": { displayName: "GPT 6.1 Sol", inputPer1M: 1000, outputPer1M: 2000, provider: "OpenAI" },
  "gpt-6.1-terra": { displayName: "GPT 6.1 Terra", inputPer1M: 1000, outputPer1M: 2000, provider: "OpenAI" },
  "gpt-5.6-luna": { displayName: "GPT 5.6 Luna", inputPer1M: 1000, outputPer1M: 2000, provider: "OpenAI" },
  "claude-opus-5-5-high": { displayName: "Claude Opus 5.5", inputPer1M: 1000, outputPer1M: 2000, provider: "Anthropic" },
};

import { quotaHistoryCache } from "@/lib/cache";
import { getAccountQuotaHistory, getAccountsQuotaHistory } from "../quota/quota-history";
import { recordQuotaSnapshots } from "../quota/quota-snapshots";

describe("quota history multi-account batching and valuation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    quotaHistoryCache.invalidateAll();
  });

  it("accumulates spend across zero-drop intervals ($1 per 15m with 1% drop every 45m -> $300 full window)", async () => {
    const reset = new Date("2026-11-10T15:00:00Z");
    const t0 = new Date("2026-11-10T10:00:00Z");
    const t15 = new Date("2026-11-10T10:15:00Z");
    const t30 = new Date("2026-11-10T10:30:00Z");
    const t45 = new Date("2026-11-10T10:45:00Z");
    const t60 = new Date("2026-11-10T11:00:00Z");
    const t75 = new Date("2026-11-10T11:15:00Z");
    const t90 = new Date("2026-11-10T11:30:00Z");

    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: t0 },
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: t15 },
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: t30 },
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.99, resetTime: reset, capturedAt: t45 },
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.99, resetTime: reset, capturedAt: t60 },
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.99, resetTime: reset, capturedAt: t75 },
      { authIndex: "probe", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.98, resetTime: reset, capturedAt: t90 },
    ]);

    // 1,000 inputTokens at $1000/1M = $1 per record
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "probe", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:05:00Z") },
      { authIndex: "probe", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:20:00Z") },
      { authIndex: "probe", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:35:00Z") },
      { authIndex: "probe", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:50:00Z") },
      { authIndex: "probe", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T11:05:00Z") },
      { authIndex: "probe", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T11:20:00Z") },
    ]);

    const history = await getAccountQuotaHistory("probe", TEST_PRICING);
    expect(history.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeCloseTo(300);
    expect(history.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(294);
    const model = history.models.find((m) => m.modelId === "gemini-2.5-pro");
    expect(model?.estimatedFullWindowUsd).toBeCloseTo(300);
    expect(model?.observedUsageUsd).toBeCloseTo(6);
    expect(model?.observedDelta).toBeCloseTo(0.02);
  });

  it("clamps 5m cache-write tokens to >= 0 when cacheWrite1hTokens exceeds cacheWriteTokens", async () => {
    const reset = new Date("2026-11-10T15:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "cw", provider: "claude", groupId: "five-hour", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: new Date("2026-11-10T10:00:00Z") },
      { authIndex: "cw", provider: "claude", groupId: "five-hour", modelId: "", remaining: 0.9, resetTime: reset, capturedAt: new Date("2026-11-10T10:15:00Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([
      {
        authIndex: "cw",
        model: "claude-opus-5-5-high",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 100,
        cacheWrite1hTokens: 1_000,
        timestamp: new Date("2026-11-10T10:05:00Z"),
      },
    ]);

    const history = await getAccountQuotaHistory("cw", TEST_PRICING);
    // 0 base + (0 * 1.25 + 1000 * 2) * 1000 / 1M = $2.00 over 10% -> $20.00 full window
    expect(history.windows["five-hour"]?.estimatedFullWindowUsd).toBeCloseTo(20);
  });

  it("skips token-based USD valuation for request-count windows while keeping quota % series", async () => {
    const reset = new Date("2026-11-10T15:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "gh", provider: "copilot", groupId: "premium-requests", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: new Date("2026-11-10T10:00:00Z") },
      { authIndex: "gh", provider: "copilot", groupId: "premium-requests", modelId: "", remaining: 0.9, resetTime: reset, capturedAt: new Date("2026-11-10T10:15:00Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "gh", model: "claude-opus-5-5-high", inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:05:00Z") },
    ]);

    const history = await getAccountQuotaHistory("gh");
    expect(history.windows["premium-requests"]).toEqual({
      estimatedFullWindowUsd: null,
      previousEstimatedFullWindowUsd: null,
      estimatedRemainingUsd: null,
    });
    expect(history.models.length).toBeGreaterThan(0);
    expect(history.models[0]?.estimatedFullWindowUsd).toBeNull();
    expect(history.models[0]?.series).toHaveLength(2);
  });

  it("renders quota % series even when an account has snapshots with no attributable usage", async () => {
    const reset = new Date("2026-11-10T15:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "idle", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: new Date("2026-11-10T10:00:00Z") },
      { authIndex: "idle", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.95, resetTime: reset, capturedAt: new Date("2026-11-10T10:15:00Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([]);

    const history = await getAccountQuotaHistory("idle");
    expect(history.hasAnySnapshots).toBe(true);
    expect(history.models).toHaveLength(1);
    expect(history.models[0]?.groupId).toBe("gemini-5h");
    expect(history.models[0]?.estimatedFullWindowUsd).toBeNull();
    expect(history.models[0]?.series.map((p) => p.remainingPct)).toEqual([100, 95]);
  });

  it("does not assign pre-reset usage to a replenished quota window", async () => {
    const start = new Date("2026-11-10T10:00:00Z");
    const end = new Date("2026-11-10T11:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "reset", groupId: "window", modelId: "", remaining: 0, resetTime: end, capturedAt: start },
      { authIndex: "reset", groupId: "window", modelId: "", remaining: 1, resetTime: new Date("2026-11-10T16:00:00Z"), capturedAt: end },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "reset", model: "gemini-2.5-pro", inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-10T10:30:00Z") },
    ]);
    const history = await getAccountQuotaHistory("reset");
    expect(history.windows.window?.estimatedFullWindowUsd).toBeNull();
    expect(history.models.every((model) => model.observedDelta === 0 && model.observedUsageUsd === 0)).toBe(true);
  });

  it("attributes first usage of an untouched window whose rolling reset time drifts", async () => {
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "ag", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "", remaining: 1, resetTime: new Date("2026-11-13T12:40:30Z"), capturedAt: new Date("2026-11-13T07:40:30Z") },
      { authIndex: "ag", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "", remaining: 0.75, resetTime: new Date("2026-11-13T12:41:40Z"), capturedAt: new Date("2026-11-13T07:43:52Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "ag", model: "claude-opus-5-5-high", inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-13T07:41:38Z") },
    ]);
    const history = await getAccountQuotaHistory("ag", TEST_PRICING);
    expect(history.windows["claude-gpt-5h"]?.estimatedFullWindowUsd).toBeCloseTo(4000);
  });

  it("batches DB queries across accounts, hits per-account cache, and invalidates only changed accounts", async () => {
    const reset = new Date("2026-11-10T15:00:00Z");
    const t0 = new Date("2026-11-10T10:00:00Z");
    const t1 = new Date("2026-11-10T11:00:00Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "acc-1", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1, resetTime: reset, capturedAt: t0 },
      { authIndex: "acc-1", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.5, resetTime: reset, capturedAt: t1 },
      { authIndex: "acc-2", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.8, resetTime: reset, capturedAt: t0 },
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

    const firstBatch = await getAccountsQuotaHistory(["acc-1", "acc-2"], TEST_PRICING);
    expect(snapshotFindMany).toHaveBeenCalledTimes(1);
    expect(usageFindMany).toHaveBeenCalledTimes(1);
    expect(firstBatch["acc-1"]?.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeCloseTo(2000);
    expect(firstBatch["acc-1"]?.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(1000);
    expect(firstBatch["acc-2"]?.hasAnySnapshots).toBe(true);

    const cachedSingle = await getAccountQuotaHistory("acc-1");
    expect(cachedSingle.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(1000);
    expect(snapshotFindMany).toHaveBeenCalledTimes(1);

    snapshotFindMany.mockResolvedValueOnce([]);
    usageFindMany.mockResolvedValueOnce([]);
    const mixedBatch = await getAccountsQuotaHistory(["acc-1", "acc-2", "acc-3"]);
    expect(snapshotFindMany).toHaveBeenCalledTimes(2);
    expect(snapshotFindMany.mock.calls[1]?.[0]).toMatchObject({
      where: { authIndex: { in: ["acc-3"] } },
    });
    expect(mixedBatch["acc-1"]?.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(1000);
    expect(mixedBatch["acc-3"]?.hasAnySnapshots).toBe(false);

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

    const history = await getAccountQuotaHistory("ag-jitter", TEST_PRICING);
    expect(history.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeCloseTo(1.5 / 0.021);
    expect(history.models.map((m) => m.modelId)).toContain("gemini-2.5-pro");
    expect(history.models.find((m) => m.modelId === "gemini-2.5-pro")?.observedUsageUsd).toBeCloseTo(1.5);
  });

  it("does not let an idle unpriced/other-model ping poison window valuation", async () => {
    const reset = new Date("2026-11-20T16:39:53Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "ag-live", provider: "antigravity", groupId: "gemini-weekly", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: new Date("2026-11-13T16:38:57Z") },
      { authIndex: "ag-live", provider: "antigravity", groupId: "gemini-weekly", modelId: "", remaining: 0.9, resetTime: reset, capturedAt: new Date("2026-11-13T16:50:05Z") },
      { authIndex: "ag-live", provider: "antigravity", groupId: "gemini-weekly", modelId: "", remaining: 0.9, resetTime: reset, capturedAt: new Date("2026-11-13T22:15:12Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "ag-live", model: "gemini-3.8-flash-high", inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-13T16:40:00Z") },
      { authIndex: "ag-live", model: "gemini-3-flash", inputTokens: 20, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-13T21:17:35Z") },
    ]);

    const history = await getAccountQuotaHistory("ag-live", {
      "gemini-3.8-flash": {
        displayName: "Gemini 3.8 Flash",
        inputPer1M: 0.75,
        outputPer1M: 3.75,
        cacheReadPer1M: 0.075,
        cacheAccounting: "separate",
        provider: "Google",
      },
    });
    expect(history.windows["gemini-weekly"]?.estimatedFullWindowUsd).toBeCloseTo(7.5);
    expect(history.windows["gemini-weekly"]?.estimatedRemainingUsd).toBeCloseTo(6.75);
    const flash = history.models.find((m) => m.modelId === "gemini-3.8-flash-high");
    expect(flash?.estimatedFullWindowUsd).toBeCloseTo(7.5);
    expect(flash?.estimatedRemainingUsd).toBeCloseTo(6.75);
    expect(history.models.find((m) => m.modelId === "gemini-3-flash")).toBeUndefined();
  });

  it("drops a model after five later five-hour windows without usage", async () => {
    const start = Date.parse("2026-11-10T00:00:00Z");
    const hour = 60 * 60 * 1000;
    const snapshots = Array.from({ length: 7 }, (_, index) => ({
      authIndex: "rolling", provider: "antigravity", groupId: "claude-gpt-5h", modelId: "",
      remaining: index === 0 ? 0.9 : 1,
      resetTime: new Date(start + (index + 1) * 5 * hour),
      capturedAt: new Date(start + index * 5 * hour),
    }));
    snapshots.splice(1, 0, { ...snapshots[0]!, remaining: 0.8, capturedAt: new Date(start + hour) });
    const usage = [{ authIndex: "rolling", model: "gpt-6.1-sol", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date(start + hour / 2) }];
    snapshotFindMany.mockResolvedValueOnce(snapshots.slice(0, -1));
    usageFindMany.mockResolvedValueOnce(usage);
    expect((await getAccountQuotaHistory("rolling", TEST_PRICING)).models.some((model) => model.modelId === "gpt-6.1-sol")).toBe(true);
    quotaHistoryCache.invalidateAll();
    snapshotFindMany.mockResolvedValueOnce(snapshots);
    usageFindMany.mockResolvedValueOnce(usage);
    expect((await getAccountQuotaHistory("rolling", TEST_PRICING)).models.some((model) => model.modelId === "gpt-6.1-sol")).toBe(false);
  });

  it("ignores external quota drops that have no logged CLIProxyAPI usage", async () => {
    const reset = new Date("2026-11-20T16:39:53Z");
    snapshotFindMany.mockResolvedValueOnce([
      { authIndex: "ext", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 1.0, resetTime: reset, capturedAt: new Date("2026-11-13T10:00:00Z") },
      { authIndex: "ext", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.9, resetTime: reset, capturedAt: new Date("2026-11-13T10:15:00Z") },
      // External usage outside CLIProxyAPI drops remaining from 90% -> 50% with zero logged requests.
      { authIndex: "ext", provider: "antigravity", groupId: "gemini-5h", modelId: "", remaining: 0.5, resetTime: reset, capturedAt: new Date("2026-11-13T10:30:00Z") },
    ]);
    usageFindMany.mockResolvedValueOnce([
      { authIndex: "ext", model: "gemini-2.5-pro", inputTokens: 1_000, outputTokens: 0, cachedTokens: 0, timestamp: new Date("2026-11-13T10:05:00Z") },
    ]);

    const history = await getAccountQuotaHistory("ext", TEST_PRICING);
    // Calibrated rate stays $1 / 0.10 = $10 full window ($5 remaining at 50%), unaffected by the unlogged 40% drop.
    expect(history.windows["gemini-5h"]?.estimatedFullWindowUsd).toBeCloseTo(10);
    expect(history.windows["gemini-5h"]?.estimatedRemainingUsd).toBeCloseTo(5);
  });
});

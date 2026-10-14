import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ModelPrice } from "@/lib/model-pricing";

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  userFindUnique: vi.fn(),
  ownershipFindMany: vi.fn(),
  usageRecordFindMany: vi.fn(),
  collectorStateFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession: mocks.verifySession }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/cache", () => ({
  usageCache: { get: vi.fn(() => null), set: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    providerOAuthOwnership: { findMany: mocks.ownershipFindMany },
    usageRecord: { findMany: mocks.usageRecordFindMany },
    collectorState: { findUnique: mocks.collectorStateFindUnique },
  },
}));

// No built-in model has both a peak schedule and a long-context tier, so a
// synthetic one pins down the rule for requests that are both.
const BOTH_TIERS: ModelPrice = {
  displayName: "Both tiers",
  inputPer1M: 1,
  outputPer1M: 1,
  provider: "Test",
  longContext: { thresholdTokens: 200_000, inputPer1M: 2, cacheReadPer1M: 2, outputPer1M: 2 },
  peak: { weekdaysUtc: [1, 2, 3, 4, 5], hoursUtc: [[1, 4]], inputPer1M: 3, cacheReadPer1M: 3, outputPer1M: 3 },
};

vi.mock("@/lib/model-pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/model-pricing")>();
  return {
    ...actual,
    resolveModelPrice: (model: string) => (model === "test-both-tiers" ? BOTH_TIERS : actual.resolveModelPrice(model)),
  };
});

import { calculateTieredCost, resolveModelPrice } from "@/lib/model-pricing";
import { GET } from "../route";

interface RecordInit {
  model: string;
  timestamp: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
}

interface ModelBuckets {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  longContextInputTokens: number;
  longContextOutputTokens: number;
  longContextCachedTokens: number;
  peakInputTokens: number;
  peakOutputTokens: number;
  peakCachedTokens: number;
}

function usageRecord({ model, timestamp, inputTokens, cachedTokens, outputTokens }: RecordInit) {
  return {
    apiKeyId: "key-1",
    userId: "user-1",
    authIndex: "auth-1",
    model,
    latencyMs: 100,
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    reasoningTokens: 0,
    cachedTokens,
    failed: false,
    timestamp: new Date(timestamp),
    user: { username: "admin" },
    apiKey: { name: "key-1" },
  };
}

async function fetchModels(records: RecordInit[]) {
  mocks.usageRecordFindMany.mockResolvedValue(records.map(usageRecord));

  const request = new NextRequest("http://localhost/api/usage/history?from=2026-09-01&to=2026-09-30");
  const response = await GET(request);
  const body = await response.json();
  return body.data.keys["key-1"].models as Record<string, ModelBuckets>;
}

/** Same arithmetic as the Cost Estimation card. */
function estimate(model: string, data: ModelBuckets): number {
  const price = resolveModelPrice(model);
  if (!price) throw new Error(`${model} must be priced`);
  return calculateTieredCost(
    {
      inputTokens: data.inputTokens - data.longContextInputTokens - data.peakInputTokens,
      outputTokens: data.outputTokens - data.longContextOutputTokens - data.peakOutputTokens,
      cachedTokens: data.cachedTokens - data.longContextCachedTokens - data.peakCachedTokens,
    },
    {
      inputTokens: data.longContextInputTokens,
      outputTokens: data.longContextOutputTokens,
      cachedTokens: data.longContextCachedTokens,
    },
    price,
    {
      inputTokens: data.peakInputTokens,
      outputTokens: data.peakOutputTokens,
      cachedTokens: data.peakCachedTokens,
    }
  );
}

// 2026-09-14 is a Monday, 2026-09-19 a Saturday.
const MONDAY_PEAK = "2026-09-14T02:00:00Z";
const MONDAY_OFF_PEAK = "2026-09-14T12:00:00Z";
const SATURDAY = "2026-09-19T02:00:00Z";

describe("GET /api/usage/history - peak buckets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.userFindUnique.mockResolvedValue({ isAdmin: true, username: "admin" });
    mocks.ownershipFindMany.mockResolvedValue([]);
    mocks.collectorStateFindUnique.mockResolvedValue(null);
  });

  it("prices a mixed peak/off-peak batch per request", async () => {
    const models = await fetchModels([
      { model: "deepseek-v4.1-flash", timestamp: MONDAY_PEAK, inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 0 },
      { model: "deepseek-v4.1-flash", timestamp: MONDAY_OFF_PEAK, inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 0 },
      { model: "deepseek-v4.1-flash", timestamp: SATURDAY, inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 0 },
    ]);

    const deepseek = models["deepseek-v4.1-flash"];
    if (!deepseek) throw new Error("deepseek bucket missing");
    expect(deepseek.inputTokens).toBe(3_000_000);
    expect(deepseek.peakInputTokens).toBe(1_000_000);
    // 1M at the $0.30 peak rate + 2M at the $0.15 off-peak rate.
    expect(estimate("deepseek-v4.1-flash", deepseek)).toBeCloseTo(0.6, 10);
  });

  it("buckets by UTC even when the server runs in another timezone", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";
    try {
      const models = await fetchModels([
        // 02:00 UTC is 10:00 in Shanghai (off-peak by local hour), but peak in UTC.
        { model: "deepseek-v4.1-flash", timestamp: MONDAY_PEAK, inputTokens: 1_000, cachedTokens: 0, outputTokens: 0 },
        // 12:00 UTC is 20:00 in Shanghai.
        { model: "deepseek-v4.1-flash", timestamp: MONDAY_OFF_PEAK, inputTokens: 10, cachedTokens: 0, outputTokens: 0 },
      ]);
      expect(models["deepseek-v4.1-flash"]?.peakInputTokens).toBe(1_000);
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it("leaves peak buckets empty for models without a peak schedule", async () => {
    const models = await fetchModels([
      { model: "glm-5.3", timestamp: MONDAY_PEAK, inputTokens: 262_701, cachedTokens: 261_952, outputTokens: 940 },
      { model: "grok-4.6", timestamp: MONDAY_PEAK, inputTokens: 250_000, cachedTokens: 0, outputTokens: 10 },
    ]);

    expect(models["glm-5.3"]?.peakInputTokens).toBe(0);
    expect(models["grok-4.6"]?.peakInputTokens).toBe(0);
    expect(models["grok-4.6"]?.longContextInputTokens).toBe(250_000);
  });

  it("bills a request that is both peak and long-context at the long-context rate only", async () => {
    const models = await fetchModels([
      { model: "test-both-tiers", timestamp: MONDAY_PEAK, inputTokens: 300_000, cachedTokens: 0, outputTokens: 0 },
      { model: "test-both-tiers", timestamp: MONDAY_PEAK, inputTokens: 100_000, cachedTokens: 0, outputTokens: 0 },
    ]);

    const both = models["test-both-tiers"];
    if (!both) throw new Error("test-both-tiers bucket missing");
    // The buckets are disjoint: the long prompt is counted once, as long context.
    expect(both.longContextInputTokens).toBe(300_000);
    expect(both.peakInputTokens).toBe(100_000);
    // 300k at $2 (long context) + 100k at $3 (peak).
    expect(estimate("test-both-tiers", both)).toBeCloseTo(0.6 + 0.3, 10);
  });
});

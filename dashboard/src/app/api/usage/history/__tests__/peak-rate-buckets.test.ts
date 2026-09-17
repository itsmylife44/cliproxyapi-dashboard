import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

import { calculateAggregatedCost, calculateCost, peakRatePrice, resolveModelPrice } from "@/lib/model-pricing";
import { GET } from "../route";

interface RecordInit {
  model: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  timestamp: string;
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

function usageRecord({ model, inputTokens, cachedTokens, outputTokens, timestamp }: RecordInit) {
  return {
    // A single key group, so every record aggregates into one model bucket.
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

// 2026-09-15 is a Tuesday, 2026-09-19 a Saturday.
const PEAK_WEEKDAY = "2026-09-17T02:00:00Z"; // Thursday, inside 01:00-04:00 UTC
const OFF_PEAK_WEEKDAY = "2026-09-17T12:00:00Z"; // Thursday, outside both windows
const OFF_PEAK_WEEKEND = "2026-09-19T02:00:00Z"; // Saturday, would be peak on a weekday

describe("GET /api/usage/history - peak rate buckets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.userFindUnique.mockResolvedValue({ isAdmin: true, username: "admin" });
    mocks.ownershipFindMany.mockResolvedValue([]);
    mocks.collectorStateFindUnique.mockResolvedValue(null);
  });

  it("buckets a weekday peak request as peak", async () => {
    const models = await fetchModels([
      { model: "deepseek-v4.1-flash", inputTokens: 1_000, cachedTokens: 900, outputTokens: 50, timestamp: PEAK_WEEKDAY },
    ]);

    const deepseek = models["deepseek-v4.1-flash"];
    expect(deepseek?.inputTokens).toBe(1_000);
    expect(deepseek?.peakInputTokens).toBe(1_000);
    expect(deepseek?.peakOutputTokens).toBe(50);
    expect(deepseek?.peakCachedTokens).toBe(900);
  });

  it("buckets a weekday off-peak request as off-peak", async () => {
    const models = await fetchModels([
      { model: "deepseek-v4.1-flash", inputTokens: 1_000, cachedTokens: 900, outputTokens: 50, timestamp: OFF_PEAK_WEEKDAY },
    ]);

    const deepseek = models["deepseek-v4.1-flash"];
    expect(deepseek?.inputTokens).toBe(1_000);
    expect(deepseek?.peakInputTokens).toBe(0);
    expect(deepseek?.peakOutputTokens).toBe(0);
    expect(deepseek?.peakCachedTokens).toBe(0);
  });

  it("buckets a weekend request as off-peak even inside a peak window", async () => {
    const models = await fetchModels([
      { model: "deepseek-v4.1-flash", inputTokens: 1_000, cachedTokens: 0, outputTokens: 50, timestamp: OFF_PEAK_WEEKEND },
    ]);

    expect(models["deepseek-v4.1-flash"]?.peakInputTokens).toBe(0);
  });

  it("buckets each request of the same model separately", async () => {
    const models = await fetchModels([
      { model: "deepseek-v4.1-flash", inputTokens: 100, cachedTokens: 0, outputTokens: 10, timestamp: PEAK_WEEKDAY },
      { model: "deepseek-v4.1-flash", inputTokens: 200, cachedTokens: 0, outputTokens: 20, timestamp: OFF_PEAK_WEEKDAY },
      { model: "deepseek-v4.1-flash", inputTokens: 300, cachedTokens: 0, outputTokens: 30, timestamp: "2026-09-17T01:00:00Z" },
      { model: "deepseek-v4.1-flash", inputTokens: 400, cachedTokens: 0, outputTokens: 40, timestamp: "2026-09-17T04:00:00Z" },
    ]);

    const deepseek = models["deepseek-v4.1-flash"];
    // 01:00 is the inclusive start of a window; 04:00 is its exclusive end.
    expect(deepseek?.inputTokens).toBe(100 + 200 + 300 + 400);
    expect(deepseek?.peakInputTokens).toBe(100 + 300);
    expect(deepseek?.peakOutputTokens).toBe(10 + 30);
  });

  it("leaves models without peak windows at zero", async () => {
    const models = await fetchModels([
      { model: "glm-5.3", inputTokens: 1_000, cachedTokens: 0, outputTokens: 50, timestamp: PEAK_WEEKDAY },
      { model: "kimi-k3", inputTokens: 1_000, cachedTokens: 0, outputTokens: 50, timestamp: PEAK_WEEKDAY },
      { model: "qwen3.8-max", inputTokens: 1_000, cachedTokens: 0, outputTokens: 50, timestamp: PEAK_WEEKDAY },
      { model: "gpt-5.6-sol", inputTokens: 1_000, cachedTokens: 0, outputTokens: 50, timestamp: PEAK_WEEKDAY },
      { model: "unpriced-model", inputTokens: 1_000, cachedTokens: 0, outputTokens: 50, timestamp: PEAK_WEEKDAY },
    ]);

    for (const id of ["glm-5.3", "kimi-k3", "qwen3.8-max", "gpt-5.6-sol", "unpriced-model"]) {
      expect(models[id]?.peakInputTokens, id).toBe(0);
      expect(models[id]?.peakOutputTokens, id).toBe(0);
      expect(models[id]?.peakCachedTokens, id).toBe(0);
    }
  });

  it("keeps the long-context buckets of other models independent", async () => {
    const models = await fetchModels([
      { model: "grok-4.6", inputTokens: 200_000, cachedTokens: 0, outputTokens: 100, timestamp: PEAK_WEEKDAY },
      { model: "deepseek-v4.1-flash", inputTokens: 200_000, cachedTokens: 0, outputTokens: 100, timestamp: PEAK_WEEKDAY },
    ]);

    // xAI tiers on prompt size, DeepSeek on time of day.
    expect(models["grok-4.6"]?.longContextInputTokens).toBe(200_000);
    expect(models["grok-4.6"]?.peakInputTokens).toBe(0);
    expect(models["deepseek-v4.1-flash"]?.longContextInputTokens).toBe(0);
    expect(models["deepseek-v4.1-flash"]?.peakInputTokens).toBe(200_000);
  });

  it("bills a mixed peak/off-peak model exactly like the Cost Estimation card", async () => {
    const models = await fetchModels([
      // Off-peak, mostly cached.
      { model: "deepseek-v4.1-flash", inputTokens: 200_000, cachedTokens: 190_000, outputTokens: 20_000, timestamp: OFF_PEAK_WEEKDAY },
      // Peak, mostly cached.
      { model: "deepseek-v4.1-flash", inputTokens: 100_000, cachedTokens: 90_000, outputTokens: 10_000, timestamp: PEAK_WEEKDAY },
    ]);

    const deepseek = models["deepseek-v4.1-flash"];
    if (!deepseek) throw new Error("deepseek-v4.1-flash bucket missing");
    expect(deepseek.peakInputTokens).toBe(100_000);
    expect(deepseek.peakCachedTokens).toBe(90_000);
    expect(deepseek.peakOutputTokens).toBe(10_000);

    const price = resolveModelPrice("deepseek-v4.1-flash");
    if (!price) throw new Error("deepseek-v4.1-flash must be priced");
    const peakPrice = peakRatePrice(price);
    if (!peakPrice) throw new Error("deepseek-v4.1-flash must have peak rates");

    // The route payload fed through the same helper the Cost Estimation card
    // uses: 20,000 uncached tokens off-peak, 190,000 cached off-peak, 20,000
    // output, plus 10,000 uncached peak, 90,000 cached peak and 10,000 output.
    expect(calculateAggregatedCost(deepseek, price)).toBeCloseTo(0.02961, 10);

    // The same total split into its off-peak and peak parts.
    const offPeakCost = calculateCost(
      deepseek.inputTokens - deepseek.peakInputTokens,
      deepseek.outputTokens - deepseek.peakOutputTokens,
      price,
      deepseek.cachedTokens - deepseek.peakCachedTokens
    );
    const peakCost = calculateCost(
      deepseek.peakInputTokens,
      deepseek.peakOutputTokens,
      peakPrice,
      deepseek.peakCachedTokens
    );

    expect(offPeakCost).toBeCloseTo((10_000 / 1_000_000) * 0.15 + (190_000 / 1_000_000) * 0.003 + (20_000 / 1_000_000) * 0.6, 10);
    expect(peakCost).toBeCloseTo((10_000 / 1_000_000) * 0.3 + (90_000 / 1_000_000) * 0.006 + (10_000 / 1_000_000) * 1.2, 10);
    expect(offPeakCost + peakCost).toBeCloseTo(calculateAggregatedCost(deepseek, price), 10);

    // Billing the whole total at one card would be wrong in either direction.
    const allOffPeak = calculateCost(deepseek.inputTokens, deepseek.outputTokens, price, deepseek.cachedTokens);
    const allPeak = calculateCost(deepseek.inputTokens, deepseek.outputTokens, peakPrice, deepseek.cachedTokens);
    expect(offPeakCost + peakCost).toBeGreaterThan(allOffPeak);
    expect(offPeakCost + peakCost).toBeLessThan(allPeak);
  });

  it("time-buckets a prefixed OpenCode Go model ID", async () => {
    const models = await fetchModels([
      { model: "opencode-go/deepseek-v4.1-flash", inputTokens: 1_000, cachedTokens: 0, outputTokens: 10, timestamp: PEAK_WEEKDAY },
      { model: "opencode-go/deepseek-v4.1-flash", inputTokens: 2_000, cachedTokens: 0, outputTokens: 20, timestamp: OFF_PEAK_WEEKDAY },
    ]);

    const deepseek = models["opencode-go/deepseek-v4.1-flash"];
    if (!deepseek) throw new Error("prefixed bucket missing");
    // The route resolves through the provider-prefix fallback, so the peak
    // window still applies to the prefixed form.
    expect(deepseek.inputTokens).toBe(3_000);
    expect(deepseek.peakInputTokens).toBe(1_000);
    expect(deepseek.peakOutputTokens).toBe(10);

    const price = resolveModelPrice("opencode-go/deepseek-v4.1-flash");
    if (!price) throw new Error("prefixed ID must be priced");
    const peakPrice = peakRatePrice(price);
    if (!peakPrice) throw new Error("prefixed ID must have peak rates");

    expect(calculateAggregatedCost(deepseek, price)).toBeCloseTo(
      calculateCost(2_000, 20, price, 0) + calculateCost(1_000, 10, peakPrice, 0),
      10
    );
  });

  it("does not count a peak payload for an unpriced model", async () => {
    const models = await fetchModels([
      { model: "deepseek-v4.1-flash-preview", inputTokens: 1_000, cachedTokens: 0, outputTokens: 10, timestamp: PEAK_WEEKDAY },
    ]);

    // The variant stays unpriced, so no bucket may be built from it.
    expect(resolveModelPrice("deepseek-v4.1-flash-preview")).toBeNull();
    expect(models["deepseek-v4.1-flash-preview"]?.peakInputTokens).toBe(0);
  });
});

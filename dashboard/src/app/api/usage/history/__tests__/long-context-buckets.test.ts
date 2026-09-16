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

import { calculateTieredCost, resolveModelPrice } from "@/lib/model-pricing";
import { GET } from "../route";

interface RecordInit {
  model: string;
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
}

function usageRecord({ model, inputTokens, cachedTokens, outputTokens }: RecordInit) {
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
    timestamp: new Date("2026-09-15T10:00:00Z"),
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

describe("GET /api/usage/history - long-context buckets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.userFindUnique.mockResolvedValue({ isAdmin: true, username: "admin" });
    mocks.ownershipFindMany.mockResolvedValue([]);
    mocks.collectorStateFindUnique.mockResolvedValue(null);
  });

  it("keeps a 199,999-token prompt in the short-context bucket", async () => {
    const models = await fetchModels([
      { model: "grok-4.6", inputTokens: 199_999, cachedTokens: 0, outputTokens: 100 },
    ]);

    expect(models["grok-4.6"]?.inputTokens).toBe(199_999);
    expect(models["grok-4.6"]?.longContextInputTokens).toBe(0);
  });

  it("moves an exactly 200,000-token prompt into the long-context bucket", async () => {
    const models = await fetchModels([
      { model: "grok-4.6", inputTokens: 200_000, cachedTokens: 0, outputTokens: 100 },
    ]);

    expect(models["grok-4.6"]?.inputTokens).toBe(200_000);
    expect(models["grok-4.6"]?.longContextInputTokens).toBe(200_000);
    expect(models["grok-4.6"]?.longContextOutputTokens).toBe(100);
  });

  it("moves a 200,001-token prompt into the long-context bucket", async () => {
    const models = await fetchModels([
      { model: "grok-4.6", inputTokens: 200_001, cachedTokens: 0, outputTokens: 1 },
    ]);

    expect(models["grok-4.6"]?.longContextInputTokens).toBe(200_001);
  });

  it("buckets each request of the same model separately", async () => {
    const models = await fetchModels([
      { model: "grok-4.3", inputTokens: 199_999, cachedTokens: 0, outputTokens: 10 },
      { model: "grok-4.3", inputTokens: 200_000, cachedTokens: 0, outputTokens: 20 },
      { model: "grok-4.3", inputTokens: 500_000, cachedTokens: 0, outputTokens: 30 },
      { model: "grok-4.3", inputTokens: 1_000, cachedTokens: 0, outputTokens: 40 },
    ]);

    const grok = models["grok-4.3"];
    expect(grok?.inputTokens).toBe(199_999 + 200_000 + 500_000 + 1_000);
    expect(grok?.outputTokens).toBe(10 + 20 + 30 + 40);
    // Only the two requests at/above the threshold are treated as long context.
    expect(grok?.longContextInputTokens).toBe(200_000 + 500_000);
    expect(grok?.longContextOutputTokens).toBe(20 + 30);
  });

  it("carries cached tokens into the matching bucket", async () => {
    const models = await fetchModels([
      // Mostly cached, below the threshold.
      { model: "grok-4.6", inputTokens: 100_000, cachedTokens: 95_000, outputTokens: 5 },
      // Mostly cached, above the threshold.
      { model: "grok-4.6", inputTokens: 250_000, cachedTokens: 240_000, outputTokens: 5 },
    ]);

    const grok = models["grok-4.6"];
    expect(grok?.cachedTokens).toBe(95_000 + 240_000);
    expect(grok?.longContextCachedTokens).toBe(240_000);
    expect(grok?.longContextInputTokens).toBe(250_000);
    // The short remainder stays in the totals.
    expect((grok?.inputTokens ?? 0) - (grok?.longContextInputTokens ?? 0)).toBe(100_000);
  });

  it("records no long-context tokens for a cache-free short request", async () => {
    const models = await fetchModels([
      { model: "grok-build-0.1", inputTokens: 1_000, cachedTokens: 0, outputTokens: 500 },
    ]);

    const grok = models["grok-build-0.1"];
    expect(grok?.longContextInputTokens).toBe(0);
    expect(grok?.longContextOutputTokens).toBe(0);
    expect(grok?.longContextCachedTokens).toBe(0);
  });

  it("uses the model's own threshold: OpenAI qualifies only above 272k", async () => {
    const models = await fetchModels([
      { model: "gpt-5.6-sol", inputTokens: 272_000, cachedTokens: 0, outputTokens: 10 },
      { model: "gpt-5.6-sol", inputTokens: 272_001, cachedTokens: 0, outputTokens: 20 },
    ]);

    const sol = models["gpt-5.6-sol"];
    expect(sol?.inputTokens).toBe(272_000 + 272_001);
    // 272,000 stays short context; only 272,001 is long context.
    expect(sol?.longContextInputTokens).toBe(272_001);
    expect(sol?.longContextOutputTokens).toBe(20);
  });

  it("keeps 200,000 as the xAI threshold independently of OpenAI's", async () => {
    const models = await fetchModels([
      { model: "grok-4.6", inputTokens: 200_000, cachedTokens: 0, outputTokens: 1 },
      { model: "gpt-6-astra", inputTokens: 200_000, cachedTokens: 0, outputTokens: 1 },
    ]);

    expect(models["grok-4.6"]?.longContextInputTokens).toBe(200_000);
    // 200k is well below OpenAI's 272k threshold.
    expect(models["gpt-6-astra"]?.longContextInputTokens).toBe(0);
  });

  it("buckets mixed short and long OpenAI requests of one model", async () => {
    const models = await fetchModels([
      { model: "gpt-5.6-luna", inputTokens: 100_000, cachedTokens: 90_000, outputTokens: 5 },
      { model: "gpt-5.6-luna", inputTokens: 300_000, cachedTokens: 250_000, outputTokens: 7 },
    ]);

    const luna = models["gpt-5.6-luna"];
    expect(luna?.inputTokens).toBe(400_000);
    expect(luna?.cachedTokens).toBe(340_000);
    expect(luna?.longContextInputTokens).toBe(300_000);
    expect(luna?.longContextCachedTokens).toBe(250_000);
    expect(luna?.longContextOutputTokens).toBe(7);
  });

  it("bills a fully cached 1,000,000-token Terra prompt at the long-context cache rate", async () => {
    const models = await fetchModels([
      { model: "gpt-5.6-terra", inputTokens: 1_000_000, cachedTokens: 1_000_000, outputTokens: 0 },
    ]);

    const terra = models["gpt-5.6-terra"];
    if (!terra) throw new Error("gpt-5.6-terra bucket missing");
    // The route decides the tier per record: 1M prompt tokens is above 272k.
    expect(terra.longContextInputTokens).toBe(1_000_000);
    expect(terra.longContextCachedTokens).toBe(1_000_000);
    expect(terra.longContextOutputTokens).toBe(0);

    const price = resolveModelPrice("gpt-5.6-terra");
    if (!price) throw new Error("gpt-5.6-terra must be priced");

    // Exactly what the Cost Estimation card computes: totals minus the
    // long-context subset, then the tier-aware cost.
    const cost = calculateTieredCost(
      {
        inputTokens: terra.inputTokens - terra.longContextInputTokens,
        outputTokens: terra.outputTokens - terra.longContextOutputTokens,
        cachedTokens: terra.cachedTokens - terra.longContextCachedTokens,
      },
      {
        inputTokens: terra.longContextInputTokens,
        outputTokens: terra.longContextOutputTokens,
        cachedTokens: terra.longContextCachedTokens,
      },
      price
    );

    // 1M fully cached tokens at the long-context cache rate ($0.40/1M),
    // not the short-context rate ($0.20/1M).
    expect(cost).toBeCloseTo(0.4, 10);
    expect(cost).not.toBeCloseTo(0.2, 10);
  });

  it("leaves models without a long-context configuration untiered", async () => {
    const models = await fetchModels([
      { model: "claude-opus-5", inputTokens: 250_000, cachedTokens: 0, outputTokens: 1_000 },
      { model: "gpt-4o", inputTokens: 300_000, cachedTokens: 0, outputTokens: 500 },
    ]);

    // Totals are unchanged and no tokens land in a long-context bucket.
    expect(models["claude-opus-5"]?.inputTokens).toBe(250_000);
    expect(models["claude-opus-5"]?.longContextInputTokens).toBe(0);
    expect(models["gpt-4o"]?.inputTokens).toBe(300_000);
    expect(models["gpt-4o"]?.longContextInputTokens).toBe(0);
  });
});

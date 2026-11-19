import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    systemSetting: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("model-pricing-catalog", () => {
  const originalLivePricingEnv = process.env.LIVE_MODEL_PRICING;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.LIVE_MODEL_PRICING;
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalLivePricingEnv === undefined) {
      delete process.env.LIVE_MODEL_PRICING;
    } else {
      process.env.LIVE_MODEL_PRICING = originalLivePricingEnv;
    }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("merges models.dev and OpenRouter, skips $0 entries, prefers first-party providers, and infers cacheAccounting", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("models.dev")) {
        return new Response(
          JSON.stringify({
            abacus: {
              name: "Abacus",
              models: {
                "gemini-3-pro": { name: "Reseller Gemini", cost: { input: 99, output: 99 } },
                "live-only-model": { name: "Live Only", cost: { input: 1.5, output: 3, cache_read: 0.3 } },
              },
            },
            google: {
              name: "Google",
              models: {
                "gemini-3-pro": { name: "Gemini 3 Pro", cost: { input: 2, output: 12, cache_read: 0.2 } },
              },
            },
            openai: {
              name: "OpenAI",
              models: {
                "live-only-model": { name: "Live Only", cost: { input: 1.5, output: 3, cache_read: 0.3 } },
                "free-models-dev": { name: "Free", cost: { input: 0, output: 0 } },
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "acme/openrouter-model",
              name: "OpenRouter Model",
              pricing: { prompt: "0.000002", completion: "0.000008", input_cache_read: "0.0000005" },
            },
            {
              id: "acme/free-or-model",
              name: "Free OR",
              pricing: { prompt: "0", completion: "0" },
            },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getLiveModelPricing } = await import("../model-pricing-catalog");
    const pricing = await getLiveModelPricing();

    expect(pricing["live-only-model"]).toEqual({
      displayName: "Live Only",
      inputPer1M: 1.5,
      outputPer1M: 3,
      cacheReadPer1M: 0.3,
      cacheAccounting: "included",
      provider: "OpenAI",
    });
    expect(pricing["gemini-3-pro"]).toEqual({
      displayName: "Gemini 3 Pro",
      inputPer1M: 2,
      outputPer1M: 12,
      cacheReadPer1M: 0.2,
      cacheAccounting: "separate",
      provider: "Google",
    });
    expect(pricing["acme/openrouter-model"]).toMatchObject({
      displayName: "OpenRouter Model",
      inputPer1M: 2,
      outputPer1M: 8,
      cacheReadPer1M: 0.5,
      cacheAccounting: "separate",
    });
    expect(pricing["openrouter-model"]).toBeDefined();
    expect(pricing["free-models-dev"]).toBeUndefined();
    expect(pricing["acme/free-or-model"]).toBeUndefined();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to persisted SystemSetting cache when upstream catalogs fail and uses short backoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));

    const fetchMock = vi.fn(async () => new Response("upstream error", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    mockFindUnique.mockResolvedValue({
      key: "live_model_pricing_cache",
      value: JSON.stringify({
        "persisted-model": {
          displayName: "Persisted Model",
          inputPer1M: 4,
          outputPer1M: 12,
          cacheAccounting: "included",
          provider: "Acme",
        },
      }),
    });

    const { getLiveModelPricing } = await import("../model-pricing-catalog");
    const pricing = await getLiveModelPricing();

    expect(pricing["persisted-model"]?.displayName).toBe("Persisted Model");
    expect(mockUpsert).not.toHaveBeenCalled();

    const callsAfterFailure = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    await getLiveModelPricing();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFailure);

    await vi.advanceTimersByTimeAsync(31_000);
    await getLiveModelPricing();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFailure);
  });

  it("does not overwrite persisted SystemSetting on partial upstream failure", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("models.dev")) {
        return new Response("models.dev down", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "openai/gpt-new",
              name: "GPT New",
              pricing: { prompt: "0.000001", completion: "0.000002" },
            },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    mockFindUnique.mockResolvedValue({
      key: "live_model_pricing_cache",
      value: JSON.stringify({
        "persisted-model": {
          displayName: "Persisted Model",
          inputPer1M: 4,
          outputPer1M: 12,
          cacheAccounting: "separate",
          provider: "Acme",
        },
      }),
    });

    const { getLiveModelPricing } = await import("../model-pricing-catalog");
    const pricing = await getLiveModelPricing();

    expect(pricing["persisted-model"]?.displayName).toBe("Persisted Model");
    expect(pricing["openai/gpt-new"]?.displayName).toBe("GPT New");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it.each(["off", "OFF", "false", "0"])("disables outbound fetches when LIVE_MODEL_PRICING=%s", async (value) => {
    process.env.LIVE_MODEL_PRICING = value;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getLiveModelPricing } = await import("../model-pricing-catalog");
    const pricing = await getLiveModelPricing();

    expect(pricing).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_PRICING } from "../model-pricing";

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
  beforeEach(() => {
    vi.resetModules();
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges OpenRouter and models.dev pricing, skips $0 entries, and preserves built-in defaults", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("models.dev")) {
        return new Response(
          JSON.stringify({
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
              id: "anthropic/claude-opus-5",
              name: "Overridden By Builtin",
              pricing: { prompt: "0.000099", completion: "0.000199" },
            },
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

    const { getMergedModelPricing } = await import("../model-pricing-catalog");
    const pricing = await getMergedModelPricing();

    expect(pricing["live-only-model"]).toEqual({
      displayName: "Live Only",
      inputPer1M: 1.5,
      outputPer1M: 3,
      cacheReadPer1M: 0.3,
      cacheAccounting: "included",
      provider: "OpenAI",
    });
    expect(pricing["acme/openrouter-model"]).toMatchObject({
      displayName: "OpenRouter Model",
      inputPer1M: 2,
      outputPer1M: 8,
      cacheReadPer1M: 0.5,
    });
    expect(pricing["openrouter-model"]).toBeDefined();
    expect(pricing["free-models-dev"]).toBeUndefined();
    expect(pricing["acme/free-or-model"]).toBeUndefined();
    expect(pricing["claude-opus-5"]).toEqual(DEFAULT_MODEL_PRICING["claude-opus-5"]);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to persisted SystemSetting cache when upstream catalogs fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream error", { status: 503 }))
    );
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

    const { getMergedModelPricing } = await import("../model-pricing-catalog");
    const pricing = await getMergedModelPricing();

    expect(pricing["persisted-model"]?.displayName).toBe("Persisted Model");
    expect(pricing["claude-opus-5"]).toEqual(DEFAULT_MODEL_PRICING["claude-opus-5"]);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

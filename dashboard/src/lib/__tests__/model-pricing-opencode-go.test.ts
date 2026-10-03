import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL_PRICING,
  calculateAggregatedCost,
  calculateCost,
  isPeakRateTimestamp,
  peakRatePrice,
  resolveModelPrice,
} from "../model-pricing";

// Source for every rate below: https://opencode.ai/docs/go/
// ("Token prices are per 1M tokens"), retrieved 2026-09-17. The IDs are the
// ones in that page's endpoints table and in
// https://opencode.ai/zen/go/v1/models.
const OPENCODE_GO_MODELS: Array<{
  id: string;
  displayName: string;
  input: number;
  output: number;
  cached: number;
}> = [
  { id: "deepseek-v4.1-flash", displayName: "DeepSeek V4.1 Flash", input: 0.15, output: 0.6, cached: 0.003 },
  { id: "glm-5.3", displayName: "GLM-5.3", input: 1.4, output: 4.4, cached: 0.26 },
  { id: "kimi-k3", displayName: "Kimi K3", input: 3, output: 15, cached: 0.3 },
  { id: "qwen3.8-max", displayName: "Qwen3.8 Max", input: 2, output: 6, cached: 0.25 },
];

const OPENCODE_GO_MODEL_IDS = OPENCODE_GO_MODELS.map((model) => model.id);

describe("resolveModelPrice - OpenCode Go open models", () => {
  it.each(OPENCODE_GO_MODELS)("prices $id at the published Go list rates", ({ id, displayName, input, output, cached }) => {
    const price = resolveModelPrice(id);
    expect(price, `${id} should be priced`).not.toBeNull();
    expect(price?.displayName).toBe(displayName);
    expect(price?.provider).toBe("OpenCode Go");
    expect(price?.inputPer1M).toBe(input);
    expect(price?.outputPer1M).toBe(output);
    expect(price?.cacheReadPer1M).toBe(cached);
    expect(price?.cacheAccounting).toBe("included");
  });

  it("uses the current cache-read rates rather than the ones proposed in the issue", () => {
    // The issue proposed $0.015 / $0.14 / $0.30 / $0.20; the Go table publishes
    // $0.003 (off-peak) / $0.26 / $0.30 / $0.25.
    expect(resolveModelPrice("deepseek-v4.1-flash")?.cacheReadPer1M).toBe(0.003);
    expect(resolveModelPrice("glm-5.3")?.cacheReadPer1M).toBe(0.26);
    expect(resolveModelPrice("kimi-k3")?.cacheReadPer1M).toBe(0.3);
    expect(resolveModelPrice("qwen3.8-max")?.cacheReadPer1M).toBe(0.25);
  });

  it("does not give the Go models a long-context tier", () => {
    for (const id of OPENCODE_GO_MODEL_IDS) {
      expect(resolveModelPrice(id)?.longContext, id).toBeUndefined();
    }
  });

  // OpenCode writes `opencode-go/<model-id>` in its own configuration
  // (https://opencode.ai/docs/go/, "Endpoints"); a CLIProxyAPI credential can
  // also carry its own prefix.
  const prefixed: Array<[string, string]> = [
    ["opencode-go/", "deepseek-v4.1-flash"],
    ["opencode-go/", "glm-5.3"],
    ["opencode-go/", "kimi-k3"],
    ["opencode-go/", "qwen3.8-max"],
    ["cliproxyapi/", "kimi-k3"],
    ["openai-compatibility/", "glm-5.3"],
  ];

  it.each(prefixed)("resolves %s%s to the same price as the bare ID", (prefix, id) => {
    const prefixedPrice = resolveModelPrice(`${prefix}${id}`);
    expect(prefixedPrice, `${prefix}${id} should be priced`).not.toBeNull();
    expect(prefixedPrice?.inputPer1M).toBe(resolveModelPrice(id)?.inputPer1M);
    expect(prefixedPrice?.cacheReadPer1M).toBe(resolveModelPrice(id)?.cacheReadPer1M);
  });

  it("resolves prefixed IDs case-insensitively", () => {
    expect(resolveModelPrice("OpenCode-Go/Kimi-K3")?.displayName).toBe("Kimi K3");
    expect(resolveModelPrice("OPENCODE-GO/DEEPSEEK-V4.1-FLASH")?.inputPer1M).toBe(0.15);
  });
});

describe("resolveModelPrice - OpenCode Go siblings stay unpriced", () => {
  it("does not bill a sibling model ID at another model's rate", () => {
    // `glm-5.3-flash` is $0.15/$0.50 in the same catalogue.
    expect(resolveModelPrice("glm-5.3-flash")).toBeNull();
    // CLIProxyAPI's registry lists `kimi-k3-256k` as its own model ID.
    expect(resolveModelPrice("kimi-k3-256k")).toBeNull();
    // DeepSeek V4 Flash / V4 Pro / Vision Exp are separate Go entries.
    expect(resolveModelPrice("deepseek-v4-flash")).toBeNull();
    expect(resolveModelPrice("deepseek-v4-flash-vision-exp")).toBeNull();
    expect(resolveModelPrice("deepseek-v4-pro")).toBeNull();
    expect(resolveModelPrice("deepseek-flash")).toBeNull();
    // Qwen 3.8 Flash, 3.7 Max and the Plus tiers are separate Go entries.
    expect(resolveModelPrice("qwen3.8-flash")).toBeNull();
    expect(resolveModelPrice("qwen3.7-max")).toBeNull();
    expect(resolveModelPrice("qwen3.7-plus")).toBeNull();
  });

  it("keeps unknown variants and suffixes unpriced", () => {
    expect(resolveModelPrice("deepseek-v4.1-flash-preview")).toBeNull();
    expect(resolveModelPrice("deepseek-v4.1-flash-2026-09-01")).toBeNull();
    expect(resolveModelPrice("glm-5.3-thinking")).toBeNull();
    expect(resolveModelPrice("kimi-k3-thinking")).toBeNull();
    expect(resolveModelPrice("qwen3.8-max-thinking")).toBeNull();
    expect(resolveModelPrice("opencode-go/glm-5.3-flash")).toBeNull();
    expect(resolveModelPrice("opencode-go/kimi-k3-256k")).toBeNull();
  });

  it("does not collide with older DeepSeek, GLM, Kimi or Qwen models", () => {
    expect(resolveModelPrice("deepseek-v3")).toBeNull();
    expect(resolveModelPrice("deepseek-chat")).toBeNull();
    expect(resolveModelPrice("glm-4.6")).toBeNull();
    expect(resolveModelPrice("glm-4.5-air")).toBeNull();
    expect(resolveModelPrice("glm-5")).toBeNull();
    expect(resolveModelPrice("kimi-k2")).toBeNull();
    expect(resolveModelPrice("kimi-k2.5")).toBeNull();
    expect(resolveModelPrice("kimi-k2.7-code")).toBeNull();
    expect(resolveModelPrice("qwen3-max")).toBeNull();
    expect(resolveModelPrice("qwen2.5-max")).toBeNull();
  });

  it("leaves a newer version of a now-priced family unpriced", () => {
    expect(resolveModelPrice("deepseek-v4.2-flash")).toBeNull();
    expect(resolveModelPrice("glm-5.4")).toBeNull();
    expect(resolveModelPrice("kimi-k4")).toBeNull();
    expect(resolveModelPrice("qwen3.9-max")).toBeNull();
  });
});

describe("cache accounting - OpenCode Go subset shape", () => {
  it("does not bill cached tokens twice", () => {
    for (const id of OPENCODE_GO_MODEL_IDS) {
      const price = resolveModelPrice(id);
      if (!price) throw new Error(`${id} must be priced`);
      const cacheRead = price.cacheReadPer1M ?? 0;

      // 1M prompt tokens, all of them cache hits: only the cache-read rate applies.
      expect(calculateCost(1_000_000, 0, price, 1_000_000), id).toBeCloseTo(cacheRead, 10);
      // 1M prompt tokens, 400k cache hits: the remainder is billed once at input.
      expect(calculateCost(1_000_000, 0, price, 400_000), id).toBeCloseTo(
        (600_000 / 1_000_000) * price.inputPer1M + (400_000 / 1_000_000) * cacheRead,
        10
      );
    }
  });

  it("clamps a cached count larger than the reported input", () => {
    const price = resolveModelPrice("kimi-k3");
    if (!price) throw new Error("kimi-k3 must be priced");
    expect(calculateCost(1_000_000, 0, price, 5_000_000)).toBeCloseTo(0.3, 10);
  });
});

describe("issue #236 usage rows", () => {
  it("prices the deepseek-v4.1-flash row off-peak and peak", () => {
    const price = resolveModelPrice("deepseek-v4.1-flash");
    if (!price) throw new Error("deepseek-v4.1-flash must be priced");
    const peak = peakRatePrice(price);
    if (!peak) throw new Error("deepseek-v4.1-flash must have peak rates");

    // 228 requests, 32,109,020 input of which 31,496,320 cached, 172,274 output.
    const input = 32_109_020;
    const cached = 31_496_320;
    const output = 172_274;
    const uncached = input - cached;

    expect(calculateCost(input, output, price, cached)).toBeCloseTo(
      (uncached / 1_000_000) * 0.15 + (cached / 1_000_000) * 0.003 + (output / 1_000_000) * 0.6,
      10
    );
    expect(calculateCost(input, output, peak, cached)).toBeCloseTo(
      (uncached / 1_000_000) * 0.3 + (cached / 1_000_000) * 0.006 + (output / 1_000_000) * 1.2,
      10
    );
    // The peak card is exactly twice the off-peak card for this model.
    expect(calculateCost(input, output, peak, cached)).toBeCloseTo(2 * calculateCost(input, output, price, cached), 10);
  });

  it("prices the glm-5.3 row with the corrected cache-read rate", () => {
    const price = resolveModelPrice("glm-5.3");
    if (!price) throw new Error("glm-5.3 must be priced");

    // 10 requests, 262,701 input of which 261,952 cached, 940 output.
    const input = 262_701;
    const cached = 261_952;
    const output = 940;
    const cost = calculateCost(input, output, price, cached);

    expect(cost).toBeCloseTo(
      ((input - cached) / 1_000_000) * 1.4 + (cached / 1_000_000) * 0.26 + (output / 1_000_000) * 4.4,
      10
    );
    // The $0.14 cache-read rate suggested in the issue would understate this.
    const issueEstimate =
      ((input - cached) / 1_000_000) * 1.4 + (cached / 1_000_000) * 0.14 + (output / 1_000_000) * 4.4;
    expect(cost).toBeGreaterThan(issueEstimate);
  });

  it("prices the kimi-k3 row", () => {
    const price = resolveModelPrice("kimi-k3");
    if (!price) throw new Error("kimi-k3 must be priced");
    // 1 request, 92 input, 16 output, no cache.
    expect(calculateCost(92, 16, price, 0)).toBeCloseTo((92 / 1_000_000) * 3 + (16 / 1_000_000) * 15, 10);
  });
});

describe("deepseek-v4.1-flash peak/off-peak windows", () => {
  // https://opencode.ai/docs/go/ — "Peak hours are 01:00-04:00 and 06:00-10:00
  // UTC, Monday through Friday; all other hours, including weekends, are
  // Off-Peak."
  const price = resolveModelPrice("deepseek-v4.1-flash");
  if (!price) throw new Error("deepseek-v4.1-flash must be priced");

  function at(iso: string): boolean {
    return isPeakRateTimestamp(new Date(iso), price);
  }

  it("starts a window inclusively and ends it exclusively", () => {
    // 2026-09-17 is a Thursday.
    expect(at("2026-09-17T00:59:59.999Z")).toBe(false);
    expect(at("2026-09-17T01:00:00.000Z")).toBe(true);
    expect(at("2026-09-17T03:59:59.999Z")).toBe(true);
    expect(at("2026-09-17T04:00:00.000Z")).toBe(false);
    expect(at("2026-09-17T05:59:59.999Z")).toBe(false);
    expect(at("2026-09-17T06:00:00.000Z")).toBe(true);
    expect(at("2026-09-17T09:59:59.999Z")).toBe(true);
    expect(at("2026-09-17T10:00:00.000Z")).toBe(false);
    expect(at("2026-09-17T23:59:59.999Z")).toBe(false);
  });

  it("treats weekends as off-peak all day", () => {
    expect(at("2026-09-19T02:00:00Z")).toBe(false); // Saturday
    expect(at("2026-09-19T08:00:00Z")).toBe(false); // Saturday
    expect(at("2026-09-20T02:00:00Z")).toBe(false); // Sunday
    expect(at("2026-09-20T08:00:00Z")).toBe(false); // Sunday
  });

  it("covers Monday through Friday", () => {
    expect(at("2026-09-21T02:00:00Z")).toBe(true); // Monday
    expect(at("2026-09-22T02:00:00Z")).toBe(true); // Tuesday
    expect(at("2026-09-16T02:00:00Z")).toBe(true); // Wednesday
    expect(at("2026-09-17T02:00:00Z")).toBe(true); // Thursday
    expect(at("2026-09-18T02:00:00Z")).toBe(true); // Friday
  });

  it("applies to historical timestamps as well", () => {
    expect(at("2026-05-04T02:00:00Z")).toBe(true); // Monday
    expect(at("2026-05-03T02:00:00Z")).toBe(false); // Sunday
    expect(at("2026-01-01T07:30:00Z")).toBe(true); // Thursday
  });

  it("is off-peak for models without peak windows", () => {
    const models = ["glm-5.3", "kimi-k3", "qwen3.8-max", "claude-opus-5", "grok-4.6", "gpt-5.6-sol"];
    for (const id of models) {
      expect(isPeakRateTimestamp(new Date("2026-09-17T02:00:00Z"), resolveModelPrice(id)), id).toBe(false);
    }
    expect(isPeakRateTimestamp(new Date("2026-09-17T02:00:00Z"), null)).toBe(false);
  });

  it("stores the published windows and the peak rate card", () => {
    expect(price.peak?.windows).toEqual([
      { weekdaysUtc: [1, 2, 3, 4, 5], startHourUtc: 1, endHourUtc: 4 },
      { weekdaysUtc: [1, 2, 3, 4, 5], startHourUtc: 6, endHourUtc: 10 },
    ]);
    const peak = peakRatePrice(price);
    expect(peak).not.toBeNull();
    expect([peak?.inputPer1M, peak?.outputPer1M, peak?.cacheReadPer1M]).toEqual([0.3, 1.2, 0.006]);
    // The peak card is twice the off-peak card, which is the base rate card.
    expect(peak?.inputPer1M).toBe(2 * price.inputPer1M);
    expect(peak?.outputPer1M).toBe(2 * price.outputPer1M);
    expect(peak?.cacheReadPer1M).toBe(2 * (price.cacheReadPer1M ?? 0));
  });

  it("carries the non-rate fields over to the peak price", () => {
    const peak = peakRatePrice(price);
    expect(peak?.displayName).toBe(price.displayName);
    expect(peak?.provider).toBe(price.provider);
    expect(peak?.cacheAccounting).toBe("included");
    expect(peak?.exactMatchOnly).toBe(true);
    expect(peak?.peak).toEqual(price.peak);
  });

  it("does not mutate the base price", () => {
    const before = { ...price, peak: price.peak };
    peakRatePrice(price);
    expect(price).toEqual(before);
    expect(price.inputPer1M).toBe(0.15);
  });

  it("returns no peak price for a model without peak windows", () => {
    for (const id of ["glm-5.3", "kimi-k3", "qwen3.8-max", "claude-opus-5"]) {
      const modelPrice = resolveModelPrice(id);
      if (!modelPrice) throw new Error(`${id} must be priced`);
      expect(peakRatePrice(modelPrice), id).toBeNull();
    }
  });

  it("bills peak tokens at the peak cache-read rate without double counting", () => {
    const peak = peakRatePrice(price);
    if (!peak) throw new Error("deepseek-v4.1-flash must have peak rates");
    expect(calculateCost(1_000_000, 0, peak, 1_000_000)).toBeCloseTo(0.006, 10);
    expect(calculateCost(1_000_000, 0, peak, 400_000)).toBeCloseTo(
      (600_000 / 1_000_000) * 0.3 + (400_000 / 1_000_000) * 0.006,
      10
    );
  });
});

describe("pricing table invariants", () => {
  it("never combines a peak window with a long-context tier", () => {
    // The usage aggregation keeps one time-of-day bucket per model, so a
    // long-context tier would need peak rates of its own. No entry may define
    // both until that is modelled.
    for (const [id, price] of Object.entries(DEFAULT_MODEL_PRICING)) {
      if (price.peak) {
        expect(price.longContext, id).toBeUndefined();
      }
    }
  });

  it("declares well-formed peak windows", () => {
    for (const [id, price] of Object.entries(DEFAULT_MODEL_PRICING)) {
      if (!price.peak) continue;
      expect(price.peak.windows.length, id).toBeGreaterThan(0);
      for (const window of price.peak.windows) {
        expect(window.startHourUtc, id).toBeGreaterThanOrEqual(0);
        expect(window.endHourUtc, id).toBeLessThanOrEqual(24);
        expect(window.startHourUtc, id).toBeLessThan(window.endHourUtc);
        expect(window.weekdaysUtc.length, id).toBeGreaterThan(0);
        for (const weekday of window.weekdaysUtc) {
          expect(weekday, id).toBeGreaterThanOrEqual(0);
          expect(weekday, id).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

const EMPTY_SUBSETS = {
  longContextInputTokens: 0,
  longContextOutputTokens: 0,
  longContextCachedTokens: 0,
  peakInputTokens: 0,
  peakOutputTokens: 0,
  peakCachedTokens: 0,
};

describe("calculateAggregatedCost", () => {
  it("bills a model with no subsets at the standard rate", () => {
    const price = resolveModelPrice("glm-5.3");
    if (!price) throw new Error("glm-5.3 must be priced");
    const buckets = { inputTokens: 1_000_000, outputTokens: 100_000, cachedTokens: 400_000, ...EMPTY_SUBSETS };

    expect(calculateAggregatedCost(buckets, price)).toBeCloseTo(
      calculateCost(1_000_000, 100_000, price, 400_000),
      10
    );
    // 600k uncached input, 400k cache reads, 100k output at the Go list rates.
    expect(calculateAggregatedCost(buckets, price)).toBeCloseTo(
      (600_000 / 1_000_000) * 1.4 + (400_000 / 1_000_000) * 0.26 + (100_000 / 1_000_000) * 4.4,
      10
    );
    expect(calculateAggregatedCost(buckets, price)).toBeCloseTo(1.384, 10);
  });

  it("moves the long-context subset to the long-context tier", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");
    const buckets = {
      inputTokens: 300_000,
      outputTokens: 3_000,
      cachedTokens: 0,
      ...EMPTY_SUBSETS,
      longContextInputTokens: 200_000,
      longContextOutputTokens: 2_000,
    };

    // 100k prompt tokens stay short context, 200k move to the long tier.
    expect(calculateAggregatedCost(buckets, price)).toBeCloseTo(
      (100_000 / 1_000_000) * 2 +
        (1_000 / 1_000_000) * 6 +
        (200_000 / 1_000_000) * 4 +
        (2_000 / 1_000_000) * 12,
      10
    );
  });

  it("moves the peak subset to the peak rate card", () => {
    const price = resolveModelPrice("deepseek-v4.1-flash");
    if (!price) throw new Error("deepseek-v4.1-flash must be priced");
    const buckets = {
      inputTokens: 300_000,
      outputTokens: 30_000,
      cachedTokens: 280_000,
      ...EMPTY_SUBSETS,
      peakInputTokens: 100_000,
      peakOutputTokens: 10_000,
      peakCachedTokens: 90_000,
    };

    // The remainder after removing the peak subset is priced off-peak.
    expect(calculateAggregatedCost(buckets, price)).toBeCloseTo(0.02961, 10);
  });

  it("bills stray peak buckets at the standard rate when the model has no peak card", () => {
    const price = resolveModelPrice("kimi-k3");
    if (!price) throw new Error("kimi-k3 must be priced");
    // The route never produces this state for a model without peak windows;
    // the helper must stay token-conserving all the same.
    const buckets = {
      inputTokens: 1_000,
      outputTokens: 100,
      cachedTokens: 0,
      ...EMPTY_SUBSETS,
      peakInputTokens: 400,
      peakOutputTokens: 40,
      peakCachedTokens: 0,
    };

    expect(calculateAggregatedCost(buckets, price)).toBeCloseTo(calculateCost(1_000, 100, price, 0), 10);
  });

  it("bills an empty aggregate as zero", () => {
    const price = resolveModelPrice("deepseek-v4.1-flash");
    if (!price) throw new Error("deepseek-v4.1-flash must be priced");
    expect(calculateAggregatedCost({ inputTokens: 0, outputTokens: 0, cachedTokens: 0, ...EMPTY_SUBSETS }, price)).toBe(0);
  });
});

describe("cost arithmetic edge cases", () => {
  const price = resolveModelPrice("kimi-k3");
  if (!price) throw new Error("kimi-k3 must be priced");

  it("bills nothing when there is no usage", () => {
    expect(calculateCost(0, 0, price, 0)).toBe(0);
  });

  it("clamps negative input and cache counts to zero", () => {
    // Output tokens are billed as reported; `UsageRecord` stores them as
    // non-negative integers, so only the input side needs a guard here.
    expect(calculateCost(-1_000, 0, price, -100)).toBe(0);
  });

  it("clamps cached tokens to the reported input instead of over-billing", () => {
    expect(calculateCost(1_000_000, 0, price, 5_000_000)).toBeCloseTo(0.3, 10);
  });

  it("bills no uncached input when cached tokens arrive without an input total", () => {
    // CLIProxyAPI can emit cached_tokens > 0 with input_tokens == 0 for subset
    // semantics; there is no uncached remainder to bill.
    expect(calculateCost(0, 0, price, 1_000)).toBe(0);
  });

  it("handles fractional token counts", () => {
    expect(calculateCost(0.5, 0.25, price, 0)).toBeCloseTo(
      (0.5 / 1_000_000) * 3 + (0.25 / 1_000_000) * 15,
      12
    );
  });

  it("treats an unparsable timestamp as off-peak instead of throwing", () => {
    const deepseek = resolveModelPrice("deepseek-v4.1-flash");
    if (!deepseek) throw new Error("deepseek-v4.1-flash must be priced");
    // A peak timestamp in the same test keeps this from passing against a stub
    // that always returns false.
    expect(isPeakRateTimestamp(new Date("2026-09-17T02:00:00Z"), deepseek)).toBe(true);
    expect(isPeakRateTimestamp(new Date("not-a-date"), deepseek)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  calculateCost,
  calculateTieredCost,
  isLongContextPrompt,
  resolveModelPrice,
  type ModelPrice,
} from "../model-pricing";

const EMPTY_BUCKETS = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

describe("resolveModelPrice - current-generation models", () => {
  it("prices current Anthropic models instead of reporting them unpriced", () => {
    const cases: Array<[string, string]> = [
      ["claude-opus-5", "Claude Opus 5"],
      ["claude-sonnet-5", "Claude Sonnet 5"],
      ["claude-fable-5-1", "Claude Fable 5.1"],
    ];

    for (const [model, displayName] of cases) {
      const price = resolveModelPrice(model);
      expect(price, `${model} should be priced`).not.toBeNull();
      expect(price?.displayName).toBe(displayName);
    }
  });

  it("prices current OpenAI models instead of reporting them unpriced", () => {
    const cases: Array<[string, string]> = [
      ["gpt-5.6-sol", "GPT-5.6 Sol"],
      ["gpt-5.6-luna", "GPT-5.6 Luna"],
      ["gpt-6-astra", "GPT-6 Astra"],
    ];

    for (const [model, displayName] of cases) {
      const price = resolveModelPrice(model);
      expect(price, `${model} should be priced`).not.toBeNull();
      expect(price?.displayName).toBe(displayName);
    }
  });

  it("does not price a new generation with an older generation's rate", () => {
    const gpt5 = resolveModelPrice("gpt-5");
    const sol = resolveModelPrice("gpt-5.6-sol");

    expect(sol?.displayName).toBe("GPT-5.6 Sol");
    expect(sol?.inputPer1M).toBe(4);
    expect(sol?.inputPer1M).not.toBe(gpt5?.inputPer1M);
    expect(sol?.outputPer1M).not.toBe(gpt5?.outputPer1M);
  });

  it("leaves an unknown variant of a newer generation unpriced rather than mispricing it", () => {
    // "gpt-5" must not absorb "gpt-5.6-*"; without an exact GPT-5.6 entry there
    // is nothing authoritative to report.
    expect(resolveModelPrice("gpt-5.6-nonexistent")).toBeNull();
    expect(resolveModelPrice("gpt-6-nonexistent")).toBeNull();
  });
});

describe("resolveModelPrice - prefix matching", () => {
  it("keeps matching dated snapshots of the same family", () => {
    expect(resolveModelPrice("claude-haiku-4-5-20251001")?.displayName).toBe("Claude Haiku 4.5");
    expect(resolveModelPrice("claude-sonnet-4.5-20260620")?.displayName).toBe("Claude Sonnet 4.5");
  });

  it("prefers the longest matching key", () => {
    expect(resolveModelPrice("claude-opus-4.6-20260101")?.displayName).toBe("Claude Opus 4.6");
    expect(resolveModelPrice("gpt-5.2-2026")?.displayName).toBe("GPT-5.2");
  });

  it("does not match across version-number boundaries", () => {
    expect(resolveModelPrice("claude-opus-5")?.displayName).not.toBe("Claude Opus 4");
    expect(resolveModelPrice("claude-sonnet-5")?.displayName).not.toBe("Claude Sonnet 4");
    expect(resolveModelPrice("gpt-5.2")?.displayName).not.toBe("GPT-5");
  });

  it("applies the same boundary rule after stripping a provider prefix", () => {
    expect(resolveModelPrice("cliproxyapi/gpt-5.6-sol")?.displayName).toBe("GPT-5.6 Sol");
    expect(resolveModelPrice("cliproxyapi/sonar-pro")?.displayName).toBe("Sonar Pro");
  });

  it("still returns null for unknown models", () => {
    expect(resolveModelPrice("totally-unknown-model")).toBeNull();
  });
});

describe("resolveModelPrice - CLIProxyAPI registry model IDs", () => {
  // IDs taken from CLIProxyAPI v7.3.4 `internal/registry/models/models.json`.
  const priced: Array<[string, string]> = [
    ["claude-opus-4-20250514", "Claude Opus 4"],
    ["claude-opus-4-1-20250805", "Claude Opus 4"],
    ["claude-opus-4-5-20251101", "Claude Opus 4.5"],
    ["claude-opus-4-6", "Claude Opus 4.6"],
    ["claude-opus-4-6-thinking", "Claude Opus 4.6"],
    ["claude-opus-4-7", "Claude Opus 4.7"],
    ["claude-opus-4-8", "Claude Opus 4.8"],
    ["claude-opus-5", "Claude Opus 5"],
    ["claude-sonnet-4-20250514", "Claude Sonnet 4"],
    ["claude-sonnet-4-5-20250929", "Claude Sonnet 4.5"],
    ["claude-sonnet-4-6", "Claude Sonnet 4.6"],
    ["claude-sonnet-5", "Claude Sonnet 5"],
    ["claude-haiku-4-5-20251001", "Claude Haiku 4.5"],
    ["claude-fable-5", "Claude Fable 5"],
    ["claude-fable-5-1", "Claude Fable 5.1"],
    ["gpt-5.6-sol", "GPT-5.6 Sol"],
    ["gpt-5.6-terra", "GPT-5.6 Terra"],
    ["gpt-5.6-luna", "GPT-5.6 Luna"],
    ["gpt-6-astra", "GPT-6 Astra"],
  ];

  it.each(priced)("prices %s", (modelId, displayName) => {
    expect(resolveModelPrice(modelId)?.displayName).toBe(displayName);
  });

  it("prices current Opus tiers at the post-4.5 rate card", () => {
    for (const modelId of [
      "claude-opus-4-5-20251101",
      "claude-opus-4-6",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-opus-5",
    ]) {
      const price = resolveModelPrice(modelId);
      expect(price?.inputPer1M, modelId).toBe(5);
      expect(price?.outputPer1M, modelId).toBe(25);
      expect(price?.cacheReadPer1M, modelId).toBe(0.5);
    }
  });

  it("prices legacy Opus 4/4.1 at the older rate card", () => {
    const price = resolveModelPrice("claude-opus-4-20250514");
    expect(price?.inputPer1M).toBe(15);
    expect(price?.outputPer1M).toBe(75);
  });

  it("leaves retired Claude 3 models unpriced rather than guessing", () => {
    expect(resolveModelPrice("claude-3-5-haiku-20241022")).toBeNull();
    expect(resolveModelPrice("claude-3-7-sonnet-20250219")).toBeNull();
    // No generic `claude-haiku` prefix exists: it used to price Haiku 3.x ids
    // at the retired Haiku 3 rate ($0.25/$1.25) instead of their real $0.80/$4.
    expect(resolveModelPrice("claude-haiku-3-5")).toBeNull();
    expect(resolveModelPrice("anthropic/claude-haiku-3-5")).toBeNull();
  });
});

describe("resolveModelPrice - xAI (Grok) official pricing", () => {
  // Source: https://docs.x.ai/developers/pricing (short-context tier,
  // "< 200k prompt tokens"). Values are USD per 1M tokens.
  const official: Array<{
    id: string;
    input: number;
    cached: number;
    output: number;
  }> = [
    { id: "grok-4.6", input: 2, cached: 0.5, output: 6 },
    { id: "grok-4.5", input: 2, cached: 0.3, output: 6 },
    { id: "grok-4.3", input: 1.25, cached: 0.2, output: 2.5 },
    { id: "grok-4.20-0309-reasoning", input: 1.25, cached: 0.2, output: 2.5 },
    { id: "grok-4.20-0309-non-reasoning", input: 1.25, cached: 0.2, output: 2.5 },
    { id: "grok-4.20-multi-agent-0309", input: 1.25, cached: 0.2, output: 2.5 },
    { id: "grok-build-0.1", input: 1, cached: 0.2, output: 2 },
  ];

  it.each(official)("prices $id at the official short-context rates", ({ id, input, cached, output }) => {
    const price = resolveModelPrice(id);
    expect(price, `${id} should be priced`).not.toBeNull();
    expect(price?.provider).toBe("xAI");
    expect(price?.inputPer1M).toBe(input);
    expect(price?.cacheReadPer1M).toBe(cached);
    expect(price?.outputPer1M).toBe(output);
  });

  // https://docs.x.ai/developers/models/grok-build-0.1 — documented aliases.
  const grokBuildAliases = ["grok-code-fast", "grok-code-fast-1", "grok-code-fast-1-0825"];

  it.each(grokBuildAliases)("bills the %s alias at Grok Build 0.1 rates", (alias) => {
    const price = resolveModelPrice(alias);
    expect(price?.inputPer1M).toBe(1);
    expect(price?.cacheReadPer1M).toBe(0.2);
    expect(price?.outputPer1M).toBe(2);
    expect(price?.displayName).toBe("Grok Build 0.1");
  });

  it("does not bill the retired grok-code-fast-1 slug at its historical rates", () => {
    // Retired 2026-05-15 and redirected to grok-build-0.1.
    // https://docs.x.ai/developers/migration/may-15-retirement
    const price = resolveModelPrice("grok-code-fast-1");
    expect(price?.inputPer1M).not.toBe(0.2);
    expect(price?.outputPer1M).not.toBe(1.5);
    expect(price?.cacheReadPer1M).not.toBe(0.02);
  });

  it("leaves grok-3-mini unpriced", () => {
    // Absent from the current official price table (and not a current API model).
    expect(resolveModelPrice("grok-3-mini")).toBeNull();
    expect(resolveModelPrice("grok-3-mini-fast")).toBeNull();
  });

  it("leaves unknown or future Grok slugs unpriced instead of guessing", () => {
    // A bare family name is not an officially priced ID.
    expect(resolveModelPrice("grok-4.20")).toBeNull();
    expect(resolveModelPrice("grok-4.20-0401-experimental")).toBeNull();
    expect(resolveModelPrice("grok-5")).toBeNull();
    expect(resolveModelPrice("grok-code-fast-2")).toBeNull();
    expect(resolveModelPrice("grok-4.1-fast")).toBeNull();
  });

  it("does not let a shorter key absorb a different version number", () => {
    // `grok-4.6` must not price `grok-4.60`, `grok-4.3` must not price `grok-4.30`.
    expect(resolveModelPrice("grok-4.60")).toBeNull();
    expect(resolveModelPrice("grok-4.30")).toBeNull();
    expect(resolveModelPrice("grok-4.5.1")).toBeNull();
  });

  it("leaves an ISO-dated slug unpriced because the price table does not list it", () => {
    // `grok-4.6-2026-09-01` is not an officially priced ID, so it must not
    // inherit the grok-4.6 rate.
    expect(resolveModelPrice("grok-4.6-2026-09-01")).toBeNull();
    expect(resolveModelPrice("grok-4.3-2026-05-15")).toBeNull();
  });
});

describe("resolveModelPrice - user overrides", () => {
  it("lets a user override win over the built-in table", () => {
    const override: Record<string, ModelPrice> = {
      "claude-opus-5": {
        displayName: "Custom Opus 5",
        inputPer1M: 1,
        outputPer1M: 2,
        provider: "Custom",
      },
    };

    expect(resolveModelPrice("claude-opus-5", override)?.displayName).toBe("Custom Opus 5");
  });

  it("normalizes override keys case-insensitively", () => {
    const override: Record<string, ModelPrice> = {
      "GPT-5": { displayName: "Custom GPT-5", inputPer1M: 1, outputPer1M: 2, provider: "Custom" },
    };

    expect(resolveModelPrice("gpt-5", override)?.displayName).toBe("Custom GPT-5");
  });
});

describe("xAI long-context tiering", () => {
  // https://docs.x.ai/developers/pricing — requests whose prompt reaches 200k
  // tokens are billed at the higher rate for *all* tokens in the request.
  const longContext: Array<{ id: string; input: number; cached: number; output: number }> = [
    { id: "grok-4.6", input: 4, cached: 1, output: 12 },
    { id: "grok-4.5", input: 4, cached: 0.6, output: 12 },
    { id: "grok-4.3", input: 2.5, cached: 0.4, output: 5 },
    { id: "grok-4.20-0309-reasoning", input: 2.5, cached: 0.4, output: 5 },
    { id: "grok-4.20-0309-non-reasoning", input: 2.5, cached: 0.4, output: 5 },
    { id: "grok-4.20-multi-agent-0309", input: 2.5, cached: 0.4, output: 5 },
    { id: "grok-build-0.1", input: 2, cached: 0.4, output: 4 },
  ];

  it.each(longContext)("stores the official long-context rates for $id", ({ id, input, cached, output }) => {
    const price = resolveModelPrice(id);
    expect(price?.longContext).toEqual({
      thresholdTokens: 200_000,
      inputPer1M: input,
      cacheReadPer1M: cached,
      outputPer1M: output,
    });
  });

  it("bills the Grok Build aliases at the Grok Build long-context rates", () => {
    for (const alias of ["grok-code-fast", "grok-code-fast-1", "grok-code-fast-1-0825"]) {
      expect(resolveModelPrice(alias)?.longContext, alias).toEqual({
        thresholdTokens: 200_000,
        inputPer1M: 2,
        cacheReadPer1M: 0.4,
        outputPer1M: 4,
      });
    }
  });

  it("qualifies at 200k prompt tokens: 200,000 is already long context", () => {
    const price = resolveModelPrice("grok-4.6");
    expect(price?.longContext?.thresholdTokens).toBe(200_000);
    expect(isLongContextPrompt(199_999, price)).toBe(false);
    expect(isLongContextPrompt(200_000, price)).toBe(true);
    expect(isLongContextPrompt(200_001, price)).toBe(true);
    expect(isLongContextPrompt(0, price)).toBe(false);
  });

  it("bills a 199,999-token request at the short-context rate", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");
    const buckets = { inputTokens: 199_999, outputTokens: 1_000, cachedTokens: 0 };

    expect(calculateTieredCost(buckets, { inputTokens: 0, outputTokens: 0, cachedTokens: 0 }, price)).toBeCloseTo(
      (199_999 / 1_000_000) * 2 + (1_000 / 1_000_000) * 6,
      10
    );
  });

  it("bills a 200,000-token request at the long-context rate", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");
    const longBuckets = { inputTokens: 200_000, outputTokens: 1_000, cachedTokens: 0 };
    const empty = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

    // Below the threshold the short-context rates apply...
    expect(calculateTieredCost(longBuckets, empty, price)).toBeCloseTo(
      (200_000 / 1_000_000) * 2 + (1_000 / 1_000_000) * 6,
      10
    );
    // ...and at/above it the whole request moves to the long-context rates.
    expect(calculateTieredCost(empty, longBuckets, price)).toBeCloseTo(
      (200_000 / 1_000_000) * 4 + (1_000 / 1_000_000) * 12,
      10
    );
  });

  it("bills a 200,001-token request at the long-context rate", () => {
    const price = resolveModelPrice("grok-build-0.1");
    if (!price) throw new Error("grok-build-0.1 must be priced");
    const cost = calculateTieredCost(
      { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
      { inputTokens: 200_001, outputTokens: 500, cachedTokens: 0 },
      price
    );

    expect(cost).toBeCloseTo((200_001 / 1_000_000) * 2 + (500 / 1_000_000) * 4, 10);
  });

  it("mixes several requests of the same model across both tiers", () => {
    const price = resolveModelPrice("grok-4.3");
    if (!price) throw new Error("grok-4.3 must be priced");

    // 150,000 prompt tokens (short) + 300,000 prompt tokens (long).
    const cost = calculateTieredCost(
      { inputTokens: 150_000, outputTokens: 1_000, cachedTokens: 0 },
      { inputTokens: 300_000, outputTokens: 2_000, cachedTokens: 0 },
      price
    );

    expect(cost).toBeCloseTo(
      (150_000 / 1_000_000) * 1.25 +
        (1_000 / 1_000_000) * 2.5 +
        (300_000 / 1_000_000) * 2.5 +
        (2_000 / 1_000_000) * 5,
      10
    );
  });

  it("handles a request that is almost entirely cached", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");

    // inputTokens (200k) already contains the 199k cached tokens, so only the
    // 1k uncached remainder is billed at the input rate.
    const cost = calculateCost(200_000, 1_000, price, 199_000);
    expect(cost).toBeCloseTo(
      (1_000 / 1_000_000) * 2 + (199_000 / 1_000_000) * 0.5 + (1_000 / 1_000_000) * 6,
      10
    );
  });

  it("handles a request with no cache at all", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");
    expect(calculateCost(300_000, 2_000, price, 0)).toBeCloseTo(
      (300_000 / 1_000_000) * 2 + (2_000 / 1_000_000) * 6,
      10
    );
  });

  it("keeps every xAI model on the short-context rate when there is no long bucket", () => {
    for (const { id } of longContext) {
      const price = resolveModelPrice(id);
      if (!price) throw new Error(`${id} must be priced`);
      const buckets = { inputTokens: 1_000, outputTokens: 100, cachedTokens: 0 };
      expect(
        calculateTieredCost(buckets, { inputTokens: 0, outputTokens: 0, cachedTokens: 0 }, price),
        id
      ).toBeCloseTo(calculateCost(1_000, 100, price, 0), 10);
    }
  });
});

describe("OpenAI GPT-5 family names, snapshots and aliases", () => {
  // https://developers.openai.com/api/docs/models/gpt-5
  // https://developers.openai.com/api/docs/models/gpt-5.2
  // https://developers.openai.com/api/docs/models/gpt-5.6
  const cases: Array<{ id: string; displayName: string; input: number; cached: number; output: number }> = [
    { id: "gpt-5", displayName: "GPT-5", input: 1.25, cached: 0.125, output: 10 },
    { id: "gpt-5-2025-08-07", displayName: "GPT-5", input: 1.25, cached: 0.125, output: 10 },
    { id: "gpt-5.2", displayName: "GPT-5.2", input: 1.75, cached: 0.175, output: 14 },
    { id: "gpt-5.2-2025-12-11", displayName: "GPT-5.2", input: 1.75, cached: 0.175, output: 14 },
    { id: "gpt-5.6", displayName: "GPT-5.6 Sol", input: 4, cached: 0.4, output: 20 },
  ];

  it.each(cases)("prices $id at the official rates", ({ id, displayName, input, cached, output }) => {
    const price = resolveModelPrice(id);
    expect(price).not.toBeNull();
    expect(price?.displayName).toBe(displayName);
    expect(price?.provider).toBe("OpenAI");
    expect(price?.inputPer1M).toBe(input);
    expect(price?.cacheReadPer1M).toBe(cached);
    expect(price?.outputPer1M).toBe(output);
    expect(price?.cacheAccounting).toBe("included");
  });

  it("does not give gpt-5 or gpt-5.2 a long-context tier", () => {
    // Neither model page publishes a long-context rate.
    expect(resolveModelPrice("gpt-5")?.longContext).toBeUndefined();
    expect(resolveModelPrice("gpt-5-2025-08-07")?.longContext).toBeUndefined();
    expect(resolveModelPrice("gpt-5.2")?.longContext).toBeUndefined();
    expect(resolveModelPrice("gpt-5.2-2025-12-11")?.longContext).toBeUndefined();
  });

  it("treats gpt-5.6 as the GPT-5.6 Sol alias, including its long-context tier", () => {
    const alias = resolveModelPrice("gpt-5.6");
    const sol = resolveModelPrice("gpt-5.6-sol");
    expect(alias?.longContext).toEqual(sol?.longContext);
    expect(alias?.longContext?.thresholdTokens).toBe(272_001);
  });

  it("never applies the gpt-5 rate to a different generation", () => {
    // `gpt-5.2` / `gpt-5.6` are separate versions, not gpt-5 snapshots.
    expect(resolveModelPrice("gpt-5.2")?.inputPer1M).not.toBe(resolveModelPrice("gpt-5")?.inputPer1M);
    expect(resolveModelPrice("gpt-5.6")?.inputPer1M).not.toBe(resolveModelPrice("gpt-5")?.inputPer1M);
  });

  it("leaves unknown future versions unpriced", () => {
    expect(resolveModelPrice("gpt-5.7")).toBeNull();
    expect(resolveModelPrice("gpt-5.3")).toBeNull();
    expect(resolveModelPrice("gpt-5.2.1")).toBeNull();
    expect(resolveModelPrice("gpt-5-2099-01-01")).toBeNull();
  });
});

describe("OpenAI long-context tiering and cache accounting", () => {
  // https://developers.openai.com/api/docs/models/gpt-5.6-sol — "Prompts with
  // more than 272K input tokens are priced at 2x input and 1.5x output for the
  // full request", so the first long-context size is 272,001.
  const openai: Array<{
    id: string;
    short: [number, number, number];
    long: [number, number, number];
  }> = [
    { id: "gpt-5.6-sol", short: [4, 0.4, 20], long: [8, 0.8, 30] },
    { id: "gpt-5.6-terra", short: [2, 0.2, 12], long: [4, 0.4, 18] },
    { id: "gpt-5.6-luna", short: [0.2, 0.02, 1.2], long: [0.4, 0.04, 1.8] },
    { id: "gpt-6-astra", short: [10, 1, 50], long: [20, 2, 75] },
  ];

  it.each(openai)("stores the official short and long rates for $id", ({ id, short, long }) => {
    const price = resolveModelPrice(id);
    expect(price).not.toBeNull();
    expect(price?.provider).toBe("OpenAI");
    expect(price?.cacheAccounting).toBe("included");
    expect([price?.inputPer1M, price?.cacheReadPer1M, price?.outputPer1M]).toEqual(short);
    expect(price?.longContext).toEqual({
      thresholdTokens: 272_001,
      inputPer1M: long[0],
      cacheReadPer1M: long[1],
      outputPer1M: long[2],
    });
  });

  it.each(openai)("treats 272,000 input tokens as short context for $id", ({ id }) => {
    const price = resolveModelPrice(id);
    expect(isLongContextPrompt(272_000, price), id).toBe(false);
    expect(isLongContextPrompt(272_001, price), id).toBe(true);
    expect(isLongContextPrompt(272_002, price), id).toBe(true);
  });

  it("bills a 272,000-token request at the short-context rate", () => {
    const price = resolveModelPrice("gpt-5.6-sol");
    if (!price) throw new Error("gpt-5.6-sol must be priced");

    expect(calculateTieredCost({ inputTokens: 272_000, outputTokens: 1_000, cachedTokens: 0 }, EMPTY_BUCKETS, price))
      .toBeCloseTo((272_000 / 1_000_000) * 4 + (1_000 / 1_000_000) * 20, 10);
  });

  it("bills a 272,001-token request at the long-context rate", () => {
    const price = resolveModelPrice("gpt-5.6-sol");
    if (!price) throw new Error("gpt-5.6-sol must be priced");

    expect(calculateTieredCost(EMPTY_BUCKETS, { inputTokens: 272_001, outputTokens: 1_000, cachedTokens: 0 }, price))
      .toBeCloseTo((272_001 / 1_000_000) * 8 + (1_000 / 1_000_000) * 30, 10);
  });

  it("does not bill cached OpenAI tokens twice", () => {
    const price = resolveModelPrice("gpt-5.6-terra");
    if (!price) throw new Error("gpt-5.6-terra must be priced");

    // 1M input of which 1M cached: only the cache-read rate applies to input.
    expect(calculateCost(1_000_000, 0, price, 1_000_000)).toBeCloseTo(0.2, 10);
    // 1M input of which 400k cached (uncached remainder + cached read).
    expect(calculateCost(1_000_000, 0, price, 400_000)).toBeCloseTo(
      (600_000 / 1_000_000) * 2 + (400_000 / 1_000_000) * 0.2,
      10
    );
  });

  it("bills a mostly-cached long-context request without double counting", () => {
    const price = resolveModelPrice("gpt-5.6-luna");
    if (!price) throw new Error("gpt-5.6-luna must be priced");

    // 300k prompt tokens (long context), 280k of them cached.
    const cost = calculateTieredCost(
      EMPTY_BUCKETS,
      { inputTokens: 300_000, outputTokens: 1_000, cachedTokens: 280_000 },
      price
    );

    expect(cost).toBeCloseTo(
      (20_000 / 1_000_000) * 0.4 + (280_000 / 1_000_000) * 0.04 + (1_000 / 1_000_000) * 1.8,
      10
    );
  });

  it("mixes short- and long-context requests of the same OpenAI model", () => {
    const price = resolveModelPrice("gpt-6-astra");
    if (!price) throw new Error("gpt-6-astra must be priced");

    // 100,000 prompt tokens (short) + 400,000 prompt tokens (long).
    const cost = calculateTieredCost(
      { inputTokens: 100_000, outputTokens: 1_000, cachedTokens: 0 },
      { inputTokens: 400_000, outputTokens: 2_000, cachedTokens: 0 },
      price
    );

    expect(cost).toBeCloseTo(
      (100_000 / 1_000_000) * 10 +
        (1_000 / 1_000_000) * 50 +
        (400_000 / 1_000_000) * 20 +
        (2_000 / 1_000_000) * 75,
      10
    );
  });
});

describe("alias IDs match exactly", () => {
  it("keeps unknown siblings of an alias unpriced", () => {
    // `gpt-5.6` is an alias for GPT-5.6 Sol, not a family prefix.
    expect(resolveModelPrice("gpt-5.6-nonexistent")).toBeNull();
    expect(resolveModelPrice("gpt-5.6-2027-01-01")).toBeNull();
    // Documented aliases of Grok Build 0.1.
    expect(resolveModelPrice("grok-code-fast-2")).toBeNull();
    expect(resolveModelPrice("grok-code-fast-1-9999")).toBeNull();
  });

  it("still resolves the alias IDs and their documented siblings", () => {
    expect(resolveModelPrice("gpt-5.6")?.displayName).toBe("GPT-5.6 Sol");
    expect(resolveModelPrice("gpt-5.6-sol")?.displayName).toBe("GPT-5.6 Sol");
    expect(resolveModelPrice("gpt-5.6-terra")?.displayName).toBe("GPT-5.6 Terra");
    expect(resolveModelPrice("gpt-5.6-luna")?.displayName).toBe("GPT-5.6 Luna");
    expect(resolveModelPrice("grok-code-fast-1-0825")?.inputPer1M).toBe(1);
    expect(resolveModelPrice("gpt-5.2-2025-12-11")?.inputPer1M).toBe(1.75);
  });
});

describe("cache accounting semantics", () => {
  it("marks xAI as reporting cached tokens inside inputTokens", () => {
    // CLIProxyAPI publishes xAI usage through the OpenAI-style parser, which
    // uses NewSubsetTokenBreakdown (prompt_tokens includes cached_tokens).
    expect(resolveModelPrice("grok-4.6")?.cacheAccounting).toBe("included");
    expect(resolveModelPrice("grok-code-fast-1")?.cacheAccounting).toBe("included");
  });

  it("keeps Anthropic on independent input/cache-read accounting", () => {
    // The Messages API reports cache_read_input_tokens separately from
    // input_tokens (NewIndependentTokenBreakdown), which is the default here.
    expect(resolveModelPrice("claude-opus-5")?.cacheAccounting).toBeUndefined();
    expect(calculateCost(1_000_000, 0, { ...resolveModelPrice("claude-opus-5")! })).toBe(5);
  });

  it("does not bill cached xAI tokens twice", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");

    // 1M input of which 1M cached: only the cache-read rate applies to input.
    expect(calculateCost(1_000_000, 0, price, 1_000_000)).toBeCloseTo(0.5, 10);
    // 1M input of which 400k cached.
    expect(calculateCost(1_000_000, 0, price, 400_000)).toBeCloseTo(
      (600_000 / 1_000_000) * 2 + (400_000 / 1_000_000) * 0.5,
      10
    );
  });

  it("clamps a cached count larger than the reported input", () => {
    const price = resolveModelPrice("grok-4.6");
    if (!price) throw new Error("grok-4.6 must be priced");
    expect(calculateCost(1_000_000, 0, price, 5_000_000)).toBeCloseTo(0.5, 10);
  });

  it("leaves models without a long-context configuration unchanged", () => {
    const claude = resolveModelPrice("claude-opus-5");
    const gpt4o = resolveModelPrice("gpt-4o");
    const oldGpt5 = resolveModelPrice("gpt-5");
    expect(claude?.longContext).toBeUndefined();
    expect(gpt4o?.longContext).toBeUndefined();
    expect(oldGpt5?.longContext).toBeUndefined();

    // A large prompt on a model without long-context rates costs the same as
    // the standard rate, so those totals do not move.
    const buckets = { inputTokens: 300_000, outputTokens: 3_000, cachedTokens: 0 };
    for (const price of [claude, gpt4o, oldGpt5]) {
      if (!price) throw new Error("expected a price");
      expect(isLongContextPrompt(300_000, price)).toBe(false);
      expect(calculateTieredCost(EMPTY_BUCKETS, buckets, price)).toBeCloseTo(
        calculateCost(300_000, 3_000, price, 0),
        10
      );
    }
  });
});

describe("calculateCost", () => {
  const price: ModelPrice = {
    displayName: "Test",
    inputPer1M: 10,
    outputPer1M: 20,
    cacheReadPer1M: 1,
    provider: "Test",
  };

  it("bills input and output tokens", () => {
    expect(calculateCost(1_000_000, 1_000_000, price)).toBe(30);
  });

  it("bills cache reads at the cache-read rate", () => {
    expect(calculateCost(1_000_000, 1_000_000, price, 1_000_000)).toBe(31);
  });

  it("falls back to the input rate when no cache-read price is published", () => {
    const withoutCacheRate: ModelPrice = { ...price, cacheReadPer1M: undefined };
    expect(calculateCost(1_000_000, 1_000_000, withoutCacheRate, 1_000_000)).toBe(40);
  });

  it("charges nothing for cache reads when there are none", () => {
    expect(calculateCost(500_000, 0, price)).toBe(5);
  });
});

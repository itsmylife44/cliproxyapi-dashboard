import { describe, expect, it } from "vitest";

import { buildCostBreakdown, formatRate, type UsageKey, type UsageModelTotals } from "../usage-cost-breakdown";
import type { ModelPrice } from "../model-pricing";

const PRICING: Record<string, ModelPrice> = {
  "test-included": {
    displayName: "Test Included",
    inputPer1M: 1.5,
    outputPer1M: 6,
    cacheReadPer1M: 0.15,
    cacheAccounting: "included",
    provider: "TestOpenAI",
  },
  "test-separate": {
    displayName: "Test Separate",
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    provider: "TestAnthropic",
  },
  "test-no-cache-rate": {
    displayName: "Test No Cache Rate",
    inputPer1M: 2,
    outputPer1M: 8,
    provider: "TestOther",
  },
};

function totals(partial: Partial<UsageModelTotals>): UsageModelTotals {
  return {
    totalRequests: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    longContextInputTokens: 0,
    longContextOutputTokens: 0,
    longContextCachedTokens: 0,
    peakInputTokens: 0,
    peakOutputTokens: 0,
    peakCachedTokens: 0,
    ...partial,
  };
}

function key(models: Record<string, UsageModelTotals>): UsageKey {
  return { keyName: "k", totalRequests: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, models };
}

function onlyRow<T>(rows: T[]): T {
  expect(rows).toHaveLength(1);
  const [row] = rows;
  if (!row) throw new Error("expected one row");
  return row;
}

function rowCost(row: { inputTokens: number; cachedTokens: number; outputTokens: number; inputPer1M: number; outputPer1M: number; cacheReadPer1M: number | undefined }) {
  return (
    (row.inputTokens / 1e6) * row.inputPer1M +
    (row.cachedTokens / 1e6) * (row.cacheReadPer1M ?? row.inputPer1M) +
    (row.outputTokens / 1e6) * row.outputPer1M
  );
}

describe("buildCostBreakdown", () => {
  it("shows uncached input and cached tokens separately for an 'included' model", () => {
    const keys = {
      a: key({ "test-included": totals({ inputTokens: 10_000_000, cachedTokens: 8_000_000, outputTokens: 100_000, totalRequests: 3 }) }),
      b: key({ "test-included": totals({ inputTokens: 8_200_000, cachedTokens: 7_000_000, outputTokens: 50_000, totalRequests: 2 }) }),
    };
    const row = onlyRow(buildCostBreakdown(keys, PRICING));

    expect(row.model).toBe("test-included");
    expect(row.priced).toBe(true);
    expect(row.inputTokens).toBe(3_200_000);
    expect(row.cachedTokens).toBe(15_000_000);
    expect(row.cacheReadPer1M).toBe(0.15);
    expect(row.requests).toBe(5);
    expect(row.estimatedCost).toBeCloseTo(rowCost(row), 10);
    // 3.2M*1.5 + 15M*0.15 + 0.15M*6
    expect(row.estimatedCost).toBeCloseTo(4.8 + 2.25 + 0.9, 10);
  });

  it("clamps uncached input at 0 when cached exceeds input for an 'included' model", () => {
    const keys = { a: key({ "test-included": totals({ inputTokens: 100, cachedTokens: 500 }) }) };
    const row = onlyRow(buildCostBreakdown(keys, PRICING));
    expect(row.inputTokens).toBe(0);
    expect(row.cachedTokens).toBe(500);
  });

  it("keeps summed input and shows cached tokens for a 'separate' model", () => {
    const keys = {
      a: key({ "test-separate": totals({ inputTokens: 1_000_000, cachedTokens: 4_000_000, outputTokens: 200_000 }) }),
      b: key({ "test-separate": totals({ inputTokens: 500_000, cachedTokens: 1_000_000, outputTokens: 100_000 }) }),
    };
    const row = onlyRow(buildCostBreakdown(keys, PRICING));

    expect(row.inputTokens).toBe(1_500_000);
    expect(row.cachedTokens).toBe(5_000_000);
    expect(row.cacheReadPer1M).toBe(0.3);
    expect(row.estimatedCost).toBeCloseTo(rowCost(row), 10);
    // 1.5M*3 + 5M*0.3 + 0.3M*15
    expect(row.estimatedCost).toBeCloseTo(4.5 + 1.5 + 4.5, 10);
  });

  it("leaves cacheReadPer1M undefined when the price has no cache-read rate", () => {
    const keys = { a: key({ "test-no-cache-rate": totals({ inputTokens: 1_000, outputTokens: 1_000 }) }) };
    const row = onlyRow(buildCostBreakdown(keys, PRICING));
    expect(row.cacheReadPer1M).toBeUndefined();
    expect(row.cachedTokens).toBe(0);
  });

  it("shows raw input and cached totals for unpriced models", () => {
    const keys = { a: key({ "totally-unknown-model-xyz": totals({ inputTokens: 1_000, cachedTokens: 400, outputTokens: 10 }) }) };
    const row = onlyRow(buildCostBreakdown(keys, PRICING));
    expect(row.priced).toBe(false);
    expect(row.inputTokens).toBe(1_000);
    expect(row.cachedTokens).toBe(400);
    expect(row.cacheReadPer1M).toBeUndefined();
    expect(row.estimatedCost).toBe(0);
  });
});

describe("formatRate", () => {
  it("shows three values when a cache-read rate is defined", () => {
    expect(formatRate({ inputPer1M: 1.5, cacheReadPer1M: 0.15, outputPer1M: 6 })).toBe("1.5/0.15/6");
  });

  it("shows two values when no cache-read rate is defined", () => {
    expect(formatRate({ inputPer1M: 2, cacheReadPer1M: undefined, outputPer1M: 8 })).toBe("2/8");
  });
});

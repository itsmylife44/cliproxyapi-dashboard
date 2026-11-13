import { resolveModelPrice, calculateTieredCost, type ModelPrice } from "@/lib/model-pricing";

/* ── Types ────────────────────────────────────────────────── */

export interface UsageModelTotals {
  totalRequests: number;
  totalTokens: number;
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

export interface UsageKey {
  keyName: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  models: Record<string, UsageModelTotals>;
}

export interface ModelCostEntry {
  model: string;
  displayName: string;
  provider: string;
  /**
   * Uncached input tokens for priced rows: `inputTokens - cachedTokens`
   * (clamped at 0) for `cacheAccounting: "included"` models, raw `inputTokens`
   * otherwise. Unpriced rows show raw `inputTokens` (accounting is unknown).
   */
  inputTokens: number;
  /** Cache-read tokens summed across keys. */
  cachedTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  estimatedCost: number;
  inputPer1M: number;
  outputPer1M: number;
  /** Standard cache-read rate, when the resolved price defines one. */
  cacheReadPer1M: number | undefined;
  priced: boolean;
}

export interface ProviderCostEntry {
  provider: string;
  estimatedCost: number;
  models: number;
  requests: number;
}

/* ── Builders ─────────────────────────────────────────────── */

type ModelAgg = Omit<UsageModelTotals, "totalRequests"> & { requests: number };

function emptyAgg(): ModelAgg {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    longContextInputTokens: 0,
    longContextOutputTokens: 0,
    longContextCachedTokens: 0,
    peakInputTokens: 0,
    peakOutputTokens: 0,
    peakCachedTokens: 0,
    totalTokens: 0,
    requests: 0,
  };
}

/** Input tokens excluding cache reads, mirroring `calculateCost`'s clamp. */
function uncachedInputTokens(inputTokens: number, cachedTokens: number, price: ModelPrice): number {
  if (price.cacheAccounting !== "included") return inputTokens;
  const input = Math.max(0, inputTokens);
  return input - Math.min(Math.max(0, cachedTokens), input);
}

export function buildCostBreakdown(keys: Record<string, UsageKey>, customPricing: Record<string, ModelPrice>): ModelCostEntry[] {
  // Aggregate all models across all keys
  const modelAgg: Record<string, ModelAgg> = {};

  for (const key of Object.values(keys)) {
    for (const [model, data] of Object.entries(key.models)) {
      const agg = (modelAgg[model] ??= emptyAgg());
      agg.inputTokens += data.inputTokens;
      agg.outputTokens += data.outputTokens;
      agg.cachedTokens += data.cachedTokens;
      agg.longContextInputTokens += data.longContextInputTokens;
      agg.longContextOutputTokens += data.longContextOutputTokens;
      agg.longContextCachedTokens += data.longContextCachedTokens;
      agg.peakInputTokens += data.peakInputTokens;
      agg.peakOutputTokens += data.peakOutputTokens;
      agg.peakCachedTokens += data.peakCachedTokens;
      agg.totalTokens += data.totalTokens;
      agg.requests += data.totalRequests;
    }
  }

  return Object.entries(modelAgg)
    .map(([model, data]): ModelCostEntry => {
      const price = resolveModelPrice(model, customPricing);
      // The long-context and peak subsets were bucketed per request
      // server-side (disjoint); the remainder is the standard tier.
      const estimatedCost = price
        ? calculateTieredCost(
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
          )
        : 0;
      return {
        model,
        displayName: price?.displayName ?? model,
        provider: price?.provider ?? "Unknown",
        inputTokens: price ? uncachedInputTokens(data.inputTokens, data.cachedTokens, price) : data.inputTokens,
        cachedTokens: data.cachedTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        requests: data.requests,
        estimatedCost,
        inputPer1M: price?.inputPer1M ?? 0,
        outputPer1M: price?.outputPer1M ?? 0,
        cacheReadPer1M: price?.cacheReadPer1M,
        priced: price !== null,
      };
    })
    .sort((a, b) => b.estimatedCost - a.estimatedCost);
}

export function aggregateByProvider(entries: ModelCostEntry[]): ProviderCostEntry[] {
  const providerMap: Record<string, ProviderCostEntry> = {};
  for (const entry of entries) {
    if (!entry.priced) continue;
    let provider = providerMap[entry.provider];
    if (!provider) {
      provider = { provider: entry.provider, estimatedCost: 0, models: 0, requests: 0 };
      providerMap[entry.provider] = provider;
    }
    provider.estimatedCost += entry.estimatedCost;
    provider.models += 1;
    provider.requests += entry.requests;
  }
  return Object.values(providerMap).sort((a, b) => b.estimatedCost - a.estimatedCost);
}

/** Rate column text: `in/cacheRead/out` when a cache-read rate exists, else `in/out`. */
export function formatRate(entry: Pick<ModelCostEntry, "inputPer1M" | "outputPer1M" | "cacheReadPer1M">): string {
  return entry.cacheReadPer1M !== undefined
    ? `${entry.inputPer1M}/${entry.cacheReadPer1M}/${entry.outputPer1M}`
    : `${entry.inputPer1M}/${entry.outputPer1M}`;
}

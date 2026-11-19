import { resolveModelPrice, calculateTieredCost, splitCachedInput, type ModelPrice } from "@/lib/model-pricing";

/* ── Types ────────────────────────────────────────────────── */

export interface UsageModelTotals {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens?: number;
  cacheWrite1hTokens?: number;
  longContextInputTokens: number;
  longContextOutputTokens: number;
  longContextCachedTokens: number;
  longContextCacheWriteTokens?: number;
  longContextCacheWrite1hTokens?: number;
  peakInputTokens: number;
  peakOutputTokens: number;
  peakCachedTokens: number;
  peakCacheWriteTokens?: number;
  peakCacheWrite1hTokens?: number;
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
  /**
   * Cache-read tokens summed across keys; for priced `"included"` models,
   * clamped to the input total as `calculateCost` does.
   */
  cachedTokens: number;
  cacheWriteTokens: number;
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

export interface ModelBreakdownEntry {
  model: string;
  provider?: string;
  requests: number;
  tokens: number;
  successCount?: number;
  failureCount?: number;
  failureRate?: number;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  maxLatencyMs?: number;
  latencySampleCount?: number;
}

export interface ProviderBreakdownEntry {
  provider: string;
  models: number;
  requests: number;
  tokens: number;
  successCount: number;
  failureCount: number;
  failureRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  latencySampleCount: number;
}

const VENDOR_PREFIX_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "google-vertex": "Google",
  gemini: "Google",
  xai: "xAI",
  "x-ai": "xAI",
  deepseek: "DeepSeek",
  zhipuai: "Zhipu AI",
  "z-ai": "Zhipu AI",
  zai: "Zhipu AI",
  moonshotai: "Moonshot AI",
  moonshot: "Moonshot AI",
  qwen: "Alibaba",
  alibaba: "Alibaba",
  minimax: "MiniMax",
  xiaomi: "Xiaomi",
  mimo: "Xiaomi",
  perplexity: "Perplexity",
  "meta-llama": "Meta",
  meta: "Meta",
  mistralai: "Mistral",
  mistral: "Mistral",
};

/**
 * Resolve the canonical provider name for a model slug when the pricing entry
 * is absent (e.g. `-free` variants or preview slugs).
 */
export function inferModelProvider(model: string, resolvedProvider?: string): string {
  if (resolvedProvider && resolvedProvider !== "Unknown") {
    return resolvedProvider;
  }

  const lower = model.trim().toLowerCase();
  const slashIdx = lower.indexOf("/");
  if (slashIdx > 0) {
    const vendor = lower.slice(0, slashIdx);
    const mapped = VENDOR_PREFIX_LABELS[vendor];
    if (mapped) return mapped;
  }

  const bare = slashIdx > 0 ? lower.slice(slashIdx + 1) : lower;

  if (bare.startsWith("claude-")) return "Anthropic";
  if (
    bare.startsWith("gpt-") ||
    bare.startsWith("chatgpt-") ||
    bare.includes("codex") ||
    /^o[134](?:-|$)/.test(bare)
  ) {
    return "OpenAI";
  }
  if (
    bare.startsWith("gemini-") ||
    bare.startsWith("gemma-") ||
    bare.startsWith("imagen-") ||
    bare.startsWith("learnlm-")
  ) {
    return "Google";
  }
  if (bare.startsWith("grok-")) return "xAI";
  if (bare.startsWith("deepseek-")) return "DeepSeek";
  if (bare.startsWith("glm-") || bare.startsWith("chatglm")) return "Zhipu AI";
  if (bare.startsWith("kimi-") || bare.startsWith("moonshot-")) return "Moonshot AI";
  if (bare.startsWith("qwen") || bare.startsWith("qwq-")) return "Alibaba";
  if (bare.startsWith("mimo-")) return "Xiaomi";
  if (bare.startsWith("minimax-") || bare.startsWith("abab")) return "MiniMax";
  if (bare.startsWith("sonar") || bare.startsWith("perplexity-") || bare.startsWith("r1-1776")) {
    return "Perplexity";
  }
  if (bare.startsWith("llama-")) return "Meta";
  if (
    bare.startsWith("mistral-") ||
    bare.startsWith("mixtral-") ||
    bare.startsWith("codestral-") ||
    bare.startsWith("pixtral-")
  ) {
    return "Mistral";
  }
  if (bare.startsWith("muse-")) return "Muse";

  return "Unknown";
}

/* ── Builders ─────────────────────────────────────────────── */

type ModelAgg = Required<Omit<UsageModelTotals, "totalRequests">> & { requests: number };

function emptyAgg(): ModelAgg {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    cacheWrite1hTokens: 0,
    longContextInputTokens: 0,
    longContextOutputTokens: 0,
    longContextCachedTokens: 0,
    longContextCacheWriteTokens: 0,
    longContextCacheWrite1hTokens: 0,
    peakInputTokens: 0,
    peakOutputTokens: 0,
    peakCachedTokens: 0,
    peakCacheWriteTokens: 0,
    peakCacheWrite1hTokens: 0,
    totalTokens: 0,
    requests: 0,
  };
}

export function buildCostBreakdown(
  keys: Record<string, UsageKey>,
  customPricing: Record<string, ModelPrice>,
  livePricing?: Record<string, ModelPrice>
): ModelCostEntry[] {
  // Aggregate all models across all keys
  const modelAgg: Record<string, ModelAgg> = {};

  for (const key of Object.values(keys)) {
    for (const [model, data] of Object.entries(key.models)) {
      const agg = (modelAgg[model] ??= emptyAgg());
      agg.inputTokens += data.inputTokens;
      agg.outputTokens += data.outputTokens;
      agg.cachedTokens += data.cachedTokens;
      agg.cacheWriteTokens += data.cacheWriteTokens ?? 0;
      agg.cacheWrite1hTokens += data.cacheWrite1hTokens ?? 0;
      agg.longContextInputTokens += data.longContextInputTokens;
      agg.longContextOutputTokens += data.longContextOutputTokens;
      agg.longContextCachedTokens += data.longContextCachedTokens;
      agg.longContextCacheWriteTokens += data.longContextCacheWriteTokens ?? 0;
      agg.longContextCacheWrite1hTokens += data.longContextCacheWrite1hTokens ?? 0;
      agg.peakInputTokens += data.peakInputTokens;
      agg.peakOutputTokens += data.peakOutputTokens;
      agg.peakCachedTokens += data.peakCachedTokens;
      agg.peakCacheWriteTokens += data.peakCacheWriteTokens ?? 0;
      agg.peakCacheWrite1hTokens += data.peakCacheWrite1hTokens ?? 0;
      agg.totalTokens += data.totalTokens;
      agg.requests += data.totalRequests;
    }
  }

  return Object.entries(modelAgg)
    .map(([model, data]): ModelCostEntry => {
      const price = resolveModelPrice(model, customPricing, livePricing);
      // The long-context and peak subsets were bucketed per request
      // server-side (disjoint); the remainder is the standard tier.
      const estimatedCost = price
        ? calculateTieredCost(
            {
              inputTokens: data.inputTokens - data.longContextInputTokens - data.peakInputTokens,
              outputTokens: data.outputTokens - data.longContextOutputTokens - data.peakOutputTokens,
              cachedTokens: data.cachedTokens - data.longContextCachedTokens - data.peakCachedTokens,
              cacheWriteTokens: data.cacheWriteTokens - data.longContextCacheWriteTokens - data.peakCacheWriteTokens,
              cacheWrite1hTokens: data.cacheWrite1hTokens - data.longContextCacheWrite1hTokens - data.peakCacheWrite1hTokens,
            },
            {
              inputTokens: data.longContextInputTokens,
              outputTokens: data.longContextOutputTokens,
              cachedTokens: data.longContextCachedTokens,
              cacheWriteTokens: data.longContextCacheWriteTokens,
              cacheWrite1hTokens: data.longContextCacheWrite1hTokens,
            },
            price,
            {
              inputTokens: data.peakInputTokens,
              outputTokens: data.peakOutputTokens,
              cachedTokens: data.peakCachedTokens,
              cacheWriteTokens: data.peakCacheWriteTokens,
              cacheWrite1hTokens: data.peakCacheWrite1hTokens,
            }
          )
        : 0;
      // Priced rows show exactly what `calculateCost` bills; unpriced rows have
      // no known accounting mode, so they show raw totals.
      const shown = price
        ? splitCachedInput(data.inputTokens, data.cachedTokens, price)
        : { uncachedInput: data.inputTokens, cached: data.cachedTokens };
      return {
        model,
        displayName: price?.displayName ?? model,
        provider: inferModelProvider(model, price?.provider),
        inputTokens: shown.uncachedInput,
        cachedTokens: shown.cached,
        cacheWriteTokens: data.cacheWriteTokens,
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
    .sort((a, b) => b.estimatedCost - a.estimatedCost || b.requests - a.requests);
}

export function aggregateByProvider(entries: ModelCostEntry[]): ProviderCostEntry[] {
  const providerMap: Record<string, ProviderCostEntry> = {};
  for (const entry of entries) {
    let provider = providerMap[entry.provider];
    if (!provider) {
      provider = { provider: entry.provider, estimatedCost: 0, models: 0, requests: 0 };
      providerMap[entry.provider] = provider;
    }
    provider.estimatedCost += entry.estimatedCost;
    provider.models += 1;
    provider.requests += entry.requests;
  }
  return Object.values(providerMap).sort((a, b) => b.estimatedCost - a.estimatedCost || b.requests - a.requests);
}

/** Rate column text: `in/cacheRead/out` when a cache-read rate exists, else `in/out`. */
export function formatRate(entry: Pick<ModelCostEntry, "inputPer1M" | "outputPer1M" | "cacheReadPer1M">): string {
  return entry.cacheReadPer1M !== undefined
    ? `${entry.inputPer1M}/${entry.cacheReadPer1M}/${entry.outputPer1M}`
    : `${entry.inputPer1M}/${entry.outputPer1M}`;
}

export function calculateKeySpend(
  models: Record<string, UsageModelTotals>,
  customPricing: Record<string, ModelPrice> = {},
  livePricing?: Record<string, ModelPrice>
): number {
  if (Object.keys(models).length === 0) return 0;
  return buildCostBreakdown(
    {
      key: {
        keyName: "",
        totalRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        models,
      },
    },
    customPricing,
    livePricing
  ).reduce((sum, entry) => sum + entry.estimatedCost, 0);
}

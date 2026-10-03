/**
 * Model price resolution and cost estimation.
 *
 * Prices come from `model-pricing-table.ts` and can be overridden by the user
 * (persisted in localStorage). Resolution order:
 *
 *   1. exact match, user overrides first, then the built-in table
 *   2. longest-prefix match at a version boundary, so
 *      "claude-sonnet-4.5-20260620" resolves to "claude-sonnet-4.5" while
 *      "gpt-5" does not absorb "gpt-5.6-sol"
 *   3. provider-prefix fallback, so "opencode-go/kimi-k3" resolves to "kimi-k3"
 *
 * A model that still does not match is reported as "unpriced" instead of being
 * billed at a similar model's rate.
 */

import { DEFAULT_MODEL_PRICING, type ModelPrice } from "./model-pricing-table";

export { DEFAULT_MODEL_PRICING } from "./model-pricing-table";
export type { LongContextPrice, ModelPrice, PeakRateWindow, PeakRates } from "./model-pricing-table";

const LOCALSTORAGE_KEY = "cliproxy-custom-pricing";

/**
 * A prefix key only matches at a version boundary: a shorter key must not
 * absorb a different version number.
 *
 *   "gpt-5" + ".6-sol"           → rejected (gpt-5.6 is a different generation)
 *   "claude-haiku" + "-4-5-…"    → accepted (dated snapshot of the same family)
 *   "grok-code-fast" + "-2"      → rejected (a new slug, not this alias)
 *   "claude-opus-4" + "-1-…"     → accepted (version-qualified key)
 */
function isVersionBoundaryMatch(model: string, key: string): boolean {
  const remainder = model.slice(key.length);
  if (remainder.length === 0) return true;

  const first = remainder.charAt(0);
  if (first >= "0" && first <= "9") return false;

  if (first === ".") {
    const second = remainder.charAt(1);
    if (second >= "0" && second <= "9") return false;
  }

  // A trailing short number is a new version, not a snapshot of `key`
  // ("grok-code-fast-2" must not be billed as the `grok-code-fast` alias).
  // Keys that are already version-qualified stay permissive, so dated
  // snapshots such as "claude-opus-4-1-20250805" keep resolving.
  if (!/\d$/.test(key) && /^-\d{1,3}$/.test(remainder)) {
    return false;
  }

  // An ISO-dated slug names a specific release the price table does not list
  // (e.g. "grok-4.6-2026-09-01"); it must stay unpriced instead of inheriting
  // the family rate.
  if (/^-\d{4}-\d{2}-\d{2}/.test(remainder)) {
    return false;
  }

  return true;
}

/**
 * Resolve the price for a given model name.
 *
 * 1. Exact match against user overrides → built-in table
 * 2. Longest-prefix match (e.g. "claude-sonnet-4.5-20260620" → "claude-sonnet-4.5")
 * 3. null if no match found
 */
export function resolveModelPrice(model: string, customPricing?: Record<string, ModelPrice>): ModelPrice | null {
  const lowerModel = model.toLowerCase();
  const normalizedCustom: Record<string, ModelPrice> = {};
  if (customPricing) {
    for (const [k, v] of Object.entries(customPricing)) {
      normalizedCustom[k.toLowerCase()] = v;
    }
  }
  const merged = { ...DEFAULT_MODEL_PRICING, ...normalizedCustom };

  // Exact match
  if (merged[lowerModel]) return merged[lowerModel];

  // Prefix match: try progressively shorter prefixes
  const keys = Object.keys(merged).sort((a, b) => b.length - a.length);

  const findByPrefix = (candidate: string): ModelPrice | null => {
    for (const key of keys) {
      const matchedPrice = merged[key];
      if (!matchedPrice) continue;
      // Aliases and dated snapshots are exact IDs, never prefixes.
      if (matchedPrice.exactMatchOnly) continue;
      if (candidate.startsWith(key) && isVersionBoundaryMatch(candidate, key)) {
        return matchedPrice;
      }
    }
    return null;
  };

  const prefixMatch = findByPrefix(lowerModel);
  if (prefixMatch) return prefixMatch;

  // Try matching without provider prefix (e.g. "cliproxyapi/sonar-pro" → "sonar-pro")
  const withoutPrefix = lowerModel.includes("/") ? lowerModel.split("/").pop()! : null;
  if (withoutPrefix) {
    if (merged[withoutPrefix]) return merged[withoutPrefix];
    return findByPrefix(withoutPrefix);
  }

  return null;
}

/**
 * Whether a request's prompt reaches its model's long-context threshold.
 *
 * The prompt size is `inputTokens`: for the providers that publish long-context
 * tiers (OpenAI-compatible, including xAI and OpenAI) CLIProxyAPI derives
 * `input_tokens` from `prompt_tokens`, which already includes the cached prompt
 * tokens (`usage.NewSubsetTokenBreakdown` in `sdk/cliproxy/usage/accounting.go`).
 *
 * The threshold is per model (xAI: 200_000, OpenAI: 272_001), so models without
 * a long-context configuration are never tiered.
 */
export function isLongContextPrompt(
  inputTokens: number,
  price: ModelPrice | null | undefined
): boolean {
  const threshold = price?.longContext?.thresholdTokens;
  return threshold !== undefined && inputTokens >= threshold;
}

/**
 * Whether a request timestamp falls inside one of a model's peak windows.
 *
 * The comparison is done in UTC, because the published windows are UTC
 * ("Peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday").
 * Windows are half-open, so 04:00:00 is already off-peak again.
 *
 * Models without `peak` windows are never in peak hours, so their aggregated
 * peak buckets stay at zero.
 */
export function isPeakRateTimestamp(
  timestamp: Date,
  price: ModelPrice | null | undefined
): boolean {
  const peak = price?.peak;
  if (!peak || peak.windows.length === 0) return false;

  const weekday = timestamp.getUTCDay();
  const hour = timestamp.getUTCHours();

  return peak.windows.some(
    (window) =>
      window.weekdaysUtc.includes(weekday) &&
      hour >= window.startHourUtc &&
      hour < window.endHourUtc
  );
}

/**
 * The model's price with its peak rates applied, or `null` when the model has
 * no peak windows.
 *
 * Callers price the tokens that fall inside the peak windows with the returned
 * price and everything else with the base price.
 */
export function peakRatePrice(price: ModelPrice): ModelPrice | null {
  if (!price.peak) return null;
  return {
    ...price,
    inputPer1M: price.peak.inputPer1M,
    outputPer1M: price.peak.outputPer1M,
    cacheReadPer1M: price.peak.cacheReadPer1M,
  };
}

/**
 * Calculate estimated cost for a set of tokens.
 *
 * The cache-read rate falls back to `inputPer1M` when the provider publishes no
 * distinct cache-read price. How cached tokens relate to `inputTokens` is
 * provider-specific and follows `ModelPrice.cacheAccounting`:
 *
 * - `"separate"` (default, e.g. Anthropic): `inputTokens` excludes cache reads,
 *   so both buckets are billed.
 * - `"included"` (e.g. xAI/OpenAI-compatible): `inputTokens` already contains
 *   the cached tokens, so only the uncached remainder is billed at `inputPer1M`.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  price: ModelPrice,
  cachedTokens = 0
): number {
  const cacheReadRate = price.cacheReadPer1M ?? price.inputPer1M;
  const cacheReadTokens = Math.max(0, cachedTokens);

  if (price.cacheAccounting === "included") {
    const cached = Math.min(cacheReadTokens, Math.max(0, inputTokens));
    const uncachedInput = Math.max(0, inputTokens) - cached;
    return (
      (uncachedInput / 1_000_000) * price.inputPer1M +
      (cached / 1_000_000) * cacheReadRate +
      (outputTokens / 1_000_000) * price.outputPer1M
    );
  }

  return (
    (inputTokens / 1_000_000) * price.inputPer1M +
    (cacheReadTokens / 1_000_000) * cacheReadRate +
    (outputTokens / 1_000_000) * price.outputPer1M
  );
}

/** Token totals for one prompt-size tier. */
export interface TokenBuckets {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

/**
 * Cost for a model split into short-context and long-context buckets.
 *
 * The long-context tier is chosen per request before aggregation, because
 * providers bill the *whole* request at the higher rate once its prompt reaches
 * the threshold — it cannot be derived from a summed model total.
 */
export function calculateTieredCost(
  shortContext: TokenBuckets,
  longContext: TokenBuckets,
  price: ModelPrice
): number {
  const shortCost = calculateCost(
    shortContext.inputTokens,
    shortContext.outputTokens,
    price,
    shortContext.cachedTokens
  );

  if (!price.longContext) {
    return (
      shortCost +
      calculateCost(
        longContext.inputTokens,
        longContext.outputTokens,
        price,
        longContext.cachedTokens
      )
    );
  }

  const longPrice: ModelPrice = {
    ...price,
    inputPer1M: price.longContext.inputPer1M,
    cacheReadPer1M: price.longContext.cacheReadPer1M,
    outputPer1M: price.longContext.outputPer1M,
  };
  return (
    shortCost +
    calculateCost(
      longContext.inputTokens,
      longContext.outputTokens,
      longPrice,
      longContext.cachedTokens
    )
  );
}

/**
 * Aggregated usage for one model, as the usage history route reports it.
 *
 * `longContext*` and `peak*` are per-request subsets of the totals, so a record
 * is only ever counted once. A model with peak windows has no long-context tier
 * (see `PeakRates`), so the two subsets never overlap.
 */
export interface AggregatedUsageBuckets {
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

/**
 * Cost for one model's aggregated buckets.
 *
 * Everything outside the long-context and peak subsets is the off-peak,
 * short-context remainder billed at the model's standard rates; the
 * long-context subset moves to the long-context tier and the peak subset to the
 * peak rate card. Models without peak windows have all-zero peak buckets, so
 * the second term drops out.
 *
 * Correctness rests on the table invariant that no model has both a peak card
 * and a long-context tier: the two subsets are subtracted independently, so an
 * overlapping pair would double-bill. The pricing tests enforce it.
 */
export function calculateAggregatedCost(buckets: AggregatedUsageBuckets, price: ModelPrice): number {
  const peakPrice = peakRatePrice(price);
  // Only split the peak bucket out when the model has a peak card to bill it
  // with. The route never fills peak buckets for any other model; treating a
  // stray bucket as part of the standard totals keeps this helper
  // token-conserving rather than silently dropping it.
  const peak = peakPrice
    ? {
        inputTokens: buckets.peakInputTokens,
        outputTokens: buckets.peakOutputTokens,
        cachedTokens: buckets.peakCachedTokens,
      }
    : { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  const standardCost = calculateTieredCost(
    {
      inputTokens: buckets.inputTokens - buckets.longContextInputTokens - peak.inputTokens,
      outputTokens: buckets.outputTokens - buckets.longContextOutputTokens - peak.outputTokens,
      cachedTokens: buckets.cachedTokens - buckets.longContextCachedTokens - peak.cachedTokens,
    },
    {
      inputTokens: buckets.longContextInputTokens,
      outputTokens: buckets.longContextOutputTokens,
      cachedTokens: buckets.longContextCachedTokens,
    },
    price
  );

  if (!peakPrice) return standardCost;

  return (
    standardCost +
    calculateCost(peak.inputTokens, peak.outputTokens, peakPrice, peak.cachedTokens)
  );
}

/**
 * Load user-customized pricing from localStorage.
 */
export function loadCustomPricing(): Record<string, ModelPrice> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, ModelPrice>;
  } catch {
    return {};
  }
}

/**
 * Save user-customized pricing to localStorage.
 */
export function saveCustomPricing(pricing: Record<string, ModelPrice>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(pricing));
}

/**
 * Format a USD amount for display.
 */
export function formatUSD(amount: number): string {
  if (!Number.isFinite(amount)) return "$0.00";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}$${abs.toFixed(3)}`;
  return `${sign}$${abs.toFixed(4)}`;
}

/**
 * Default model pricing database.
 *
 * Prices are in USD per 1 million tokens.
 * Users can override these via the Settings page (persisted in localStorage).
 *
 * When a model is not found, we attempt prefix matching:
 *   "claude-sonnet-4.5-xxx" → matches "claude-sonnet-4.5"
 * A shorter key only matches at a version boundary, so "gpt-5" does NOT match
 * "gpt-5.6-sol" (that would silently price a newer model at an older rate).
 * If still unmatched the request is tagged as "unpriced".
 */

/**
 * Rates that apply once a request's prompt reaches a model's long-context
 * threshold.
 */
export interface LongContextPrice {
  /**
   * Smallest prompt-token count billed at these rates (inclusive lower bound).
   * The vendors word this differently, so the boundary is expressed as the
   * first qualifying size:
   * - xAI bills a request once its prompt *reaches* 200k → 200_000 qualifies
   *   (https://docs.x.ai/developers/pricing).
   * - OpenAI bills a request once its prompt is *above* 272k → 272_001 is the
   *   first qualifying size (https://developers.openai.com/api/docs/models/gpt-5.6-sol).
   */
  thresholdTokens: number;
  /** USD per 1M input tokens */
  inputPer1M: number;
  /** USD per 1M cached (cache read) input tokens */
  cacheReadPer1M: number;
  /** USD per 1M output tokens */
  outputPer1M: number;
}

/** First prompt size billed at xAI long-context rates. */
const XAI_LONG_CONTEXT_MIN_TOKENS = 200_000;
/** First prompt size billed at OpenAI long-context rates ("more than 272k"). */
const OPENAI_LONG_CONTEXT_MIN_TOKENS = 272_001;

export interface ModelPrice {
  /** Display name for the model family */
  displayName: string;
  /** USD per 1M input tokens */
  inputPer1M: number;
  /** USD per 1M output tokens */
  outputPer1M: number;
  /**
   * USD per 1M cached (cache read) input tokens. Falls back to `inputPer1M`
   * when the provider does not publish a distinct cache-read rate.
   */
  cacheReadPer1M?: number;
  /**
   * How the provider reports cache reads relative to `inputTokens`:
   * - `"separate"` (default): `inputTokens` excludes cache reads, so both are
   *   billed independently. This is Anthropic's Messages API shape, used by
   *   CLIProxyAPI's `NewIndependentTokenBreakdown`.
   * - `"included"`: `inputTokens` already contains the cached tokens, so only
   *   the uncached remainder is billed at `inputPer1M`. This is the shape of
   *   OpenAI-compatible usage (`prompt_tokens` includes
   *   `prompt_tokens_details.cached_tokens`), which CLIProxyAPI normalizes with
   *   `NewSubsetTokenBreakdown` and which the xAI executor publishes via
   *   `helps.ParseOpenAIUsage` / `helps.ParseCodexUsage`.
   */
  cacheAccounting?: "separate" | "included";
  /** Rates for requests whose prompt reaches LONG_CONTEXT_THRESHOLD_TOKENS. */
  longContext?: LongContextPrice;
  /**
   * Restricts this entry to an exact model ID. Set for documented aliases and
   * dated snapshots (`gpt-5.6` → GPT-5.6 Sol, `grok-code-fast-1`, …) so an
   * unknown sibling slug such as `gpt-5.6-nonexistent` is not silently billed
   * at the alias's rate.
   */
  exactMatchOnly?: boolean;
  /** Optional: provider grouping */
  provider: string;
}

/**
 * Built-in pricing table.  Keep alphabetically sorted by key.
 * Source: official pricing pages as of September 2026.
 */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPrice> = {
  // ── Anthropic ──────────────────────────────────────────────
  // Cache reads cost 0.1x the input rate, except Fable 5/5.1 (2.5% on 5.1).
  // Keys follow CLIProxyAPI's model registry ID form (`claude-opus-4-6`, ...);
  // the dotted variants are kept for reseller passthrough IDs.
  "claude-haiku-4-5": {
    displayName: "Claude Haiku 4.5",
    inputPer1M: 1,
    outputPer1M: 5,
    cacheReadPer1M: 0.1,
    provider: "Anthropic",
  },
  "claude-sonnet-4": {
    displayName: "Claude Sonnet 4",
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    provider: "Anthropic",
  },
  "claude-sonnet-4.5": {
    displayName: "Claude Sonnet 4.5",
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    provider: "Anthropic",
  },
  "claude-sonnet-4-5": {
    displayName: "Claude Sonnet 4.5",
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    provider: "Anthropic",
  },
  "claude-sonnet-4-6": {
    displayName: "Claude Sonnet 4.6",
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    provider: "Anthropic",
  },
  "claude-sonnet-5": {
    displayName: "Claude Sonnet 5",
    inputPer1M: 2,
    outputPer1M: 10,
    cacheReadPer1M: 0.2,
    provider: "Anthropic",
  },
  "claude-opus-4": {
    displayName: "Claude Opus 4",
    inputPer1M: 15,
    outputPer1M: 75,
    cacheReadPer1M: 1.5,
    provider: "Anthropic",
  },
  "claude-opus-4.6": {
    displayName: "Claude Opus 4.6",
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    provider: "Anthropic",
  },
  "claude-opus-4-5": {
    displayName: "Claude Opus 4.5",
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    provider: "Anthropic",
  },
  "claude-opus-4-6": {
    displayName: "Claude Opus 4.6",
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    provider: "Anthropic",
  },
  "claude-opus-4-7": {
    displayName: "Claude Opus 4.7",
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    provider: "Anthropic",
  },
  "claude-opus-4-8": {
    displayName: "Claude Opus 4.8",
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    provider: "Anthropic",
  },
  "claude-opus-5": {
    displayName: "Claude Opus 5",
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    provider: "Anthropic",
  },
  "claude-fable-5": {
    displayName: "Claude Fable 5",
    inputPer1M: 10,
    outputPer1M: 50,
    cacheReadPer1M: 1,
    provider: "Anthropic",
  },
  "claude-fable-5-1": {
    displayName: "Claude Fable 5.1",
    inputPer1M: 10,
    outputPer1M: 50,
    cacheReadPer1M: 0.25,
    provider: "Anthropic",
  },

  // ── OpenAI ─────────────────────────────────────────────────
  "gpt-4o": {
    displayName: "GPT-4o",
    inputPer1M: 2.5,
    outputPer1M: 10,
    provider: "OpenAI",
  },
  "gpt-4o-mini": {
    displayName: "GPT-4o Mini",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    provider: "OpenAI",
  },
  // Cached input is 10% of the input rate and is a subset of `prompt_tokens`
  // (see `cacheAccounting`). Neither model has a published long-context tier, so
  // none is modelled here.
  // https://developers.openai.com/api/docs/models/gpt-5
  "gpt-5": {
    displayName: "GPT-5",
    inputPer1M: 1.25,
    outputPer1M: 10,
    cacheReadPer1M: 0.125,
    cacheAccounting: "included",
    provider: "OpenAI",
  },
  // Default snapshot of `gpt-5` (documented alias, same rates).
  "gpt-5-2025-08-07": {
    displayName: "GPT-5",
    inputPer1M: 1.25,
    outputPer1M: 10,
    cacheReadPer1M: 0.125,
    cacheAccounting: "included",
    exactMatchOnly: true,
    provider: "OpenAI",
  },
  // https://developers.openai.com/api/docs/models/gpt-5.2
  "gpt-5.2": {
    displayName: "GPT-5.2",
    inputPer1M: 1.75,
    outputPer1M: 14,
    cacheReadPer1M: 0.175,
    cacheAccounting: "included",
    provider: "OpenAI",
  },
  // Default snapshot of `gpt-5.2` (documented alias, same rates).
  "gpt-5.2-2025-12-11": {
    displayName: "GPT-5.2",
    inputPer1M: 1.75,
    outputPer1M: 14,
    cacheReadPer1M: 0.175,
    cacheAccounting: "included",
    exactMatchOnly: true,
    provider: "OpenAI",
  },
  // GPT-5.6 / GPT-6 tiers. Cached input is 10% of the standard input rate, and
  // `cacheAccounting: "included"` matches CLIProxyAPI's OpenAI-style usage
  // parser (prompt_tokens contains prompt_tokens_details.cached_tokens), so
  // cached tokens are a subset of inputTokens and must not be billed twice.
  // Prompts above 272k input tokens are billed at 2x input/cache and 1.5x
  // output for the whole request.
  // https://developers.openai.com/api/docs/models/gpt-5.6-sol
  "gpt-5.6-sol": {
    displayName: "GPT-5.6 Sol",
    inputPer1M: 4,
    outputPer1M: 20,
    cacheReadPer1M: 0.4,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: OPENAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 8,
      cacheReadPer1M: 0.8,
      outputPer1M: 30,
    },
    provider: "OpenAI",
  },
  // `gpt-5.6` is the documented alias for GPT-5.6 Sol ("The `gpt-5.6` alias
  // routes requests to GPT-5.6 Sol"), so it carries Sol's rates and tier.
  // https://developers.openai.com/api/docs/models/gpt-5.6
  "gpt-5.6": {
    displayName: "GPT-5.6 Sol",
    inputPer1M: 4,
    outputPer1M: 20,
    cacheReadPer1M: 0.4,
    cacheAccounting: "included",
    exactMatchOnly: true,
    longContext: {
      thresholdTokens: OPENAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 8,
      cacheReadPer1M: 0.8,
      outputPer1M: 30,
    },
    provider: "OpenAI",
  },
  "gpt-5.6-terra": {
    displayName: "GPT-5.6 Terra",
    inputPer1M: 2,
    outputPer1M: 12,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: OPENAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 4,
      cacheReadPer1M: 0.4,
      outputPer1M: 18,
    },
    provider: "OpenAI",
  },
  "gpt-5.6-luna": {
    displayName: "GPT-5.6 Luna",
    inputPer1M: 0.2,
    outputPer1M: 1.2,
    cacheReadPer1M: 0.02,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: OPENAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 0.4,
      cacheReadPer1M: 0.04,
      outputPer1M: 1.8,
    },
    provider: "OpenAI",
  },
  "gpt-6-astra": {
    displayName: "GPT-6 Astra",
    inputPer1M: 10,
    outputPer1M: 50,
    cacheReadPer1M: 1,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: OPENAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 20,
      cacheReadPer1M: 2,
      outputPer1M: 75,
    },
    provider: "OpenAI",
  },
  "o3": {
    displayName: "o3",
    inputPer1M: 10,
    outputPer1M: 40,
    provider: "OpenAI",
  },
  "o3-mini": {
    displayName: "o3-mini",
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    provider: "OpenAI",
  },
  "o4-mini": {
    displayName: "o4-mini",
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    provider: "OpenAI",
  },

  // ── Google ─────────────────────────────────────────────────
  "gemini-2.5-pro": {
    displayName: "Gemini 2.5 Pro",
    inputPer1M: 1.25,
    outputPer1M: 10,
    provider: "Google",
  },
  "gemini-2.5-flash": {
    displayName: "Gemini 2.5 Flash",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    provider: "Google",
  },

  // ── Perplexity ─────────────────────────────────────────────
  "sonar": {
    displayName: "Sonar",
    inputPer1M: 1,
    outputPer1M: 1,
    provider: "Perplexity",
  },
  "sonar-pro": {
    displayName: "Sonar Pro",
    inputPer1M: 3,
    outputPer1M: 15,
    provider: "Perplexity",
  },
  "sonar-reasoning": {
    displayName: "Sonar Reasoning",
    inputPer1M: 1,
    outputPer1M: 5,
    provider: "Perplexity",
  },
  "sonar-reasoning-pro": {
    displayName: "Sonar Reasoning Pro",
    inputPer1M: 2,
    outputPer1M: 8,
    provider: "Perplexity",
  },
  "sonar-deep-research": {
    displayName: "Sonar Deep Research",
    inputPer1M: 2,
    outputPer1M: 8,
    provider: "Perplexity",
  },

  // ── xAI (Grok) ─────────────────────────────────────────────
  //
  // Source: https://docs.x.ai/developers/pricing. Only model IDs that appear in
  // that table are listed; retired or unpriced slugs stay unpriced rather than
  // being billed at historical rates.
  //
  // Every model below is billed at double rate for the *whole* request once its
  // prompt reaches 200k tokens, so the long-context tier is selected per request
  // (see `isLongContextPrompt`), never from an aggregated model total.
  //
  // `cacheAccounting: "included"` — CLIProxyAPI's xAI executor publishes usage
  // through `helps.ParseOpenAIUsage` / `helps.ParseCodexUsage`, which normalize
  // with `usage.NewSubsetTokenBreakdown`: `prompt_tokens` already contains
  // `prompt_tokens_details.cached_tokens`, so `inputTokens` includes the cached
  // tokens and the prompt size is exactly `inputTokens`.
  "grok-4.3": {
    displayName: "Grok 4.3",
    inputPer1M: 1.25,
    outputPer1M: 2.5,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2.5,
      cacheReadPer1M: 0.4,
      outputPer1M: 5,
    },
    provider: "xAI",
  },
  "grok-4.5": {
    displayName: "Grok 4.5",
    inputPer1M: 2,
    outputPer1M: 6,
    cacheReadPer1M: 0.3,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 4,
      cacheReadPer1M: 0.6,
      outputPer1M: 12,
    },
    provider: "xAI",
  },
  "grok-4.6": {
    displayName: "Grok 4.6",
    inputPer1M: 2,
    outputPer1M: 6,
    cacheReadPer1M: 0.5,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 4,
      cacheReadPer1M: 1,
      outputPer1M: 12,
    },
    provider: "xAI",
  },
  "grok-4.20-0309-non-reasoning": {
    displayName: "Grok 4.20 (Non-Reasoning)",
    inputPer1M: 1.25,
    outputPer1M: 2.5,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2.5,
      cacheReadPer1M: 0.4,
      outputPer1M: 5,
    },
    provider: "xAI",
  },
  "grok-4.20-0309-reasoning": {
    displayName: "Grok 4.20 (Reasoning)",
    inputPer1M: 1.25,
    outputPer1M: 2.5,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2.5,
      cacheReadPer1M: 0.4,
      outputPer1M: 5,
    },
    provider: "xAI",
  },
  "grok-4.20-multi-agent-0309": {
    displayName: "Grok 4.20 (Multi-Agent)",
    inputPer1M: 1.25,
    outputPer1M: 2.5,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2.5,
      cacheReadPer1M: 0.4,
      outputPer1M: 5,
    },
    provider: "xAI",
  },
  "grok-build-0.1": {
    displayName: "Grok Build 0.1",
    inputPer1M: 1,
    outputPer1M: 2,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2,
      cacheReadPer1M: 0.4,
      outputPer1M: 4,
    },
    provider: "xAI",
  },
  // `grok-code-fast-1` was retired on 2026-05-15 and redirects to
  // `grok-build-0.1`; the three IDs below are its documented aliases and are
  // billed at Grok Build rates, not at their historical prices.
  // https://docs.x.ai/developers/models/grok-build-0.1
  // https://docs.x.ai/developers/migration/may-15-retirement
  "grok-code-fast": {
    displayName: "Grok Build 0.1",
    inputPer1M: 1,
    outputPer1M: 2,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    exactMatchOnly: true,
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2,
      cacheReadPer1M: 0.4,
      outputPer1M: 4,
    },
    provider: "xAI",
  },
  "grok-code-fast-1": {
    displayName: "Grok Build 0.1",
    inputPer1M: 1,
    outputPer1M: 2,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    exactMatchOnly: true,
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2,
      cacheReadPer1M: 0.4,
      outputPer1M: 4,
    },
    provider: "xAI",
  },
  "grok-code-fast-1-0825": {
    displayName: "Grok Build 0.1",
    inputPer1M: 1,
    outputPer1M: 2,
    cacheReadPer1M: 0.2,
    cacheAccounting: "included",
    exactMatchOnly: true,
    longContext: {
      thresholdTokens: XAI_LONG_CONTEXT_MIN_TOKENS,
      inputPer1M: 2,
      cacheReadPer1M: 0.4,
      outputPer1M: 4,
    },
    provider: "xAI",
  },
};

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

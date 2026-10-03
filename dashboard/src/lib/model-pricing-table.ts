/**
 * Built-in model pricing database.
 *
 * Prices are in USD per 1 million tokens, grouped by provider. Users can
 * override individual entries per model; `model-pricing.ts` resolves a model ID
 * against this table and turns token counts into a cost estimate.
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

/**
 * A recurring window, in UTC, during which a model's peak rates apply.
 *
 * Windows are half-open (`startHourUtc` inclusive, `endHourUtc` exclusive) so
 * adjacent windows such as 01:00–04:00 and 06:00–10:00 stay unambiguous.
 */
export interface PeakRateWindow {
  /** Weekdays the window covers, in UTC (0 = Sunday … 6 = Saturday). */
  weekdaysUtc: number[];
  /** Inclusive start hour in UTC (0–23). */
  startHourUtc: number;
  /** Exclusive end hour in UTC (0–23). */
  endHourUtc: number;
}

/**
 * Time-of-day rates that replace the standard rates inside `windows`.
 *
 * `ModelPrice.inputPer1M` / `outputPer1M` / `cacheReadPer1M` hold the off-peak
 * rates, which apply at every time the windows do not cover. DeepSeek bills
 * this way ("Off-peak rates are half of the peak rates",
 * https://api-docs.deepseek.com/quick_start/pricing/); OpenCode Go publishes
 * both rows for `deepseek-v4.1-flash`.
 *
 * Only models without a `longContext` tier may declare peak windows: the usage
 * aggregation keeps one time-of-day bucket per model, and a long-context tier
 * would additionally need its own peak rates. The table invariant is enforced
 * by the pricing tests.
 */
export interface PeakRates {
  /** USD per 1M input tokens during peak hours */
  inputPer1M: number;
  /** USD per 1M output tokens during peak hours */
  outputPer1M: number;
  /** USD per 1M cached (cache read) input tokens during peak hours */
  cacheReadPer1M: number;
  /** UTC windows in which these rates apply */
  windows: PeakRateWindow[];
}

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
  /** Rates that apply inside a model's peak windows; see `PeakRates`. */
  peak?: PeakRates;
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

  // ── OpenCode Go (open models) ──────────────────────────────
  //
  // Source: https://opencode.ai/docs/go/ ("Token prices are per 1M tokens"),
  // retrieved 2026-09-17. The identifiers below are the ones published in the
  // Go endpoints table and returned by `https://opencode.ai/zen/go/v1/models`.
  //
  // `cacheAccounting: "included"` — the endpoints are mixed:
  // `deepseek-v4.1-flash`, `glm-5.3` and `kimi-k3` are served from
  // `https://opencode.ai/zen/go/v1/chat/completions`
  // (`@ai-sdk/openai-compatible`), while `qwen3.8-max` is served from
  // `https://opencode.ai/zen/go/v1/messages` (`@ai-sdk/anthropic`). The endpoint
  // does not decide the accounting shape; CLIProxyAPI's
  // `sdk/cliproxy/usage/accounting.go` (`tokenAccountingSemanticsFor`) does. It
  // maps the `openai-compatibility` provider and the `openaicompatexecutor` to
  // *subset* accounting — checked before its `claude`/`anthropic` rule — and
  // also lists `kimi`, `qwen` and `deepseek` as subset markers in their own
  // right, so `input_tokens` already contains `cached_tokens` for all four.
  // A `qwen3.8-max` registered through an Anthropic-typed provider instead
  // would be classified as independent and need `"separate"`; see
  // docs/PRICING.md.
  //
  // `exactMatchOnly` — sibling IDs in the same catalogue carry very different
  // rates (`glm-5.3-flash` is $0.15/$0.50 against `glm-5.3` at $1.40/$4.40) and
  // CLIProxyAPI's model registry adds context variants (`kimi-k3-256k`).
  // Prefix matching would silently bill those at the wrong rate, so every ID
  // here resolves exactly. OpenCode writes the same IDs prefixed in its own
  // configuration (`opencode-go/<model-id>`); that form still resolves through
  // the provider-prefix fallback in `resolveModelPrice`.

  // https://opencode.ai/docs/go/ — "DeepSeek V4.1 Flash (Off-Peak) $0.15 |
  // $0.60 | $0.003" and "DeepSeek V4.1 Flash (Peak) $0.30 | $1.20 | $0.006",
  // with "Peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday through
  // Friday; all other hours, including weekends, are Off-Peak". Both rate cards
  // are standing prices: the "4x · Ends Sep 20" note on that page marks the
  // monthly usage limit, not the token rates.
  "deepseek-v4.1-flash": {
    displayName: "DeepSeek V4.1 Flash",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    cacheReadPer1M: 0.003,
    cacheAccounting: "included",
    exactMatchOnly: true,
    peak: {
      inputPer1M: 0.3,
      outputPer1M: 1.2,
      cacheReadPer1M: 0.006,
      windows: [
        { weekdaysUtc: [1, 2, 3, 4, 5], startHourUtc: 1, endHourUtc: 4 },
        { weekdaysUtc: [1, 2, 3, 4, 5], startHourUtc: 6, endHourUtc: 10 },
      ],
    },
    provider: "OpenCode Go",
  },
  // https://opencode.ai/docs/go/ — "GLM-5.3 $1.40 | $4.40 | $0.26"; no
  // peak/off-peak rows and no published cache-write rate.
  "glm-5.3": {
    displayName: "GLM-5.3",
    inputPer1M: 1.4,
    outputPer1M: 4.4,
    cacheReadPer1M: 0.26,
    cacheAccounting: "included",
    exactMatchOnly: true,
    provider: "OpenCode Go",
  },
  // https://opencode.ai/docs/go/ — "Kimi K3 $3.00 | $15.00 | $0.30"; no
  // peak/off-peak rows and no published cache-write rate.
  "kimi-k3": {
    displayName: "Kimi K3",
    inputPer1M: 3,
    outputPer1M: 15,
    cacheReadPer1M: 0.3,
    cacheAccounting: "included",
    exactMatchOnly: true,
    provider: "OpenCode Go",
  },
  // https://opencode.ai/docs/go/ — "Qwen3.8 Max $2.00 | $6.00 | $0.25 |
  // $2.50"; no peak/off-peak rows. The published cache-write rate is not
  // modelled: CLIProxyAPI reports cache-write tokens but `UsageRecord` has no
  // column for them (see `app/api/usage/collect/route.ts`).
  "qwen3.8-max": {
    displayName: "Qwen3.8 Max",
    inputPer1M: 2,
    outputPer1M: 6,
    cacheReadPer1M: 0.25,
    cacheAccounting: "included",
    exactMatchOnly: true,
    provider: "OpenCode Go",
  },
};
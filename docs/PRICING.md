# Model Pricing

The dashboard estimates the cost of recorded usage from a built-in price table.
This page documents how that table is maintained, how model IDs are resolved and
which accounting rules each provider follows.

> Cost figures in the Usage view are **estimates**. They compare recorded token
> counts against published list prices; they are not a copy of a provider's
> invoice. Subscription plans, credits and negotiated rates are not modelled.

## Where the table lives

| Concern | Location |
|---------|----------|
| Prices, provider grouping, tiers | `dashboard/src/lib/model-pricing-table.ts` (`DEFAULT_MODEL_PRICING`) |
| Resolution, tiers and cost arithmetic | `dashboard/src/lib/model-pricing.ts` (`resolveModelPrice`, `calculateCost`, `calculateTieredCost`, `calculateAggregatedCost`) |
| Per-request bucket split | `dashboard/src/app/api/usage/history/route.ts` |
| Display | `dashboard/src/components/usage/cost-estimation.tsx` |
| User overrides | browser `localStorage`, key `cliproxy-custom-pricing` |

Overrides in `localStorage` win over the built-in table and are keyed
case-insensitively. `loadCustomPricing` / `saveCustomPricing` read and write that
entry; there is currently no Settings UI for it, so an override is a manual
`localStorage` edit.

## How a model ID is resolved

`resolveModelPrice(model)` tries, in order:

1. **Exact match** against the (lower-cased) model ID, user overrides first.
2. **Longest-prefix match** against the table, so a dated snapshot such as
   `claude-opus-4-5-20251101` resolves to `claude-opus-4-5`. A prefix only
   matches at a version boundary: `gpt-5` does **not** absorb `gpt-5.6-sol`, and
   a short trailing number (`grok-code-fast-2`) is treated as a new model, not a
   snapshot.
3. **Provider-prefix fallback**: if the ID contains `/`, the last segment is
   retried, so `opencode-go/kimi-k3` and `cliproxyapi/sonar-pro` resolve.
4. Otherwise the model is reported as **unpriced** and contributes nothing to
   the estimate. Unpriced models stay visible in their own table section rather
   than being folded into a similarly named model.

Entries marked `exactMatchOnly` are skipped in step 2. That is used for IDs
whose siblings are sold at different rates — `glm-5.3-flash` ($0.15/$0.50) must
not be billed at `glm-5.3` ($1.40/$4.40) — and for documented aliases such as
`gpt-5.6` or `grok-code-fast-1`.

## Cache accounting

Providers report cached prompt tokens in one of two shapes, expressed by
`ModelPrice.cacheAccounting`:

| Value | Meaning | Example |
|-------|---------|---------|
| `"separate"` (default) | `inputTokens` **excludes** cache reads, so input and cache reads are billed independently | Anthropic Messages API |
| `"included"` | `inputTokens` **already contains** the cached tokens, so only the uncached remainder is billed at the input rate | OpenAI-compatible usage |

With `"included"`, cached tokens are clamped to `inputTokens` and never billed
twice. The flag is not derived from the request endpoint; it follows how
CLIProxyAPI classifies the provider, which is what the dashboard's
`usage_records` are populated from. CLIProxyAPI resolves this in
`sdk/cliproxy/usage/accounting.go` (`tokenAccountingSemanticsFor`, verified on
`v7.3.3` and `main` as of 2026-09-17):

- provider `openai-compatibility` or executor `openaicompatexecutor` → *subset*
  (= `"included"`)
- a provider/executor containing `claude` or `anthropic` → *independent*
  (= `"separate"`)
- `kimi`, `qwen` and `deepseek` are listed as subset markers in their own right

The provider/executor checks happen in that order, so a model served from an
upstream Anthropic-style endpoint is still billed with subset accounting when
CLIProxyAPI reaches it through an `openai-compatibility` provider. This matters
for `qwen3.8-max` (see below): its upstream endpoint is Anthropic-style, so the
`"included"` entry assumes the OpenAI-compatible provider path. Registering it
through an Anthropic-typed provider instead makes CLIProxyAPI report
`input_tokens` *excluding* cache reads, and the entry would then need
`cacheAccounting: "separate"` (by editing the `cliproxy-custom-pricing`
localStorage entry; see "Where the table lives").

## Prices added for OpenCode Go models

All rates are USD per 1M tokens and were read verbatim from
[opencode.ai/docs/go](https://opencode.ai/docs/go/) ("Token prices are per 1M
tokens") on **2026-09-17**. The model IDs are the ones in that page's endpoints
table and in `https://opencode.ai/zen/go/v1/models`. The catalogue is a
subscription plan with per-model monthly dollar limits; the token rates below
are the rates used to measure consumption against those limits, and they are
standing rates (the "4x · Ends Sep 20" note on that page concerns the monthly
limit, not the token rates).

The endpoints are mixed: `deepseek-v4.1-flash`, `glm-5.3` and `kimi-k3` are
served from `https://opencode.ai/zen/go/v1/chat/completions`
(`@ai-sdk/openai-compatible`), `qwen3.8-max` from
`https://opencode.ai/zen/go/v1/messages` (`@ai-sdk/anthropic`). As described
above, that does not on its own decide the cache accounting shape.

| Model ID | Input | Output | Cache read | Cache write | Cache accounting |
|----------|-------|--------|-----------|-------------|------------------|
| `deepseek-v4.1-flash` (off-peak) | $0.15 | $0.60 | $0.003 | not published | `included` |
| `deepseek-v4.1-flash` (peak) | $0.30 | $1.20 | $0.006 | not published | `included` |
| `glm-5.3` | $1.40 | $4.40 | $0.26 | not published | `included` |
| `kimi-k3` | $3.00 | $15.00 | $0.30 | not published | `included` |
| `qwen3.8-max` | $2.00 | $6.00 | $0.25 | $2.50 | `included` |

Each entry is `exactMatchOnly`, because the same catalogue lists siblings with
materially different rates (`glm-5.3-flash`, `qwen3.8-flash`,
`kimi-k2.7-code`, …) and CLIProxyAPI's registry
(`internal/registry/models/models.json`) adds context variants such as
`kimi-k3-256k`. Prefix matching would bill those at the wrong rate, so an
unlisted sibling stays unpriced instead.

### Peak and off-peak pricing

`deepseek-v4.1-flash` is the only model in the table with time-of-day rates.
Peak hours are **01:00–04:00 and 06:00–10:00 UTC, Monday through Friday**; all
other hours, including weekends, are off-peak (verbatim from the Go page,
corroborated by
[api-docs.deepseek.com](https://api-docs.deepseek.com/quick_start/pricing/)).
The table stores the off-peak card as the standard rate and the peak card in
`ModelPrice.peak`, together with the UTC windows.

The split is decided **per request** from `usage_records.timestamp` (the request
time reported by CLIProxyAPI, not the collection time) and the tokens are
bucketed accordingly, mirroring the long-context buckets. A model with peak
windows has no long-context tier: one time-of-day bucket per model cannot carry
a second, context-dependent rate card. A test asserts this invariant, so adding
both to one entry fails CI instead of silently mispricing.

## Long-context tiers

xAI bills a request at the higher rate once its prompt reaches 200k tokens,
OpenAI once it is above 272k. Both thresholds are stored per model in
`ModelPrice.longContext` and selected per request; the whole request moves to
the higher tier, so this cannot be derived from a summed model total.

## Models that stay unpriced

- **Retired models** are not re-priced at historical rates (for example
  `claude-3-5-haiku-20241022`, `grok-3-mini`).
- **Free / credit-funded models** have no entry. OpenCode Zen
  ([opencode.ai/docs/zen](https://opencode.ai/docs/zen/), retrieved 2026-09-17)
  lists `big-pickle`, `muse-spark-1.3-contributor-free` and
  `nemotron-3-ultra-free` as `Free` but documents each as free "for a limited
  time". `gemini-3.8-flash-high` is a real CLIProxyAPI/Antigravity model ID
  (`internal/registry/models/models.json`) but is served through Antigravity
  credits rather than a published $0 rate. Modelling those as permanently free
  would silently report real future traffic as costing nothing. They stay
  visible as unpriced.
- **Unlisted siblings and future generations** stay unpriced rather than
  inheriting a family rate.

## Known gap: cache-write tokens

CLIProxyAPI also reports cache *write* tokens (`cache_creation_tokens`), but
`UsageRecord` has no column for them, so the collector drops them
(see `dashboard/src/app/api/usage/collect/route.ts`). `qwen3.8-max` publishes a
$2.50 cache-write rate that therefore cannot be estimated yet. Closing this
needs a schema migration plus a collector change and is tracked separately.

## Updating the table

1. Re-read the provider's official pricing page; do not reuse a value from an
   issue or a secondary source.
2. Update the entry and its comment to name the source URL and the retrieval
   date.
3. Keep entries within one provider group and mark IDs `exactMatchOnly` when a
   sibling exists at a different rate.
4. Run `npm test` in `dashboard/` — the pricing tests cover the rate values,
   cache accounting, prefix resolution, sibling non-collisions and the peak
   window boundaries.

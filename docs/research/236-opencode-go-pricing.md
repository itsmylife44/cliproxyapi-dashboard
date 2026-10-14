# Issue #236: OpenCode Go model pricing (research)

Status: research only, no code changed. Pages fetched 2026-10-14. CLIProxyAPI source
checked at tag **v7.3.3** (commit `7bbfeaf8a7acf2cd5a834dcb0842539fe6aabc2b`, the version
the reporter runs). Dashboard paths are relative to the repo root at `main` (`0952116`).

Abbreviations used for sources:

- **OCG**: https://opencode.ai/docs/go/ (sections "Usage limits" and "Endpoints")
- **DS**: https://api-docs.deepseek.com/quick_start/pricing/
- **ZAI**: https://docs.z.ai/guides/overview/pricing (`.md` variant used for the raw table)
- **MS**: https://platform.moonshot.ai/docs/pricing/chat (`.md` variant used for the raw table)
- **ALI**: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- **ALI-CC**: https://www.alibabacloud.com/help/en/model-studio/context-cache
- **CPA**: `router-for-me/CLIProxyAPI@v7.3.3`

## 1. Rates (USD per 1M tokens)

| OpenCode Go model ID | Input | Output | Cache read | Cache write | Source |
| --- | --- | --- | --- | --- | --- |
| `glm-5.3` | 1.40 | 4.40 | 0.26 | none listed | OCG "Usage limits" table |
| `kimi-k3` | 3.00 | 15.00 | 0.30 | none listed | OCG "Usage limits" table |
| `qwen3.8-max` | 2.00 | 6.00 | 0.25 | 2.50 | OCG "Usage limits" table |
| `deepseek-v4.1-flash` off-peak | 0.15 | 0.60 | 0.003 | none listed | OCG "Usage limits" table |
| `deepseek-v4.1-flash` peak | 0.30 | 1.20 | 0.006 | none listed | OCG "Usage limits" table |

OCG says token prices are the same for Go and Go Plus. The two plan tables differ only in
the monthly limit column (OCG "Usage limits": "Token pricing is the same for Go and Go Plus").

Endpoints (OCG "Endpoints" table):

- `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `deepseek-v4-pro` use
  `https://opencode.ai/inference/go/v1/chat/completions` (`@ai-sdk/openai-compatible`)
- `qwen3.8-max` and `qwen3.8-flash` use `https://opencode.ai/inference/go/v1/messages` (`@ai-sdk/anthropic`)
- the docs show the client-side ID as `opencode-go/kimi-k3` (OCG "Endpoints" config example)

### Cross-check against vendor pages

| Model | Vendor page | Vendor rates | Agrees with OCG? |
| --- | --- | --- | --- |
| GLM-5.3 | ZAI "Latest Models" | input 1.4, cached input 0.26, output 4.4, cached storage "Limited-time Free" | Yes |
| Kimi K3 | MS "K3 Series Models" (`kimi-k3`) | input 3.00, cached input 0.30, output 15.00, cache write 3.00 (5 min TTL) / 6.00 (1 h TTL) | Read/input/output yes. MS also bills cache writes, OCG lists "-" |
| Qwen3.8 Max | ALI "Qwen-Max", International (`qwen3.8-max`) | input $2, output $6 (0 < tokens <= 1M, one tier) | Input/output yes. ALI-CC: cache creation is 125% of input (= $2.50, matches OCG). The cache-hit rate for `qwen3.8-max` is "not 10%/20%... see the Model Studio console", so the $0.25 can't be checked against a public page |
| DeepSeek V4.1 Flash | DS (`deepseek-flash`, version "DeepSeek-V4.1-Flash") | off-peak 0.15 / 0.60 / 0.003; peak 0.3 / 1.2 / 0.006 | Yes |

Differences to note:

- **Model IDs differ.** DeepSeek's own API ID is `deepseek-flash`. Its legacy
  `deepseek-v4-flash` is still accepted and billed as V4.1 Flash (DS footnote 1). Only OCG
  uses `deepseek-v4.1-flash`. The Z.ai, Moonshot and Alibaba IDs match OCG's
  (`glm-5.3` on ZAI by display name, `kimi-k3` on MS, `qwen3.8-max` on ALI).
- **Peak definition differs by one clause.** DS says peak is "01:00 - 04:00 and 06:00 - 10:00
  UTC, Monday through Friday, **excluding Chinese public holidays**". OCG says "Peak hours
  are 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday; all other hours, including
  weekends, are Off-Peak" and does not mention holidays (OCG note under the table).
- **Siblings with different prices exist next to every one of these IDs.** OCG has
  `glm-5.3-flash` at 0.15/0.50/0.03, `qwen3.8-flash` at 0.15/0.47/0.016/0.20, and
  `deepseek-v4-pro` at 0.66/1.98/0.022 off-peak. ZAI has `GLM-5.3-FlashX` at 0.37/1.25/0.075.
  ALI has `qwen3.8-max-prime` at $3.301/$9.902 (China (Beijing)). MS has `kimi-k2.7-code`
  next to `kimi-k2.7-code-highspeed`, the second at twice the price. Section 4 uses these.

## 2. How CLIProxyAPI records cached tokens

### What the dashboard stores

The collector copies `tokens.input_tokens` and `tokens.cached_tokens` from
`/v0/management/usage-queue` into `UsageRecord.inputTokens` / `cachedTokens`
(`dashboard/src/app/api/usage/collect/route.ts:419-422`). Cache-write tokens are dropped on
purpose (`collect/route.ts:51-58`). In CPA those fields are
`usageDetail.InputTokens` / `usageDetail.CachedTokens` (`internal/redisqueue/plugin.go:83-93`,
struct `tokenStats` at `plugin.go:185-194`). So the question is how each parser fills
`usage.Detail.InputTokens` and `CachedTokens` (`sdk/cliproxy/usage/manager.go:71-81`).

### (a) OpenAI-compatible `chat/completions`: cached is a subset (`"included"`)

- The `openai-compatibility` executor always calls `{base-url}/chat/completions`
  (`internal/runtime/executor/openai_compat_executor.go:108,147,360`). The only other
  endpoint is `/responses/compact` for compaction (`:110-111`). The provider config
  (`internal/config/config_types.go:766-805`) has no setting for a Messages-format upstream.
- Usage is parsed by `helps.ParseOpenAIUsage` (`openai_compat_executor.go:206,302`) and, for
  streams, by `StreamUsageBuffer.ObserveOpenAIStream` (`:506`, `helps/usage_helpers.go:676`).
- `parseOpenAIStyleUsageNode` (`helps/usage_helpers.go:803-879`) sets
  `InputTokens = prompt_tokens` (`:813`) and `CachedTokens = prompt_tokens_details.cached_tokens`
  (`:822`). It then calls `usage.NewSubsetTokenBreakdown` (`:844`), whose doc comment says it
  "normalizes protocols where cache tokens are included in input totals". It also rejects
  `cacheTotal > inputTotal` (`sdk/cliproxy/usage/accounting.go:90-97`).
- **Result:** `inputTokens` already contains the cached tokens. Price with `cacheAccounting: "included"`.

### (b) Claude/Anthropic `/v1/messages`: cached is separate (`"separate"`)

- The `claude-api-key` executor calls `{base_url}/v1/messages?beta=true`
  (`internal/runtime/executor/claude_executor_execute.go:32`, `claude_executor_stream.go:34`).
  It parses usage with `helps.ParseClaudeUsage` (`claude_executor_execute.go:410`), or for
  streams with `ParseClaudeStreamUsage` (`helps/usage_helpers.go:717,907`).
- `parseClaudeUsageNode` (`helps/usage_helpers.go:922-970`) sets
  `InputTokens = usage.input_tokens` (`:948`) and `CachedTokens = cache_read_input_tokens`.
  It adds the cache fields separately to the total (`:960`, comment: "cache fields are
  independent from input_tokens in the Messages API") and calls `usage.NewIndependentTokenBreakdown`
  (`accounting.go:161-163`).
- Quirk: if `cache_read_input_tokens` is 0, `CachedTokens` falls back to
  `cache_creation_input_tokens` (`usage_helpers.go:955-957`). Because the dashboard has no
  cache-write column, a cache-*write*-only request reaches the dashboard as "cached" tokens.
  The dashboard then bills them at the cache-*read* rate. For `qwen3.8-max` that is $0.25
  instead of $2.50, so cache-write cost is understated. This is the existing known gap at
  `collect/route.ts:54-57`, not something #236 adds.

### What the dashboard sees for `qwen3.8-max`

| CPA provider type | Upstream URL CPA calls | Parser | `inputTokens` semantics |
| --- | --- | --- | --- |
| `claude-api-key`, `base-url: https://opencode.ai/inference/go` | `.../inference/go/v1/messages?beta=true`, the endpoint OCG documents for Qwen | `ParseClaudeUsage` | **separate**: `input_tokens` excludes cache reads |
| `openai-compatibility`, `base-url: https://opencode.ai/inference/go/v1` | `.../inference/go/v1/chat/completions`, **not** the endpoint OCG lists for `qwen3.8-max` | `ParseOpenAIUsage` | **included**, if the call succeeds at all |

The documented route is `/v1/messages`, and only the `claude-api-key` provider can reach it.
So `qwen3.8-max` should keep the default `"separate"` accounting. `cacheAccounting` is
per model ID, not per route. A user who forces Qwen through `openai-compatibility` (if OCG
accepts it there, which OCG doesn't document) would be billed wrongly.

Two things the sources don't settle:

- CPA's parser assumes Anthropic semantics, but no page states whether OCG's
  `/v1/messages` gateway returns them for Qwen.
- ALI-CC shows Alibaba's own Anthropic-compatible endpoint returning `cache_read_input_tokens`
  for `qwen3.8-max` (the "Anthropic" example). Its FAQ ("Why doesn't the `input_tokens`...")
  is about the OpenAI shape.

A quick empirical check: any `qwen3.8-max` record with `cachedTokens > inputTokens` confirms
"separate".

### Check against the reporter's numbers

| Model | Input | Cached | Cached / input |
| --- | --- | --- | --- |
| `deepseek-v4.1-flash` | 32,109,020 | 31,496,320 | 98.09% |
| `glm-5.3` | 262,701 | 261,952 | 99.71% |

Cached is at most input in both cases. That fits the subset shape, since `NewSubsetTokenBreakdown`
would reject a record where cached > input. It also fits the OCG estimate of mostly cached
traffic, e.g. DeepSeek V4.1 Flash "410 input, 71,300 cached, 310 output tokens per request".
The reporter's per-request uncached input is 2,687 and output 756. Both models go through
`chat/completions`, so they need `cacheAccounting: "included"`.

Cost with the reporter's totals (formula in `dashboard/src/lib/model-pricing.ts:681-705`):

| Model | `"included"` (correct) | `"separate"` (wrong) |
| --- | --- | --- |
| `deepseek-v4.1-flash` all off-peak | **$0.2898** | $5.0142 |
| `deepseek-v4.1-flash` all peak | **$0.5795** | $10.0284 |
| `glm-5.3` | **$0.0733** | $0.4400 |
| `kimi-k3` (0 cached) | $0.000516 | $0.000516 |

Getting `cacheAccounting` wrong is a 6x-17x error on this traffic. That is much bigger
than the peak/off-peak question (2x at most).

## 3. DeepSeek V4.1 Flash peak/off-peak

### Facts that apply to every option

- **Peak window:** 01:00-04:00 and 06:00-10:00 UTC, Mon-Fri (OCG, DS). That is 35 of 168
  weekly hours (20.8%). Peak rates are exactly 2x off-peak on all three components
  (DS footnote 2: "Off-peak rates are half of the peak rates").
- **Timestamp CPA records:** `RequestedAt`, taken when the executor creates its usage reporter
  before the upstream call: `requestedAt: time.Now()` in `NewExecutorUsageReporter`
  (`internal/runtime/executor/helps/usage_helpers.go:101`). It is copied to the queue
  `timestamp` (`internal/redisqueue/plugin.go:29-32,107`). So it is **request start**, not
  completion. Go serializes `time.Time` with an offset, and `new Date(entry.timestamp)`
  (`collect/route.ts:408`) keeps the absolute instant, so `UsageRecord.timestamp`
  (`dashboard/prisma/schema.prisma:264`) is an exact instant.
- **OCG's billing clock** (start, end, or first token) is not documented. A request that
  straddles 04:00 or 10:00 UTC can be classified differently from OCG. With this traffic
  (about 2.7k uncached tokens per request) that is negligible.
- **Timezone trap:** the history route groups days with **local-time** methods
  (`getFullYear/getMonth/getDate`, `dashboard/src/app/api/usage/history/route.ts:310-313`,
  comment "use server local timezone"). `TZ: ${TZ}` is passed to `cliproxyapi`,
  `usage-collector`, `backup-scheduler`, etc. (`infrastructure/docker-compose.yml:24,51,140,207,240`),
  and local `npm run dev` uses the host TZ. A peak check must use
  `getUTCDay()` / `getUTCHours()`, never the local-time methods next to it.
- **Holidays:** DS treats Chinese public holidays as off-peak. OCG doesn't mention them.
  A static check can't reproduce DS's rule without a holiday calendar, and OCG's text
  suggests OCG doesn't apply it anyway. Follow OCG's text, since OCG is the biller here.
- **Who else uses this structure:** in the OCG table only DeepSeek V4.1 Flash and
  DeepSeek V4 Pro have Peak/Off-Peak rows. V4 Pro: 0.66/1.98/0.022 off-peak,
  1.32/3.96/0.044 peak, same window. Every other OCG model has a flat rate or a
  prompt-size tier (Qwen3.7 Plus <= / > 256K, Grok 4.7 <= / > 200K). A generic mechanism
  would serve exactly two models, both from DeepSeek.

### Options

**A. Single off-peak rate** (`inputPer1M: 0.15, outputPer1M: 0.60, cacheReadPer1M: 0.003`)

- Reporter totals: $0.2898. Worst case (all traffic at peak): true $0.5795, so **50% under**.
  With traffic spread evenly over the week: 17.2% under. For a CEST user working 08-18
  weekdays (40% of hours in peak): 28.6% under.
- Files: `dashboard/src/lib/model-pricing.ts` (one entry). Tests: one resolution/rate case in
  `dashboard/src/lib/__tests__/model-pricing.test.ts`.
- Edge cases: none. It is a lower bound, matching the "From $X" figure a user sees first.

**B. Single peak rate** (`0.30 / 1.20 / 0.006`)

- Reporter totals: $0.5795. Worst case (all off-peak, e.g. weekend or US-evening use):
  true $0.2898, so **100% over**. Even spread: 65.5% over. CEST workday: 42.9% over.
- Files and tests: same as A.
- Edge cases: none, but it overstates by default, because 79% of the week is off-peak.

**C. Per-request time-of-day bucketing** (same pattern as long-context)

- Correctness: exact against OCG's published rule, up to the start-vs-billing-clock
  ambiguity above.
- Files touched:
  1. `dashboard/src/lib/model-pricing.ts`: new optional field on `ModelPrice`, e.g.
     `offPeak?: { inputPer1M; outputPer1M; cacheReadPer1M }` or a `peak` block with a UTC
     schedule, plus an `isPeakRequest(timestamp, price)` helper next to
     `isLongContextPrompt` (`:661-667`). It also needs a cost function that combines the
     buckets, or a generalization of `calculateTieredCost` (`:721-759`).
  2. `dashboard/src/app/api/usage/history/route.ts`: three more per-model accumulators
     next to `longContext*` (`:39-41, :290-292, :304-308`).
  3. `dashboard/src/app/dashboard/usage/page.tsx:39-41`: response type.
  4. `dashboard/src/components/usage/cost-estimation.tsx:29-31, 68-70, 82-94, 106-110`:
     type, aggregation and cost call.
  5. Tests: a new `dashboard/src/app/api/usage/history/__tests__/peak-buckets.test.ts`
     modelled on `long-context-buckets.test.ts` (10 cases there). Cover the 00:59/01:00/
     03:59/04:00/05:59/06:00/09:59/10:00 UTC boundaries, Friday 09:59 vs Saturday 09:59,
     and a server TZ that isn't UTC (`process.env.TZ`). Also add unit cases in
     `model-pricing.test.ts`.
- Edge cases: tiers multiply. Long-context times peak gives four buckets per model in
  general. No current OCG model has both (DeepSeek rows have no prompt-size tier), but the
  types would have to allow it or explicitly forbid it. User custom pricing
  (localStorage, `model-pricing.ts:5`) would also need the new field in the settings UI to
  stay overridable.

### Assessment

For the reporter, the most either A or B can be off is $0.29 over 228 requests
(A if every request was peak, B if none was). Option C touches four production files plus a new test file for two models
from one vendor. Getting `cacheAccounting` right (section 2) matters 17x more.

## 4. Model-ID resolution (`resolveModelPrice`, `model-pricing.ts:608-648`)

Order: exact key, then longest-prefix match via `isVersionBoundaryMatch`. Keys flagged
`exactMatchOnly` are skipped in the prefix pass (`:629`). After that it strips the text up
to the last `/` and tries exact (`:643`) and prefix (`:644`) again.

- `deepseek-v4.1-flash`, `glm-5.3`, `kimi-k3`, `qwen3.8-max`: exact hit at `:619`. No
  current key is a prefix of them (the table has no `deepseek`, `glm`, `kimi` or `qwen`
  keys today; key list `model-pricing.ts:89-543`).
- `opencode-go/<id>`: no key starts with `opencode-go`, so the prefix pass on the full
  string finds nothing. The strip gives `<id>`, then an exact hit at `:643`. This works
  even with `exactMatchOnly: true`, because `:643` is an exact lookup. Also, the queue
  `model` field is `record.Model` (`plugin.go:130-131`), the executor's `baseModel`
  (`openai_compat_executor.go:96`), and the client alias goes in a separate `alias` field.
  So stored models are usually already bare.

Sibling behaviour of `isVersionBoundaryMatch` (`:571-599`), which rejects a remainder when:
(1) it starts with a digit, (2) it starts with `.` and a digit, (3) the key does **not** end
in a digit and the remainder is `-` plus 1-3 digits, or (4) it starts with `-YYYY-MM-DD`.

| Candidate | Key | Remainder | Result | Correct? |
| --- | --- | --- | --- | --- |
| `glm-5.3-flash` | `glm-5.3` | `-flash` | **match** | No: OCG 0.15/0.50 vs 1.40/4.40 (9x over) |
| `glm-5.3-flashx` | `glm-5.3` | `-flashx` | **match** | No: ZAI 0.37/1.25 |
| `glm-5.3.1` / `glm-5.31` | `glm-5.3` | `.1` / `1` | rejected | Yes |
| `kimi-k3-thinking`, `kimi-k3-highspeed` | `kimi-k3` | `-thinking` ... | **match** | Not safe: MS prices `-highspeed` siblings at 2x (`kimi-k2.7-code-highspeed`) |
| `kimi-k3-1` | `kimi-k3` | `-1` | **match**: rule (3) is off because the key ends in `3` | Not safe |
| `qwen3.8-max-prime` | `qwen3.8-max` | `-prime` | **match** | No: ALI $3.301/$9.902 |
| `qwen3.8-max-0902` | `qwen3.8-max` | `-0902` (4 digits) | **match** | Happens to be right (ALI: same $2/$6) |
| `deepseek-v4.1-flash-<x>` | `deepseek-v4.1-flash` | `-<x>` | **match** | No known sibling today |
| `deepseek-v4-flash` | (none) | n/a | unpriced | `deepseek-v4.1-flash` isn't a prefix of it, which is correct |

Conclusion: `exactMatchOnly: true` is **needed** on `glm-5.3`, `kimi-k3` and `qwen3.8-max`,
because each has a documented differently-priced sibling that would otherwise inherit its
rate. For `deepseek-v4.1-flash` it costs nothing and is consistent: OCG IDs are exact
strings, so an unknown `-suffix` should stay "unpriced" rather than borrow a rate.

## Recommendation

**Peak: Option A (single off-peak rate)**, with a comment pointing to OCG's peak window
and the 2x factor. Why:

- It is a one-entry change.
- It understates by 17% for evenly spread traffic and never by more than 50%. B overstates
  by 66% on even traffic and up to 100%.
- Option C's four-file, four-bucket change pays off for only two DeepSeek models.
- Revisit C if a non-DeepSeek model adopts time-of-day pricing, or if users report the
  DeepSeek figure as material.

Exact entries for `DEFAULT_MODEL_PRICING` in `dashboard/src/lib/model-pricing.ts`. `provider`
is the existing free-text field; check the value against how other entries label providers
before merging.

```ts
// OpenCode Go, https://opencode.ai/docs/go/ ("Usage limits", "Endpoints")
// chat/completions → CLIProxyAPI ParseOpenAIUsage/NewSubsetTokenBreakdown → "included"
"deepseek-v4.1-flash": {
  // Off-peak rates. Peak (01:00-04:00, 06:00-10:00 UTC Mon-Fri) is exactly 2x:
  // 0.30 / 1.20 / 0.006. Per-request peak tiering is not modelled.
  displayName: "DeepSeek V4.1 Flash",
  inputPer1M: 0.15,
  outputPer1M: 0.6,
  cacheReadPer1M: 0.003,
  cacheAccounting: "included",
  exactMatchOnly: true,
  provider: "OpenCode Go",
},
"glm-5.3": {
  displayName: "GLM-5.3",
  inputPer1M: 1.4,
  outputPer1M: 4.4,
  cacheReadPer1M: 0.26,
  cacheAccounting: "included",
  exactMatchOnly: true, // glm-5.3-flash (0.15/0.50) must not inherit this rate
  provider: "OpenCode Go",
},
"kimi-k3": {
  displayName: "Kimi K3",
  inputPer1M: 3,
  outputPer1M: 15,
  cacheReadPer1M: 0.3,
  cacheAccounting: "included",
  exactMatchOnly: true,
  provider: "OpenCode Go",
},
// /v1/messages → CLIProxyAPI claude-api-key executor, ParseClaudeUsage → "separate"
// (default). Cache write $2.50 is not billable: UsageRecord has no cache-write column.
"qwen3.8-max": {
  displayName: "Qwen3.8 Max",
  inputPer1M: 2,
  outputPer1M: 6,
  cacheReadPer1M: 0.25,
  cacheAccounting: "separate",
  exactMatchOnly: true, // qwen3.8-max-prime is priced higher upstream
  provider: "OpenCode Go",
},
```

Tests to add in `dashboard/src/lib/__tests__/model-pricing.test.ts`:

- each ID and `opencode-go/<id>` resolves to the entry above
- `glm-5.3-flash`, `kimi-k3-1` and `qwen3.8-max-prime` resolve to `null`
- `calculateCost(32_109_020, 172_274, deepseekPrice, 31_496_320)` is about `0.2898`
- `calculateCost(262_701, 940, glmPrice, 261_952)` is about `0.0733`

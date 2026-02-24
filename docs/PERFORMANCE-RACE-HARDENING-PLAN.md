# Performance & Race Hardening Plan (7 Days)

This checklist turns the deep investigation findings into a practical implementation plan.

## Scope

- Reduce race-condition risk in collector/provider dual-write flows
- Reduce proxy and usage-route performance bottlenecks
- Cut avoidable polling load
- Add observability to verify improvements

## Baseline (before Day 1)

- [ ] Capture current p95/p99 latency for:
  - [ ] `GET /api/usage/history`
  - [ ] `POST /api/usage/collect`
  - [ ] `ANY /api/management/[...path]`
- [ ] Capture current request volume (req/min) for monitoring/polling pages
- [ ] Capture dashboard/container memory usage under normal load
- [ ] Save a 24h baseline snapshot in issue/PR description

---

## Day 1 — Collector Single-Flight Lock

**Goal:** prevent overlapping collector runs.

### Files

- `dashboard/src/app/api/usage/collect/route.ts`
- `dashboard/prisma/schema.prisma` (if lease fields are added)
- `dashboard/prisma/migrations/*` (if schema changes)

### Tasks

- [ ] Add DB-backed lease logic (single active run)
- [ ] Reject/short-circuit concurrent collector invocation with `202` or `409`
- [ ] Ensure lease cleanup on success/failure (finally path)
- [ ] Include run metadata (`runId`, start/end, duration) in logs

### Acceptance

- [ ] 2 parallel `POST /api/usage/collect` calls -> only 1 executes processing
- [ ] No dead lease blocking future runs (TTL or cleanup works)

---

## Day 2 — Usage History Scalability

**Goal:** stop heavy in-memory aggregation over large result sets.

### Files

- `dashboard/src/app/api/usage/history/route.ts`

### Tasks

- [ ] Replace 50k in-memory aggregation path with DB-side aggregation where possible
- [ ] Add pagination and/or stricter bounded time windows
- [ ] Keep response contract stable for UI
- [ ] Add short-lived cache for identical queries (optional but recommended)

### Acceptance

- [ ] p95 latency materially lower than baseline for common filters (`7d`, `30d`)
- [ ] Reduced process memory growth during repeated history calls

---

## Day 3 — Management Proxy Hardening

**Goal:** reduce memory and retry amplification in proxy route.

### Files

- `dashboard/src/app/api/management/[...path]/route.ts`
- `dashboard/src/lib/fetch-utils.ts`

### Tasks

- [ ] Enforce endpoint-specific request size budgets
- [ ] Revisit retry policy for high-volume/non-idempotent paths
- [ ] Keep timeout+abort behavior strict and observable
- [ ] Avoid unnecessary full-body buffering when not needed

### Acceptance

- [ ] Under synthetic load, fewer timeout/502 spikes than baseline
- [ ] No regression in successful management operations

---

## Day 4 — Polling Load Reduction

**Goal:** reduce self-inflicted load from frequent polling loops.

### Files

- `dashboard/src/app/dashboard/monitoring/page.tsx`
- `dashboard/src/app/dashboard/usage/page.tsx`
- `dashboard/src/components/providers/oauth-section.tsx`
- `dashboard/src/hooks/use-proxy-update-check.ts` (if touched)

### Tasks

- [ ] Poll only when tab/page is visible
- [ ] Add backoff after consecutive failures
- [ ] Dedupe overlapping fetches where possible
- [ ] Prevent repeated collector-trigger calls from normal UI refresh flow

### Acceptance

- [ ] Lower req/min from dashboard UI while preserving UX freshness
- [ ] No user-visible regressions in status updates

---

## Day 5 — Dual-Write Concurrency Safety (Future-Proof)

**Goal:** remove single-process-only lock assumption as scaling risk.

### Files

- `dashboard/src/lib/providers/dual-write.ts`
- Optional: new shared lock helper module under `dashboard/src/lib/*`

### Tasks

- [ ] Introduce cross-instance lock strategy (e.g., DB advisory lock)
- [ ] Keep current in-process mutex as local guard
- [ ] Protect critical GET-modify-PUT sections from lost updates
- [ ] Document lock behavior and limitations

### Acceptance

- [ ] Concurrent provider key operations stay consistent in stress tests
- [ ] Clear migration path for multi-instance deployment documented

---

## Day 6 — Observability & Failure Classification

**Goal:** make root causes and hot paths obvious in logs/metrics.

### Files

- `dashboard/src/app/api/usage/collect/route.ts`
- `dashboard/src/lib/logger.ts` (or related logging wrappers)
- Optional: status/monitoring API routes

### Tasks

- [ ] Log structured collector fields: `runId`, `processed`, `stored`, `skipped`, `durationMs`, `lockWaitMs`
- [ ] Classify failure categories separately (e.g., cooldown 429 vs unsupported 400)
- [ ] Add route-level timing logs for `usage/history` and management proxy

### Acceptance

- [ ] A single query/dashboard can answer "where are failures and latency coming from?"
- [ ] Alerting thresholds can be configured from emitted metrics/logs

---

## Day 7 — Load Validation & Rollout Gate

**Goal:** verify outcomes and gate production rollout.

### Scenarios

- [ ] Parallel collector trigger test
- [ ] Concurrent usage-history requests (realistic date ranges)
- [ ] Monitoring + OAuth polling active simultaneously

### Rollout checks

- [ ] No collector overlap under parallel trigger
- [ ] p95 latency improvements versus baseline
- [ ] Stable memory/CPU during sustained polling
- [ ] No new error-class regressions

---

## PR Breakdown (recommended)

- [ ] PR-1: Collector lock + tests
- [ ] PR-2: Usage history aggregation/pagination
- [ ] PR-3: Management proxy hardening
- [ ] PR-4: Polling optimization
- [ ] PR-5: Dual-write distributed lock readiness
- [ ] PR-6: Observability additions
- [ ] PR-7: Validation results + docs update

## Verification Commands (each PR)

Run in `dashboard/`:

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Relevant tests for touched modules/routes

## Notes from current prod analysis

- Recent failed usage records are mostly `totalTokens=0` and map to upstream conditions (`429 model_cooldown`, `400 unsupported model`) rather than clear DB corruption.
- This plan therefore prioritizes lock correctness + load reduction + observability.

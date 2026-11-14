import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CACHE_KEYS, CACHE_TTL, invalidateQuotaHistoryCaches, quotaHistoryCache } from "@/lib/cache";
import {
  DEFAULT_MODEL_PRICING,
  calculateTieredCost,
  isLongContextPrompt,
  isPeakRequest,
  resolveModelPrice,
  type ModelPrice,
} from "@/lib/model-pricing";
import { normalizeFraction, type QuotaAccount } from "@/lib/model-first-monitoring";
import { canonicalizeOAuthProvider } from "@/lib/providers/constants";
import { detectModelProvider } from "@/lib/providers/model-grouping";
import { slugifyLabel } from "@/lib/quota/labels";

const SNAPSHOT_HEARTBEAT_MS = 15 * 60 * 1000;
const SNAPSHOT_DELTA_THRESHOLD = 0.005;
const HISTORY_WINDOW_DAYS = 14;
const CALIBRATION_LOOKBACK_DAYS = 30;
const MIN_OBSERVED_DELTA = 0.02;
const RESET_TIME_TOLERANCE_MS = 60_000;
const DELTA_EPSILON = 1e-9;

interface SnapshotCandidate {
  authIndex: string;
  provider: string;
  groupId: string;
  modelId: string;
  remaining: number;
  resetTime: Date | null;
}

export interface QuotaHistoryPoint {
  timestamp: string;
  remainingPct: number;
  estimatedRemainingUsd: number | null;
}

export interface QuotaModelValuation {
  modelId: string;
  groupId: string;
  currentRemainingPct: number | null;
  resetTime: string | null;
  estimatedFullWindowUsd: number | null;
  previousEstimatedFullWindowUsd: number | null;
  estimatedRemainingUsd: number | null;
  observedDelta: number;
  observedUsageUsd: number;
  series: QuotaHistoryPoint[];
}

export interface AccountQuotaHistoryResponse {
  authIndex: string;
  models: QuotaModelValuation[];
  windows: Record<string, { estimatedFullWindowUsd: number | null; previousEstimatedFullWindowUsd: number | null; estimatedRemainingUsd: number | null }>;
  hasAnySnapshots: boolean;
}

function parseResetDate(resetTime: string | null | undefined): Date | null {
  if (!resetTime) return null;
  const ms = Date.parse(resetTime);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function estimateUsageRecordUsd(
  record: { model: string; inputTokens: number; outputTokens: number; reasoningTokens: number; cachedTokens: number; cacheWriteTokens: number; cacheWrite1hTokens: number; totalTokens: number; timestamp: Date },
  price: ModelPrice
): number {
  // Gemini-family totals report thoughts beside candidates; they are billed as output.
  const separateReasoning = record.reasoningTokens > 0 &&
    record.totalTokens === record.inputTokens + record.outputTokens + record.reasoningTokens
    ? record.reasoningTokens
    : 0;
  const bucket = {
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens + separateReasoning,
    cachedTokens: record.cachedTokens,
  };
  const empty = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  const baseCost = isLongContextPrompt(record.inputTokens, price)
    ? calculateTieredCost(empty, bucket, price)
    : isPeakRequest(record.timestamp, price)
      ? calculateTieredCost(empty, empty, price, bucket)
      : calculateTieredCost(bucket, empty, price);
  // Anthropic bills 5-minute cache writes at 1.25x input and 1-hour writes at 2x.
  const cacheWrite5m = record.cacheWriteTokens - record.cacheWrite1hTokens;
  return baseCost + (cacheWrite5m * 1.25 + record.cacheWrite1hTokens * 2) * price.inputPer1M / 1_000_000;
}

/**
 * Persist deduplicated quota snapshots for healthy accounts.
 * Only writes when remaining changed by >= 0.5%, resetTime shifted, or 15m elapsed.
 */
export async function recordQuotaSnapshots(accounts: QuotaAccount[]): Promise<number> {
  const candidates: SnapshotCandidate[] = [];
  for (const account of accounts) {
    if (!account.supported || account.error || !account.groups?.length || !account.auth_index) continue;
    for (const group of account.groups) {
      if (group.id === "extra-usage") continue;
      if (group.models.length > 0) {
        for (const model of group.models) {
          const remaining = normalizeFraction(model.remainingFraction);
          if (remaining === null) continue;
          candidates.push({
            authIndex: account.auth_index,
            provider: account.provider,
            groupId: group.id,
            modelId: model.id,
            remaining,
            resetTime: parseResetDate(model.resetTime),
          });
        }
      } else {
        const remaining = normalizeFraction(group.remainingFraction);
        if (remaining === null) continue;
        candidates.push({
          authIndex: account.auth_index,
          provider: account.provider,
          groupId: group.id,
          modelId: "",
          remaining,
          resetTime: parseResetDate(group.resetTime),
        });
      }
    }
  }

  if (candidates.length === 0) return 0;

  const authIndices = Array.from(new Set(candidates.map((c) => c.authIndex)));
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.quotaSnapshot.findMany({
    where: {
      authIndex: { in: authIndices },
      capturedAt: { gte: recentCutoff },
    },
    distinct: ["authIndex", "groupId", "modelId"],
    orderBy: { capturedAt: "desc" },
    select: {
      authIndex: true,
      groupId: true,
      modelId: true,
      remaining: true,
      resetTime: true,
      capturedAt: true,
    },
  });
  const latestMap = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const key = `${row.authIndex}|${row.groupId}|${row.modelId}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, row);
    }
  }

  const nowMs = Date.now();
  const toInsert = candidates.filter((c) => {
    const prev = latestMap.get(`${c.authIndex}|${c.groupId}|${c.modelId}`);
    if (!prev) return true;
    if (nowMs - prev.capturedAt.getTime() >= SNAPSHOT_HEARTBEAT_MS) return true;
    if (Math.abs(prev.remaining - c.remaining) >= SNAPSHOT_DELTA_THRESHOLD) return true;
    const prevReset = prev.resetTime?.getTime() ?? 0;
    const nextReset = c.resetTime?.getTime() ?? 0;
    if (Math.abs(prevReset - nextReset) > 60_000) return true;
    return false;
  });

  if (toInsert.length === 0) return 0;

  const created = await prisma.quotaSnapshot.createMany({
    data: toInsert.map((c) => ({
      authIndex: c.authIndex,
      provider: c.provider,
      groupId: c.groupId,
      modelId: c.modelId,
      remaining: c.remaining,
      resetTime: c.resetTime,
    })),
  });
  invalidateQuotaHistoryCaches(Array.from(new Set(toInsert.map((c) => c.authIndex))));

  if (Math.random() < 0.02) {
    const pruneBefore = new Date(Date.now() - CALIBRATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    await prisma.quotaSnapshot.deleteMany({ where: { capturedAt: { lt: pruneBefore } } }).catch((err) => {
      logger.warn({ err }, "Failed to prune old quota snapshots");
    });
  }

  return created.count;
}

/**
 * Compute quota history and independent per-model API value estimates for one account.
 * Returns null estimates whenever observed depletion or attributable usage is insufficient.
 */
type SnapshotRow = {
  authIndex: string;
  provider?: string;
  groupId: string;
  modelId: string;
  remaining: number;
  resetTime: Date | null;
  capturedAt: Date;
};

type UsageRow = {
  authIndex: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  cachedTokens: number;
  totalTokens: number;
  timestamp: Date;
};

const catalogModelPrices = new WeakMap<Record<string, ModelPrice>, Map<string, ModelPrice | null>>();

type PrecomputedUsage = {
  model: string;
  timestampMs: number;
  priced: boolean;
  usd: number;
  price: ModelPrice | null;
};

function normalizeBareModelId(modelId: string): string {
  const lower = modelId.trim().toLowerCase();
  const slashIdx = lower.lastIndexOf("/");
  return slashIdx >= 0 ? lower.slice(slashIdx + 1) : lower;
}

function classifyModelFamily(modelId: string, price: ModelPrice | null) {
  const bare = normalizeBareModelId(modelId);
  const groupedProvider = detectModelProvider(bare);
  const priceProvider = price?.provider?.trim().toLowerCase() ?? "";

  const isArgon = bare.includes("argon");
  const isGemini = !isArgon && (groupedProvider === "Gemini" || priceProvider === "google" || bare.includes("gemini"));
  const isClaude = groupedProvider === "Claude" || priceProvider === "anthropic" || bare.includes("claude");
  const isOpenAICodex =
    groupedProvider === "OpenAI/Codex" ||
    priceProvider === "openai" ||
    /^(gpt-|o1|o3|o4)/.test(bare) ||
    bare.includes("codex");
  const isKimi =
    groupedProvider === "Kimi" ||
    priceProvider === "moonshot ai" ||
    bare.includes("kimi") ||
    bare.includes("moonshot");
  const isXai = groupedProvider === "xAI" || priceProvider === "xai" || bare.startsWith("grok");

  return { bare, isArgon, isGemini, isClaude, isOpenAICodex, isKimi, isXai };
}

/**
 * Authoritative mapping between usage models and quota window group IDs.
 * Mirrors the window definitions in `/api/quota` and `lib/quota/codex.ts`.
 */
function doesModelBelongToWindow(
  modelId: string,
  groupId: string,
  windowProvider: string | undefined,
  price: ModelPrice | null
): boolean {
  const gid = groupId.trim().toLowerCase();
  const { bare, isArgon, isGemini, isClaude, isOpenAICodex, isKimi, isXai } = classifyModelFamily(modelId, price);

  // Antigravity windows (see antigravityFamily / parseAntigravitySummary in /api/quota)
  if (gid === "gemini-argon-weekly" || gid === "gemini-argon-5h" || gid.startsWith("gemini-argon-")) {
    return isArgon;
  }
  if (gid === "gemini-weekly" || gid === "gemini-5h") {
    return isGemini;
  }
  if (gid === "claude-gpt-weekly" || gid === "claude-gpt-5h") {
    return isClaude || isOpenAICodex;
  }

  // Claude windows (see fetchClaudeQuota / buildClaudeLimitGroups in /api/quota)
  if (
    gid === "five-hour" ||
    gid === "seven-day" ||
    gid === "requests" ||
    gid === "input-tokens" ||
    gid === "output-tokens"
  ) {
    return isClaude;
  }
  if (gid === "seven-day-sonnet") {
    return isClaude && bare.includes("sonnet");
  }
  if (gid === "seven-day-opus") {
    return isClaude && bare.includes("opus");
  }
  if (gid === "seven-day-fable" || gid === "seven-day-oi") {
    return isClaude && bare.includes("fable");
  }
  if (gid.startsWith("seven-day-")) {
    const scopeSlug = gid.slice("seven-day-".length);
    return isClaude && Boolean(scopeSlug) && slugifyLabel(bare).includes(scopeSlug);
  }
  if (gid.startsWith("limit-")) {
    const scopeSlug = gid.slice("limit-".length);
    return isClaude && Boolean(scopeSlug) && slugifyLabel(bare).includes(scopeSlug);
  }

  // Codex windows (see parseCodexQuota in lib/quota/codex.ts)
  if (gid === "primary-window" || gid === "secondary-window") {
    return isOpenAICodex;
  }
  if (gid.endsWith("-primary-window") || gid.endsWith("-secondary-window")) {
    const scopeSlug = gid.replace(/-(primary|secondary)-window$/, "");
    if (scopeSlug === "code-review") {
      return bare.includes("code-review");
    }
    if (scopeSlug === "codex-bengalfox" || scopeSlug === "spark") {
      return isOpenAICodex && (bare.includes("spark") || bare.includes("bengalfox"));
    }
    return isOpenAICodex && Boolean(scopeSlug) && slugifyLabel(bare).includes(scopeSlug);
  }

  // Kimi windows (see fetchKimiQuota in /api/quota)
  if (gid === "kimi-weekly" || gid.startsWith("kimi-limit-")) {
    return isKimi;
  }

  // Grok shared usage pool (see parseXaiQuota in lib/quota/xai.ts)
  if (gid === "xai-usage-pool" || gid.startsWith("xai-product-")) {
    return isXai;
  }

  // GitHub Copilot shares a single premium-requests window across routed models
  if (gid === "premium-requests") {
    return true;
  }

  // Fallback for unrecognized/generic window IDs: constrain by canonical provider when known
  const canonicalProvider = canonicalizeOAuthProvider(windowProvider);
  if (canonicalProvider === "claude") return isClaude;
  if (canonicalProvider === "codex") return isOpenAICodex;
  if (canonicalProvider === "kimi" || canonicalProvider === "kimi-ai") return isKimi;
  if (canonicalProvider === "gemini-cli") return isGemini || isArgon;

  return true;
}

function isWindowReset(previous: SnapshotRow, current: SnapshotRow): boolean {
  if (
    previous.resetTime &&
    previous.capturedAt.getTime() < previous.resetTime.getTime() &&
    current.capturedAt.getTime() >= previous.resetTime.getTime()
  ) {
    return true;
  }
  // An untouched window reports a rolling reset (now + window length) until first use anchors it,
  // so a reset-time shift away from a full window is the window starting, not a reset.
  if (
    previous.remaining < 1 - DELTA_EPSILON &&
    previous.resetTime &&
    current.resetTime &&
    Math.abs(current.resetTime.getTime() - previous.resetTime.getTime()) >= RESET_TIME_TOLERANCE_MS
  ) {
    return true;
  }
  // Within the same reset window, small upward fluctuations (e.g. Antigravity jitter) are not resets;
  // only treat a jump back to full capacity (>=5% increase) or an increase without resetTime as a reset.
  if (previous.resetTime && current.resetTime) {
    return (
      previous.remaining < 1 - DELTA_EPSILON &&
      current.remaining >= 1 - DELTA_EPSILON &&
      current.remaining - previous.remaining >= 0.05
    );
  }
  return current.remaining - previous.remaining > 0.02;
}

function isQualifyingDepletion(delta: number, usageUsd: number): boolean {
  return delta + DELTA_EPSILON >= MIN_OBSERVED_DELTA && usageUsd > 0;
}

function computeQuotaHistoryForAccount(
  authIndex: string,
  snapshots: SnapshotRow[],
  usageRecords: UsageRow[],
  pricing: Record<string, ModelPrice>
): AccountQuotaHistoryResponse {
  if (snapshots.length === 0) {
    return { authIndex, models: [], windows: {}, hasAnySnapshots: false };
  }

  const snapshotsByModel = new Map<string, SnapshotRow[]>();
  const windowSnapshotsByGroup = new Map<string, SnapshotRow[]>();
  const groupProviderMap = new Map<string, string>();
  let latestAccountCapturedMs = 0;

  for (const snap of snapshots) {
    const capturedMs = snap.capturedAt.getTime();
    if (capturedMs > latestAccountCapturedMs) {
      latestAccountCapturedMs = capturedMs;
    }
    if (snap.provider && !groupProviderMap.has(snap.groupId)) {
      groupProviderMap.set(snap.groupId, snap.provider);
    }
    const isWindowLevel = !snap.modelId || snap.modelId === snap.groupId;
    if (!isWindowLevel) {
      const list = snapshotsByModel.get(snap.modelId) ?? [];
      list.push(snap);
      snapshotsByModel.set(snap.modelId, list);
    } else {
      const list = windowSnapshotsByGroup.get(snap.groupId) ?? [];
      list.push(snap);
      windowSnapshotsByGroup.set(snap.groupId, list);
    }
  }

  let modelPrices = catalogModelPrices.get(pricing);
  if (!modelPrices) {
    modelPrices = new Map<string, ModelPrice | null>();
    catalogModelPrices.set(pricing, modelPrices);
  }
  // Antigravity reports cached tokens inside input even for Claude models.
  const accountProvider = snapshots.find((snap) => snap.provider)?.provider;
  const provider = canonicalizeOAuthProvider(accountProvider);
  const cacheAccounting = provider === "antigravity" ? "included" : undefined;
  const resolveCachedPrice = (model: string): ModelPrice | null => {
    if (!modelPrices.has(model)) {
      modelPrices.set(model, resolveModelPrice(model, pricing));
    }
    const price = modelPrices.get(model) ?? null;
    return price && cacheAccounting && price.cacheAccounting !== cacheAccounting ? { ...price, cacheAccounting } : price;
  };
  const precomputedUsage: PrecomputedUsage[] = usageRecords
    .map((record) => {
      const price = resolveCachedPrice(record.model);
      return {
        model: record.model,
        timestampMs: record.timestamp.getTime(),
        priced: price !== null,
        usd: price ? estimateUsageRecordUsd(record, price) : 0,
        price,
      };
    })
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const windows: AccountQuotaHistoryResponse["windows"] = {};
  for (const [groupId, rawSeries] of windowSnapshotsByGroup) {
    const series = [...rawSeries].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    const windowProvider = groupProviderMap.get(groupId);
    let currentDelta = 0;
    let currentCost = 0;
    let lastQualifyingFullUsd: number | null = null;
    let usageIndex = 0;
    let priorQualifyingFullUsd: number | null = null;
    let lowestRemaining = series[0]!.remaining;
    for (let i = 1; i < series.length; i++) {
      const previous = series[i - 1]!;
      const current = series[i]!;
      const prevMs = previous.capturedAt.getTime();
      const currMs = current.capturedAt.getTime();

      while (usageIndex < precomputedUsage.length && precomputedUsage[usageIndex]!.timestampMs <= prevMs) {
        usageIndex++;
      }
      let intervalCost = 0;
      let fullyPriced = true;
      while (usageIndex < precomputedUsage.length && precomputedUsage[usageIndex]!.timestampMs <= currMs) {
        const record = precomputedUsage[usageIndex++]!;
        if (!doesModelBelongToWindow(record.model, groupId, windowProvider, record.price)) {
          continue;
        }
        if (!record.priced) fullyPriced = false;
        else intervalCost += record.usd;
      }

      if (isWindowReset(previous, current)) {
        if (isQualifyingDepletion(currentDelta, currentCost)) {
          priorQualifyingFullUsd = lastQualifyingFullUsd;
          lastQualifyingFullUsd = currentCost / currentDelta;
        }
        currentDelta = 0;
        currentCost = 0;
        lowestRemaining = current.remaining;
        continue;
      }

      const drop = Math.max(0, lowestRemaining - current.remaining);
      lowestRemaining = Math.min(lowestRemaining, current.remaining);
      if (drop > 0 && fullyPriced && intervalCost > 0) {
        currentDelta += drop;
        currentCost += intervalCost;
      }
    }

    const windowQualifies = isQualifyingDepletion(currentDelta, currentCost);
    const full = windowQualifies ? currentCost / currentDelta : lastQualifyingFullUsd;
    windows[groupId] = {
      estimatedFullWindowUsd: full,
      previousEstimatedFullWindowUsd: windowQualifies ? lastQualifyingFullUsd : priorQualifyingFullUsd,
      estimatedRemainingUsd: full === null ? null : full * series[series.length - 1]!.remaining,
    };
  }

  const usageModels = new Set<string>();
  for (const rec of precomputedUsage) {
    usageModels.add(rec.model);
  }

  const candidateModels = new Set<string>([...snapshotsByModel.keys(), ...usageModels]);
  const models: QuotaModelValuation[] = [];
  const seriesCutoffMs = latestAccountCapturedMs - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const modelId of candidateModels) {
    const targetPrice = resolveCachedPrice(modelId);
    const matchingWindows = [...windowSnapshotsByGroup.entries()].filter(([groupId]) =>
      doesModelBelongToWindow(modelId, groupId, groupProviderMap.get(groupId), targetPrice)
    );
    const dedicatedModelSnaps = snapshotsByModel.get(modelId);
    const isDedicatedModelSnapshots = matchingWindows.length === 0 && Boolean(dedicatedModelSnaps?.length);
    const seriesOptions: ReadonlyArray<readonly [string, SnapshotRow[]]> =
      matchingWindows.length > 0
        ? matchingWindows
        : isDedicatedModelSnapshots && dedicatedModelSnaps
          ? [[dedicatedModelSnaps[0]!.groupId, dedicatedModelSnaps] as const]
          : [];

    for (const [optionGroupId, rawSeriesSnaps] of seriesOptions) {
      if (rawSeriesSnaps.length === 0) continue;
      const seriesSnaps = [...rawSeriesSnaps].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
      const latest = seriesSnaps[seriesSnaps.length - 1]!;
      const resolvedGroupId = optionGroupId || latest.groupId;
      const windowProvider = groupProviderMap.get(resolvedGroupId) ?? latest.provider;

      let currentDelta = 0;
      let currentUsageUsd = 0;
      let lastQualifying: { fullUsd: number; delta: number; usageUsd: number } | null = null;
      let priorQualifyingFullUsd: number | null = null;
      let usageIdx = 0;
      let lowestRemaining = seriesSnaps[0]!.remaining;
      for (let i = 0; i < seriesSnaps.length - 1; i++) {
        const prev = seriesSnaps[i]!;
        const next = seriesSnaps[i + 1]!;
        const startMs = prev.capturedAt.getTime();
        const endMs = next.capturedAt.getTime();

        while (usageIdx < precomputedUsage.length && precomputedUsage[usageIdx]!.timestampMs <= startMs) {
          usageIdx++;
        }
        let intervalUsd = 0;
        let hasOtherModel = false;
        let targetUnpriced = false;
        while (usageIdx < precomputedUsage.length && precomputedUsage[usageIdx]!.timestampMs <= endMs) {
          const rec = precomputedUsage[usageIdx++]!;
          if (!isDedicatedModelSnapshots && !doesModelBelongToWindow(rec.model, resolvedGroupId, windowProvider, rec.price)) {
            continue;
          }
          if (rec.model === modelId) {
            if (!rec.priced) targetUnpriced = true;
            else intervalUsd += rec.usd;
          } else if (!isDedicatedModelSnapshots) {
            hasOtherModel = true;
          }
        }

        if (isWindowReset(prev, next)) {
          if (isQualifyingDepletion(currentDelta, currentUsageUsd)) {
            priorQualifyingFullUsd = lastQualifying?.fullUsd ?? null;
            lastQualifying = {
              fullUsd: currentUsageUsd / currentDelta,
              delta: currentDelta,
              usageUsd: currentUsageUsd,
            };
          }
          currentDelta = 0;
          currentUsageUsd = 0;
          lowestRemaining = next.remaining;
          continue;
        }

        const delta = Math.max(0, lowestRemaining - next.remaining);
        lowestRemaining = Math.min(lowestRemaining, next.remaining);
        const exclusivelyModel = isDedicatedModelSnapshots || !hasOtherModel;
        if (delta > 0 && exclusivelyModel && !targetUnpriced && intervalUsd > 0) {
          currentDelta += delta;
          currentUsageUsd += intervalUsd;
        }
      }

      const currentQualifies = isQualifyingDepletion(currentDelta, currentUsageUsd);
      const estimatedFullWindowUsd = currentQualifies
        ? currentUsageUsd / currentDelta
        : (lastQualifying?.fullUsd ?? null);
      const previousEstimatedFullWindowUsd = currentQualifies
        ? (lastQualifying?.fullUsd ?? null)
        : priorQualifyingFullUsd;
      const observedDelta = currentQualifies
        ? currentDelta
        : (lastQualifying?.delta ?? currentDelta);
      const observedUsageUsd = currentQualifies
        ? currentUsageUsd
        : (lastQualifying?.usageUsd ?? currentUsageUsd);
      if (observedUsageUsd <= 0) continue;
      const estimatedRemainingUsd =
        estimatedFullWindowUsd !== null ? estimatedFullWindowUsd * latest.remaining : null;
      const visibleSnaps = seriesSnaps.filter((snap) => snap.capturedAt.getTime() >= seriesCutoffMs);

      models.push({
        modelId,
        groupId: resolvedGroupId,
        currentRemainingPct: Math.round(latest.remaining * 1000) / 10,
        resetTime: latest.resetTime ? latest.resetTime.toISOString() : null,
        estimatedFullWindowUsd,
        previousEstimatedFullWindowUsd,
        estimatedRemainingUsd,
        observedDelta,
        observedUsageUsd,
        series: visibleSnaps.map((snap) => ({
          timestamp: snap.capturedAt.toISOString(),
          remainingPct: Math.round(snap.remaining * 1000) / 10,
          estimatedRemainingUsd:
            estimatedFullWindowUsd !== null ? estimatedFullWindowUsd * snap.remaining : null,
        })),
      });
    }
  }

  models.sort(
    (a, b) =>
      (b.estimatedFullWindowUsd ?? -1) - (a.estimatedFullWindowUsd ?? -1) ||
      a.modelId.localeCompare(b.modelId) ||
      a.groupId.localeCompare(b.groupId)
  );

  return {
    authIndex,
    windows,
    models,
    hasAnySnapshots: true,
  };
}

export async function getAccountsQuotaHistory(
  authIndices: string[],
  pricing: Record<string, ModelPrice> = DEFAULT_MODEL_PRICING
): Promise<Record<string, AccountQuotaHistoryResponse>> {
  const uniqueIndices = Array.from(new Set(authIndices.map((s) => s.trim()).filter(Boolean)));
  const result: Record<string, AccountQuotaHistoryResponse> = {};
  const missing: string[] = [];

  for (const id of uniqueIndices) {
    const cached = quotaHistoryCache.get(CACHE_KEYS.quotaHistory(id)) as AccountQuotaHistoryResponse | null;
    if (cached) {
      result[id] = cached;
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) {
    return result;
  }

  const since = new Date(Date.now() - CALIBRATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [snapshots, usageRecords] = await Promise.all([
    prisma.quotaSnapshot.findMany({
      where: { authIndex: { in: missing }, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
      select: {
        authIndex: true,
        provider: true,
        groupId: true,
        modelId: true,
        remaining: true,
        resetTime: true,
        capturedAt: true,
      },
    }),
    prisma.usageRecord.findMany({
      where: {
        authIndex: { in: missing },
        failed: false,
        totalTokens: { gt: 0 },
        timestamp: { gte: since },
      },
      orderBy: { timestamp: "asc" },
      select: {
        authIndex: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        cacheWriteTokens: true,
        cacheWrite1hTokens: true,
        cachedTokens: true,
        totalTokens: true,
        timestamp: true,
      },
    }),
  ]);

  const snapsByAccount = new Map<string, SnapshotRow[]>();
  for (const snap of snapshots) {
    const list = snapsByAccount.get(snap.authIndex) ?? [];
    list.push(snap);
    snapsByAccount.set(snap.authIndex, list);
  }

  const usageByAccount = new Map<string, UsageRow[]>();
  for (const rec of usageRecords) {
    const list = usageByAccount.get(rec.authIndex) ?? [];
    list.push(rec);
    usageByAccount.set(rec.authIndex, list);
  }

  for (const id of missing) {
    const computed = computeQuotaHistoryForAccount(
      id,
      snapsByAccount.get(id) ?? [],
      usageByAccount.get(id) ?? [],
      pricing
    );
    quotaHistoryCache.set(CACHE_KEYS.quotaHistory(id), computed, CACHE_TTL.QUOTA_HISTORY);
    result[id] = computed;
  }

  return result;
}

export async function getAccountQuotaHistory(
  authIndex: string,
  pricing: Record<string, ModelPrice> = DEFAULT_MODEL_PRICING
): Promise<AccountQuotaHistoryResponse> {
  const histories = await getAccountsQuotaHistory([authIndex], pricing);
  return histories[authIndex] ?? { authIndex, models: [], windows: {}, hasAnySnapshots: false };
}

import { prisma } from "@/lib/db";
import { CACHE_KEYS, CACHE_TTL, quotaHistoryCache } from "@/lib/cache";
import {
  calculateTieredCost,
  isLongContextPrompt,
  isPeakRequest,
  resolveModelPrice,
  type ModelPrice,
} from "@/lib/model-pricing";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";
import { canonicalizeOAuthProvider } from "@/lib/providers/constants";
import { detectModelProvider } from "@/lib/providers/model-grouping";
import { slugifyLabel } from "@/lib/quota/labels";
import { RESET_TIME_TOLERANCE_MS } from "@/lib/quota/quota-snapshots";

const HISTORY_WINDOW_DAYS = 14;
const CALIBRATION_LOOKBACK_DAYS = 30;
const MIN_OBSERVED_DELTA = 0.02;
const DELTA_EPSILON = 1e-9;

const REQUEST_COUNT_WINDOWS = new Set(["premium-requests", "requests"]);

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
  windows: Record<
    string,
    {
      estimatedFullWindowUsd: number | null;
      previousEstimatedFullWindowUsd: number | null;
      estimatedRemainingUsd: number | null;
    }
  >;
  hasAnySnapshots: boolean;
}

function isRequestCountWindow(groupId: string): boolean {
  return REQUEST_COUNT_WINDOWS.has(groupId.trim().toLowerCase());
}

function estimateUsageRecordUsd(
  record: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedTokens: number;
    cacheWriteTokens: number;
    cacheWrite1hTokens: number;
    totalTokens: number;
    timestamp: Date;
  },
  price: ModelPrice
): number {
  // Gemini-family totals report thoughts beside candidates; they are billed as output.
  const separateReasoning =
    record.reasoningTokens > 0 &&
    record.totalTokens === record.inputTokens + record.outputTokens + record.reasoningTokens
      ? record.reasoningTokens
      : 0;
  const bucket = {
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens + separateReasoning,
    cachedTokens: record.cachedTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    cacheWrite1hTokens: record.cacheWrite1hTokens,
  };
  const empty = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  if (isLongContextPrompt(record.inputTokens, price)) {
    return calculateTieredCost(empty, bucket, price);
  }
  if (isPeakRequest(record.timestamp, price)) {
    return calculateTieredCost(empty, empty, price, bucket);
  }
  return calculateTieredCost(bucket, empty, price);
}

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
  const claudeScope = gid.startsWith("seven-day-")
    ? gid.slice("seven-day-".length)
    : gid.startsWith("limit-")
      ? gid.slice("limit-".length)
      : null;
  if (claudeScope !== null) {
    const normalizedScope = claudeScope === "oi" ? "fable" : claudeScope;
    return isClaude && Boolean(normalizedScope) && slugifyLabel(bare).includes(normalizedScope);
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

interface CalibrationAccumulator {
  currentDelta: number;
  currentUsd: number;
  lastQualifying: { fullUsd: number; delta: number; usageUsd: number } | null;
  priorQualifyingFullUsd: number | null;
}

function createAccumulator(): CalibrationAccumulator {
  return {
    currentDelta: 0,
    currentUsd: 0,
    lastQualifying: null,
    priorQualifyingFullUsd: null,
  };
}

function finalizeAccumulatorWindow(acc: CalibrationAccumulator, skipUsdValuation: boolean): void {
  if (!skipUsdValuation && isQualifyingDepletion(acc.currentDelta, acc.currentUsd)) {
    acc.priorQualifyingFullUsd = acc.lastQualifying?.fullUsd ?? null;
    acc.lastQualifying = {
      fullUsd: acc.currentUsd / acc.currentDelta,
      delta: acc.currentDelta,
      usageUsd: acc.currentUsd,
    };
  }
  acc.currentDelta = 0;
  acc.currentUsd = 0;
}

function readAccumulatorEstimate(acc: CalibrationAccumulator, skipUsdValuation: boolean) {
  const currentQualifies = !skipUsdValuation && isQualifyingDepletion(acc.currentDelta, acc.currentUsd);
  const estimatedFullWindowUsd = skipUsdValuation
    ? null
    : currentQualifies
      ? acc.currentUsd / acc.currentDelta
      : (acc.lastQualifying?.fullUsd ?? null);
  const previousEstimatedFullWindowUsd = skipUsdValuation
    ? null
    : currentQualifies
      ? (acc.lastQualifying?.fullUsd ?? null)
      : acc.priorQualifyingFullUsd;
  const observedDelta = currentQualifies ? acc.currentDelta : (acc.lastQualifying?.delta ?? acc.currentDelta);
  const observedUsageUsd = skipUsdValuation
    ? 0
    : currentQualifies
      ? acc.currentUsd
      : (acc.lastQualifying?.usageUsd ?? acc.currentUsd);
  return {
    estimatedFullWindowUsd,
    previousEstimatedFullWindowUsd,
    observedDelta,
    observedUsageUsd,
  };
}

function calibrateSeries(
  series: SnapshotRow[],
  precomputedUsage: PrecomputedUsage[],
  matchesUsage: (rec: PrecomputedUsage) => boolean,
  skipUsdValuation: boolean
): {
  windowAcc: CalibrationAccumulator;
  modelAccs: Map<string, CalibrationAccumulator>;
} {
  const windowAcc = createAccumulator();
  const modelAccs = new Map<string, CalibrationAccumulator>();
  let pendingUsd = 0;
  let pendingHasUnpriced = false;
  let pendingModels = new Map<string, number>();
  let usageIndex = 0;
  let lowestRemaining = series[0]!.remaining;

  const resetPending = () => {
    pendingUsd = 0;
    pendingHasUnpriced = false;
    pendingModels = new Map<string, number>();
  };

  for (let i = 1; i < series.length; i++) {
    const previous = series[i - 1]!;
    const current = series[i]!;
    const prevMs = previous.capturedAt.getTime();
    const currMs = current.capturedAt.getTime();

    while (usageIndex < precomputedUsage.length && precomputedUsage[usageIndex]!.timestampMs <= prevMs) {
      usageIndex++;
    }

    let intervalCount = 0;
    while (usageIndex < precomputedUsage.length && precomputedUsage[usageIndex]!.timestampMs <= currMs) {
      const record = precomputedUsage[usageIndex++]!;
      if (!matchesUsage(record)) continue;
      intervalCount++;
      if (!record.priced) {
        pendingHasUnpriced = true;
      } else {
        pendingUsd += record.usd;
        pendingModels.set(record.model, (pendingModels.get(record.model) ?? 0) + record.usd);
      }
    }

    if (isWindowReset(previous, current)) {
      finalizeAccumulatorWindow(windowAcc, skipUsdValuation);
      for (const acc of modelAccs.values()) {
        finalizeAccumulatorWindow(acc, skipUsdValuation);
      }
      resetPending();
      lowestRemaining = current.remaining;
      continue;
    }

    const drop = Math.max(0, lowestRemaining - current.remaining);
    lowestRemaining = Math.min(lowestRemaining, current.remaining);

    if (drop > 0) {
      // Drops with no logged CLIProxyAPI usage (e.g. subscription used externally)
      // leave calibrated $/window unchanged.
      if (!pendingHasUnpriced && pendingUsd > 0) {
        windowAcc.currentDelta += drop;
        windowAcc.currentUsd += pendingUsd;
        if (pendingModels.size === 1) {
          const [soleModel, soleUsd] = pendingModels.entries().next().value!;
          if (soleUsd > 0) {
            let modelAcc = modelAccs.get(soleModel);
            if (!modelAcc) {
              modelAcc = createAccumulator();
              modelAccs.set(soleModel, modelAcc);
            }
            modelAcc.currentDelta += drop;
            modelAcc.currentUsd += soleUsd;
          }
        }
      }
      resetPending();
    } else if (pendingHasUnpriced && (current.remaining < previous.remaining || intervalCount === 0)) {
      resetPending();
    }
  }

  return { windowAcc, modelAccs };
}

function buildModelSeriesPoints(
  series: SnapshotRow[],
  cutoffMs: number,
  estimatedFullWindowUsd: number | null
): QuotaHistoryPoint[] {
  return series
    .filter((snap) => snap.capturedAt.getTime() >= cutoffMs)
    .map((snap) => ({
      timestamp: snap.capturedAt.toISOString(),
      remainingPct: Math.round(snap.remaining * 1000) / 10,
      estimatedRemainingUsd:
        estimatedFullWindowUsd !== null ? estimatedFullWindowUsd * snap.remaining : null,
    }));
}

function buildQuotaModelValuation(params: {
  modelId: string;
  groupId: string;
  series: SnapshotRow[];
  seriesCutoffMs: number;
  estimatedFullWindowUsd: number | null;
  previousEstimatedFullWindowUsd: number | null;
  estimatedRemainingUsd?: number | null;
  observedDelta: number;
  observedUsageUsd: number;
}): QuotaModelValuation {
  const latest = params.series[params.series.length - 1]!;
  return {
    modelId: params.modelId,
    groupId: params.groupId,
    currentRemainingPct: Math.round(latest.remaining * 1000) / 10,
    resetTime: latest.resetTime ? latest.resetTime.toISOString() : null,
    estimatedFullWindowUsd: params.estimatedFullWindowUsd,
    previousEstimatedFullWindowUsd: params.previousEstimatedFullWindowUsd,
    estimatedRemainingUsd:
      params.estimatedRemainingUsd !== undefined
        ? params.estimatedRemainingUsd
        : params.estimatedFullWindowUsd !== null
          ? params.estimatedFullWindowUsd * latest.remaining
          : null,
    observedDelta: params.observedDelta,
    observedUsageUsd: params.observedUsageUsd,
    series: buildModelSeriesPoints(params.series, params.seriesCutoffMs, params.estimatedFullWindowUsd),
  };
}

function computeQuotaHistoryForAccount(
  authIndex: string,
  snapshots: SnapshotRow[],
  usageRecords: UsageRow[],
  customPricing?: Record<string, ModelPrice>,
  livePricing?: Record<string, ModelPrice>
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

  const cacheKeyObj = customPricing ?? livePricing;
  let modelPrices = cacheKeyObj ? catalogModelPrices.get(cacheKeyObj) : undefined;
  if (!modelPrices) {
    modelPrices = new Map<string, ModelPrice | null>();
    if (cacheKeyObj && (!customPricing || !livePricing)) {
      catalogModelPrices.set(cacheKeyObj, modelPrices);
    }
  }
  // Antigravity reports cached tokens inside input even for Claude models.
  const accountProvider = snapshots.find((snap) => snap.provider)?.provider;
  const provider = canonicalizeOAuthProvider(accountProvider);
  const cacheAccounting = provider === "antigravity" ? "included" : undefined;
  const resolveCachedPrice = (model: string): ModelPrice | null => {
    if (!modelPrices.has(model)) {
      modelPrices.set(model, resolveModelPrice(model, customPricing, livePricing));
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
  const models: QuotaModelValuation[] = [];
  const representedGroups = new Set<string>();
  const seriesCutoffMs = latestAccountCapturedMs - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const [groupId, rawSeries] of windowSnapshotsByGroup) {
    if (groupId.startsWith("gemini-argon-")) continue;
    if (rawSeries.length === 0) continue;
    const series = [...rawSeries].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    const latest = series[series.length - 1]!;
    const windowProvider = groupProviderMap.get(groupId) ?? latest.provider;
    const skipUsdValuation = isRequestCountWindow(groupId);

    // Retain the last appearance until five subsequent resets have been observed.
    let calibrationStart = 0;
    if (groupId.endsWith("-5h")) {
      let resets = 0;
      for (let i = series.length - 1; i > 0; i--) {
        if (isWindowReset(series[i - 1]!, series[i]!) && ++resets === 6) {
          calibrationStart = i;
          break;
        }
      }
    }
    const calibrationSeries = calibrationStart ? series.slice(calibrationStart) : series;

    const { windowAcc, modelAccs } = calibrateSeries(
      calibrationSeries,
      precomputedUsage,
      (rec) => doesModelBelongToWindow(rec.model, groupId, windowProvider, rec.price),
      skipUsdValuation
    );
    const windowEst = readAccumulatorEstimate(windowAcc, skipUsdValuation);
    const windowRemainingUsd =
      windowEst.estimatedFullWindowUsd !== null ? windowEst.estimatedFullWindowUsd * latest.remaining : null;

    windows[groupId] = {
      estimatedFullWindowUsd: windowEst.estimatedFullWindowUsd,
      previousEstimatedFullWindowUsd: windowEst.previousEstimatedFullWindowUsd,
      estimatedRemainingUsd: windowRemainingUsd,
    };

    for (const [modelId, modelAcc] of modelAccs) {
      const modelEst = readAccumulatorEstimate(modelAcc, skipUsdValuation);
      if (modelEst.observedUsageUsd <= 0 && modelEst.estimatedFullWindowUsd === null) continue;
      representedGroups.add(groupId);
      models.push(
        buildQuotaModelValuation({
          modelId,
          groupId,
          series,
          seriesCutoffMs,
          ...modelEst,
        })
      );
    }

    if (!representedGroups.has(groupId)) {
      models.push(
        buildQuotaModelValuation({
          modelId: "",
          groupId,
          series,
          seriesCutoffMs,
          estimatedFullWindowUsd: windowEst.estimatedFullWindowUsd,
          previousEstimatedFullWindowUsd: windowEst.previousEstimatedFullWindowUsd,
          estimatedRemainingUsd: windowRemainingUsd,
          observedDelta: 0,
          observedUsageUsd: 0,
        })
      );
    }
  }

  for (const [modelId, rawSeries] of snapshotsByModel) {
    if (rawSeries.length === 0) continue;
    const series = [...rawSeries].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    const latest = series[series.length - 1]!;
    if (latest.groupId.startsWith("gemini-argon-")) continue;
    const groupId = latest.groupId;
    const skipUsdValuation = isRequestCountWindow(groupId);

    const { windowAcc } = calibrateSeries(
      series,
      precomputedUsage,
      (rec) => rec.model === modelId,
      skipUsdValuation
    );
    const est = readAccumulatorEstimate(windowAcc, skipUsdValuation);
    models.push(
      buildQuotaModelValuation({
        modelId,
        groupId,
        series,
        seriesCutoffMs,
        ...est,
      })
    );
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

export function redactQuotaHistoryValuation(
  history: AccountQuotaHistoryResponse
): AccountQuotaHistoryResponse {
  const redactedWindows: AccountQuotaHistoryResponse["windows"] = {};
  for (const groupId of Object.keys(history.windows)) {
    redactedWindows[groupId] = {
      estimatedFullWindowUsd: null,
      previousEstimatedFullWindowUsd: null,
      estimatedRemainingUsd: null,
    };
  }

  return {
    ...history,
    windows: redactedWindows,
    models: history.models.map((model) => ({
      ...model,
      estimatedFullWindowUsd: null,
      previousEstimatedFullWindowUsd: null,
      estimatedRemainingUsd: null,
      observedUsageUsd: 0,
      series: model.series.map((pt) => ({
        ...pt,
        estimatedRemainingUsd: null,
      })),
    })),
  };
}

export async function getAccountsQuotaHistory(
  authIndices: string[],
  customPricing?: Record<string, ModelPrice>
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
  const [snapshots, usageRecords, livePricing] = await Promise.all([
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
    getLiveModelPricing(),
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
      customPricing,
      livePricing
    );
    quotaHistoryCache.set(CACHE_KEYS.quotaHistory(id), computed, CACHE_TTL.QUOTA_HISTORY);
    result[id] = computed;
  }

  return result;
}

export async function getAccountQuotaHistory(
  authIndex: string,
  customPricing?: Record<string, ModelPrice>
): Promise<AccountQuotaHistoryResponse> {
  const histories = await getAccountsQuotaHistory([authIndex], customPricing);
  return histories[authIndex] ?? { authIndex, models: [], windows: {}, hasAnySnapshots: false };
}

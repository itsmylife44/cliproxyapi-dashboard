import { prisma } from "@/lib/db";
import { CACHE_KEYS, CACHE_TTL, quotaHistoryCache } from "@/lib/cache";
import {
  calculateRequestCost,
  resolveModelPrice,
  type ModelPrice,
} from "@/lib/model-pricing";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";
import { canonicalizeOAuthProvider } from "@/lib/providers/constants";
import { slugifyLabel } from "@/lib/quota/labels";
import { COMPLETED_QUOTA_WINDOWS_FOR_ESTIMATES, HISTORY_WINDOW_DAYS, RESET_TIME_TOLERANCE_MS } from "@/lib/quota/quota-snapshots";

const MIN_OBSERVED_DELTA = 0.02;
const DELTA_EPSILON = 1e-9;

export interface QuotaHistoryPoint {
  timestamp: string;
  remainingPct: number;
  /** The full-window estimate as it stood at this point, so pricing changes stay visible as steps. */
  estimatedFullWindowUsd: number | null;
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
      modelCostContributions: Array<{ modelId: string; projectedUsd: number }>;
    }
  >;
  /** Credit resets and primes the dashboard performed, oldest first. */
  events: Array<{ kind: string; at: string }>;
  hasAnySnapshots: boolean;
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
  return calculateRequestCost({
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens + separateReasoning,
    cachedTokens: record.cachedTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    cacheWrite1hTokens: record.cacheWrite1hTokens,
  }, record.timestamp, price);
}

type SnapshotRow = {
  authIndex: string;
  provider?: string;
  groupId: string;
  modelId: string;
  remaining: number;
  resetTime: Date | null;
  usageModels: string[];
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
};

/** Whether a usage record counts against a window covering `usageModels` (empty = all). */
function usageMatchesWindow(modelId: string, usageModels: readonly string[]): boolean {
  if (usageModels.length === 0) return true;
  const slug = slugifyLabel(modelId.slice(modelId.lastIndexOf("/") + 1));
  return usageModels.some((fragment) => slug.includes(fragment));
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
  // Within the same reset window, small upward fluctuations are not resets;
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

function estimateWindowStart(series: readonly SnapshotRow[]): number {
  // Walking back across the active window and five completed ones lands at the oldest retained start.
  let completed = 0;
  for (let i = series.length - 1; i > 0; i--) {
    if (isWindowReset(series[i - 1]!, series[i]!) && completed++ === COMPLETED_QUOTA_WINDOWS_FOR_ESTIMATES) {
      return i;
    }
  }
  return 0;
}

function isQualifyingDepletion(delta: number, usageUsd: number): boolean {
  return delta + DELTA_EPSILON >= MIN_OBSERVED_DELTA && usageUsd > 0;
}

interface CalibrationAccumulator {
  currentDelta: number;
  currentUsd: number;
  currentModelUsd: Map<string, number> | null;
  lastQualifying: { fullUsd: number; delta: number; usageUsd: number; modelUsd: ReadonlyMap<string, number> | null } | null;
  priorQualifyingFullUsd: number | null;
}

function createAccumulator(includeModelCosts: boolean): CalibrationAccumulator {
  return {
    currentDelta: 0,
    currentUsd: 0,
    currentModelUsd: includeModelCosts ? new Map() : null,
    lastQualifying: null,
    priorQualifyingFullUsd: null,
  };
}

function finalizeAccumulatorWindow(acc: CalibrationAccumulator): void {
  if (isQualifyingDepletion(acc.currentDelta, acc.currentUsd)) {
    acc.priorQualifyingFullUsd = acc.lastQualifying?.fullUsd ?? null;
    acc.lastQualifying = {
      fullUsd: acc.currentUsd / acc.currentDelta,
      delta: acc.currentDelta,
      usageUsd: acc.currentUsd,
      modelUsd: acc.currentModelUsd,
    };
    if (acc.currentModelUsd) acc.currentModelUsd = new Map();
  }
  acc.currentDelta = 0;
  acc.currentUsd = 0;
  acc.currentModelUsd?.clear();
}

function readAccumulatorEstimate(acc: CalibrationAccumulator) {
  const currentQualifies = isQualifyingDepletion(acc.currentDelta, acc.currentUsd);
  const estimatedFullWindowUsd = currentQualifies
    ? acc.currentUsd / acc.currentDelta
    : (acc.lastQualifying?.fullUsd ?? null);
  const previousEstimatedFullWindowUsd = currentQualifies
    ? (acc.lastQualifying?.fullUsd ?? null)
    : acc.priorQualifyingFullUsd;
  const observedDelta = currentQualifies ? acc.currentDelta : (acc.lastQualifying?.delta ?? acc.currentDelta);
  const observedUsageUsd = currentQualifies ? acc.currentUsd : (acc.lastQualifying?.usageUsd ?? acc.currentUsd);
  return {
    estimatedFullWindowUsd,
    previousEstimatedFullWindowUsd,
    observedDelta,
    observedUsageUsd,
  };
}

function readModelCostContributions(acc: CalibrationAccumulator): AccountQuotaHistoryResponse["windows"][string]["modelCostContributions"] {
  const currentQualifies = isQualifyingDepletion(acc.currentDelta, acc.currentUsd);
  const modelUsd = currentQualifies ? acc.currentModelUsd : acc.lastQualifying?.modelUsd;
  const delta = currentQualifies ? acc.currentDelta : acc.lastQualifying?.delta;
  if (!modelUsd || !delta) return [];
  return Array.from(modelUsd, ([modelId, usd]) => ({ modelId, projectedUsd: usd / delta }))
    .sort((a, b) => b.projectedUsd - a.projectedUsd || a.modelId.localeCompare(b.modelId));
}

/**
 * The full-window estimate at each window boundary and at the latest snapshot, null elsewhere.
 * Sampling at boundaries hides the swings of a partly used window, so a pricing change reads as one step.
 */
type EstimateTimeline = Array<number | null>;

function calibrateSeries(
  series: SnapshotRow[],
  precomputedUsage: PrecomputedUsage[],
  matchesUsage: (rec: PrecomputedUsage) => boolean,
  includeModelCosts = false
): {
  windowAcc: CalibrationAccumulator;
  windowTimeline: EstimateTimeline;
} {
  const start = estimateWindowStart(series);
  const windowAcc = createAccumulator(includeModelCosts);
  const windowTimeline: EstimateTimeline = new Array(series.length).fill(null);
  let pendingUsd = 0;
  const pendingModelUsd = includeModelCosts ? new Map<string, number>() : null;
  let pendingHasUnpriced = false;
  let usageIndex = 0;
  let lowestRemaining = series[start]!.remaining;

  const resetPending = () => {
    pendingUsd = 0;
    pendingHasUnpriced = false;
    pendingModelUsd?.clear();
  };

  for (let i = start + 1; i < series.length; i++) {
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
        if (pendingModelUsd && record.usd > 0) {
          pendingModelUsd.set(record.model, (pendingModelUsd.get(record.model) ?? 0) + record.usd);
        }
      }
    }

    const isReset = isWindowReset(previous, current);
    if (isReset) {
      finalizeAccumulatorWindow(windowAcc);
      resetPending();
      lowestRemaining = current.remaining;
    } else {
      const drop = Math.max(0, lowestRemaining - current.remaining);
      lowestRemaining = Math.min(lowestRemaining, current.remaining);

      if (drop > 0) {
        // Drops with no logged CLIProxyAPI usage (e.g. subscription used externally)
        // leave calibrated $/window unchanged.
        if (!pendingHasUnpriced && pendingUsd > 0) {
          windowAcc.currentDelta += drop;
          windowAcc.currentUsd += pendingUsd;
          if (pendingModelUsd && windowAcc.currentModelUsd) {
            for (const [modelId, usd] of pendingModelUsd) {
              windowAcc.currentModelUsd.set(modelId, (windowAcc.currentModelUsd.get(modelId) ?? 0) + usd);
            }
          }
        }
        resetPending();
      } else if (pendingHasUnpriced && (current.remaining < previous.remaining || intervalCount === 0)) {
        resetPending();
      }
    }

    if (isReset || i === series.length - 1) {
      windowTimeline[i] = readAccumulatorEstimate(windowAcc).estimatedFullWindowUsd;
    }
  }

  return { windowAcc, windowTimeline };
}

function buildModelSeriesPoints(
  series: SnapshotRow[],
  cutoffMs: number,
  timeline: EstimateTimeline
): QuotaHistoryPoint[] {
  return series.flatMap((snap, i) =>
    snap.capturedAt.getTime() >= cutoffMs
      ? [{
          timestamp: snap.capturedAt.toISOString(),
          remainingPct: Math.round(snap.remaining * 1000) / 10,
          estimatedFullWindowUsd: timeline[i] ?? null,
        }]
      : []
  );
}

function buildQuotaModelValuation(params: {
  modelId: string;
  groupId: string;
  series: SnapshotRow[];
  seriesCutoffMs: number;
  timeline: EstimateTimeline;
  estimatedFullWindowUsd: number | null;
  previousEstimatedFullWindowUsd: number | null;
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
    estimatedRemainingUsd: params.estimatedFullWindowUsd === null
      ? null
      : params.estimatedFullWindowUsd * latest.remaining,
    observedDelta: params.observedDelta,
    observedUsageUsd: params.observedUsageUsd,
    series: buildModelSeriesPoints(params.series, params.seriesCutoffMs, params.timeline),
  };
}

function computeQuotaHistoryForAccount(
  authIndex: string,
  snapshots: SnapshotRow[],
  usageRecords: UsageRow[],
  events: AccountQuotaHistoryResponse["events"],
  customPricing?: Record<string, ModelPrice>,
  livePricing?: Record<string, ModelPrice>
): AccountQuotaHistoryResponse {
  if (snapshots.length === 0) {
    return { authIndex, models: [], windows: {}, events, hasAnySnapshots: false };
  }

  const snapshotsByGroupAndModel = new Map<string, Map<string, SnapshotRow[]>>();
  const windowSnapshotsByGroup = new Map<string, SnapshotRow[]>();
  let latestAccountCapturedMs = 0;

  for (const snap of snapshots) {
    const capturedMs = snap.capturedAt.getTime();
    if (capturedMs > latestAccountCapturedMs) {
      latestAccountCapturedMs = capturedMs;
    }
    const isWindowLevel = !snap.modelId || snap.modelId === snap.groupId;
    if (!isWindowLevel) {
      let seriesByModel = snapshotsByGroupAndModel.get(snap.groupId);
      if (!seriesByModel) {
        seriesByModel = new Map();
        snapshotsByGroupAndModel.set(snap.groupId, seriesByModel);
      }
      const list = seriesByModel.get(snap.modelId) ?? [];
      list.push(snap);
      seriesByModel.set(snap.modelId, list);
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
  const cacheAccounting = canonicalizeOAuthProvider(snapshots.find((snap) => snap.provider)?.provider) === "antigravity"
    ? "included"
    : undefined;
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
      };
    })
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const windows: AccountQuotaHistoryResponse["windows"] = {};
  const models: QuotaModelValuation[] = [];
  const seriesCutoffMs = latestAccountCapturedMs - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const [groupId, series] of windowSnapshotsByGroup) {
    const latest = series[series.length - 1]!;
    const { windowAcc, windowTimeline } = calibrateSeries(
      series,
      precomputedUsage,
      (rec) => usageMatchesWindow(rec.model, latest.usageModels),
      true
    );
    const windowEst = readAccumulatorEstimate(windowAcc);
    const windowRemainingUsd =
      windowEst.estimatedFullWindowUsd !== null ? windowEst.estimatedFullWindowUsd * latest.remaining : null;

    windows[groupId] = {
      estimatedFullWindowUsd: windowEst.estimatedFullWindowUsd,
      previousEstimatedFullWindowUsd: windowEst.previousEstimatedFullWindowUsd,
      estimatedRemainingUsd: windowRemainingUsd,
      modelCostContributions: readModelCostContributions(windowAcc),
    };

    models.push(
      buildQuotaModelValuation({
        modelId: "",
        groupId,
        series,
        seriesCutoffMs,
        timeline: windowTimeline,
        ...windowEst,
      })
    );
  }

  for (const [groupId, seriesByModel] of snapshotsByGroupAndModel) {
    for (const [modelId, series] of seriesByModel) {
      const { windowAcc, windowTimeline } = calibrateSeries(series, precomputedUsage, (rec) => rec.model === modelId);
      models.push(
        buildQuotaModelValuation({
          modelId,
          groupId,
          series,
          seriesCutoffMs,
          timeline: windowTimeline,
          ...readAccumulatorEstimate(windowAcc),
        })
      );
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
    events,
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
      modelCostContributions: [],
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
        estimatedFullWindowUsd: null,
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

  // Retention bounds the stored rows, so every remaining snapshot is in range.
  const [snapshots, events, livePricing] = await Promise.all([
    prisma.quotaSnapshot.findMany({
      where: { authIndex: { in: missing } },
      orderBy: { capturedAt: "asc" },
      select: {
        authIndex: true,
        provider: true,
        groupId: true,
        modelId: true,
        remaining: true,
        resetTime: true,
        usageModels: true,
        capturedAt: true,
      },
    }),
    prisma.quotaResetEvent.findMany({
      where: { authIndex: { in: missing } },
      orderBy: { at: "asc" },
      select: { authIndex: true, kind: true, at: true },
    }),
    getLiveModelPricing(),
  ]);

  const snapsByAccount = new Map<string, SnapshotRow[]>();
  for (const snap of snapshots) {
    const list = snapsByAccount.get(snap.authIndex) ?? [];
    list.push(snap);
    snapsByAccount.set(snap.authIndex, list);
  }

  const usageRecords = snapshots.length === 0 ? [] : await
    prisma.usageRecord.findMany({
      where: {
        OR: Array.from(snapsByAccount, ([authIndex, series]) => ({
          authIndex,
          timestamp: { gt: series[0]!.capturedAt, lte: series[series.length - 1]!.capturedAt },
        })),
        failed: false,
        totalTokens: { gt: 0 },
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
    });

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
      events.filter((event) => event.authIndex === id).map((event) => ({ kind: event.kind, at: event.at.toISOString() })),
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
  return histories[authIndex] ?? { authIndex, models: [], windows: {}, events: [], hasAnySnapshots: false };
}

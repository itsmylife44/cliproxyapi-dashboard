import { capacityQuotaGroups, isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import { headlineQuotaWindows } from "@/lib/quota/headline";
import {
  isModelFirstAccount,
  isModelFirstProviderQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstProvider,
  type ModelFirstProviderSummary,
  type QuotaAccount,
  type QuotaGroup,
  type QuotaGroupScope,
  type QuotaMonitorMode,
} from "@/lib/model-first-monitoring";

export interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  averageCapacity?: number;
  accountCount?: number;
  resetTime: string | null;
  isShortTerm: boolean;
  /** Present when the pooled windows belong to a scoped (secondary) limit. */
  scope?: QuotaGroupScope;
}

export interface ProviderSummary {
  provider: string;
  monitorMode: QuotaMonitorMode;
  totalAccounts: number;
  healthyAccounts: number;
  errorAccounts: number;
  windowCapacities: WindowCapacity[];
  modelFirstSummary?: ModelFirstProviderSummary;
}

// Codex reuses position ids across plans (`primary-window` is 5h on Plus, weekly on Pro),
// so windows with a known duration pool by that duration instead of by id. Scoped limits
// (e.g. Codex per-model or code review) pool within their own scope so they never merge
// into the main limit's bars.
function poolKey(group: QuotaGroup): string {
  const windowKey = group.windowSeconds ? `${group.windowSeconds}s` : group.id;
  return group.scope ? `${group.scope.id}:${windowKey}` : windowKey;
}

export function calcProviderSummary(accounts: QuotaAccount[]): ProviderSummary {
  const totalAccounts = accounts.length;
  const healthy = accounts
    .filter((account) => account.supported && !account.error && account.groups && account.groups.length > 0)
    .map((account) => ({ ...account, groups: capacityQuotaGroups(account.provider, account.groups ?? []) }));
  const errorAccounts = totalAccounts - healthy.length;
  const modelFirst = healthy.length > 0 && healthy.every((account) => isModelFirstAccount(account));

  if (modelFirst) {
    return {
      provider: accounts[0]?.provider ?? "unknown",
      monitorMode: "model-first",
      totalAccounts,
      healthyAccounts: healthy.length,
      errorAccounts,
      windowCapacities: [],
      modelFirstSummary: summarizeModelFirstProvider(healthy),
    };
  }

  const pools = new Map<string, { entries: Array<{ group: QuotaGroup; siblings: QuotaGroup[] }>; first: QuotaGroup; firstSiblings: QuotaGroup[] }>();
  for (const account of healthy) {
    for (const group of account.groups) {
      if (group.id === "extra-usage") continue;
      const key = poolKey(group);
      const pool = pools.get(key);
      if (pool) pool.entries.push({ group, siblings: account.groups });
      else pools.set(key, { entries: [{ group, siblings: account.groups }], first: group, firstSiblings: account.groups });
    }
  }

  const windowCapacities: WindowCapacity[] = [];

  for (const [poolKey, { entries, first, firstSiblings }] of pools) {
    const isShortTerm = isShortTermQuotaWindow(first, firstSiblings);
    const scored = entries
      .map(({ group }) => {
        const score = normalizeFraction(group.remainingFraction);
        return score === null ? null : { score, group };
      })
      .filter((item): item is { score: number; group: QuotaGroup } => item !== null);

    if (scored.length === 0) {
      continue;
    }
    const scores = scored.map((item) => item.score);
    const exhaustedProduct = scores.reduce((product, score) => product * (1 - score), 1);
    const capacity = 1 - exhaustedProduct;

    let earliestReset: string | null = null;
    let minResetTime = Infinity;

    for (const { group } of scored) {
      if (group.resetTime) {
        const timestamp = new Date(group.resetTime).getTime();
        if (timestamp < minResetTime) {
          minResetTime = timestamp;
          earliestReset = group.resetTime;
        }
      }
    }

    windowCapacities.push({
      id: poolKey,
      label: first.label,
      capacity: Math.max(0, Math.min(1, capacity)),
      averageCapacity: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      accountCount: scores.length,
      resetTime: earliestReset,
      isShortTerm,
      ...(first.scope ? { scope: first.scope } : {}),
    });
  }

  windowCapacities.sort((left, right) => {
    if (left.isShortTerm !== right.isShortTerm) return left.isShortTerm ? 1 : -1;
    return left.label.localeCompare(right.label);
  });

  return {
    provider: accounts[0]?.provider ?? "unknown",
    monitorMode: "window-based",
    totalAccounts,
    healthyAccounts: healthy.length,
    errorAccounts,
    windowCapacities,
  };
}

/** Average remaining capacity fraction (0..1) across accounts for each headline term. */
export function getWindowTermFractions(windowCapacities: readonly WindowCapacity[]): {
  longTerm: number | null;
  shortTerm: number | null;
} {
  const windows = headlineQuotaWindows(windowCapacities);
  const average = (isShortTerm: boolean) => {
    const matching = windows.filter((window) => window.isShortTerm === isShortTerm);
    const count = matching.reduce((sum, window) => sum + (window.accountCount ?? 1), 0);
    return count > 0
      ? matching.reduce((sum, window) => sum + (window.averageCapacity ?? window.capacity) * (window.accountCount ?? 1), 0) / count
      : null;
  };
  return { longTerm: average(false), shortTerm: average(true) };
}

/**
 * Healthy-account-weighted average remaining capacity across all comparable providers
 * (including model-first providers with verified quota), without pre-rounding.
 */
export function calcOverallTermCapacities(summaries: readonly ProviderSummary[]): {
  overall: number | null;
  longTerm: number | null;
  shortTerm: number | null;
} {
  let overallWeighted = 0;
  let overallAccounts = 0;
  let longWeighted = 0;
  let longAccounts = 0;
  let shortWeighted = 0;
  let shortAccounts = 0;

  for (const summary of summaries) {
    if (summary.healthyAccounts === 0) continue;

    if (summary.monitorMode === "model-first" && summary.modelFirstSummary) {
      if (isModelFirstProviderQuotaUnverified(summary.modelFirstSummary)) continue;
      const fraction =
        summary.modelFirstSummary.avgRemainingFraction ??
        summary.modelFirstSummary.minRemainingFraction ??
        null;
      if (fraction === null || !Number.isFinite(fraction)) continue;
      overallWeighted += fraction * summary.healthyAccounts;
      overallAccounts += summary.healthyAccounts;
      longWeighted += fraction * summary.healthyAccounts;
      longAccounts += summary.healthyAccounts;
      continue;
    }

    const { longTerm, shortTerm } = getWindowTermFractions(summary.windowCapacities);
    if (longTerm !== null && Number.isFinite(longTerm)) {
      longWeighted += longTerm * summary.healthyAccounts;
      longAccounts += summary.healthyAccounts;
    }
    if (shortTerm !== null && Number.isFinite(shortTerm)) {
      shortWeighted += shortTerm * summary.healthyAccounts;
      shortAccounts += summary.healthyAccounts;
    }

    const overallFraction = longTerm ?? shortTerm;
    if (overallFraction !== null && Number.isFinite(overallFraction)) {
      overallWeighted += overallFraction * summary.healthyAccounts;
      overallAccounts += summary.healthyAccounts;
    }
  }

  return {
    overall: overallAccounts > 0 ? overallWeighted / overallAccounts : null,
    longTerm: longAccounts > 0 ? longWeighted / longAccounts : null,
    shortTerm: shortAccounts > 0 ? shortWeighted / shortAccounts : null,
  };
}

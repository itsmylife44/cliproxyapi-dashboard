import { capacityQuotaGroups, isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import {
  isModelFirstAccount,
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
      .map(({ group, siblings }) => {
        const score = normalizeFraction(group.remainingFraction);
        if (score === null) return null;
        if (!isShortTerm) return { score, effective: score, group };

        const longSiblings = siblings.filter((s) => s.id !== "extra-usage" && !isShortTermQuotaWindow(s, siblings));
        const familyLongs = group.scope
          ? longSiblings.filter((s) => s.scope?.id === group.scope?.id)
          : group.id.endsWith("-5h")
            ? longSiblings.filter((s) => s.id === `${group.id.slice(0, -3)}-weekly`)
            : longSiblings.filter((s) => !s.scope);
        const capScores = familyLongs
          .map((s) => normalizeFraction(s.remainingFraction))
          .filter((v): v is number => v !== null);
        const effective = capScores.length > 0 ? Math.min(score, ...capScores) : score;
        return { score, effective, group };
      })
      .filter((item): item is { score: number; effective: number; group: QuotaGroup } => item !== null);

    if (scored.length === 0) {
      continue;
    }
    const scores = scored.map((item) => item.score);
    const effectiveScores = scored.map((item) => item.effective);
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
      averageCapacity: effectiveScores.reduce((sum, score) => sum + score, 0) / effectiveScores.length,
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

import { capacityQuotaGroups, isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import {
  isModelFirstAccount,
  normalizeFraction,
  summarizeModelFirstProvider,
  type ModelFirstProviderSummary,
  type QuotaAccount,
  type QuotaGroup,
  type QuotaMonitorMode,
} from "@/lib/model-first-monitoring";

export interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  resetTime: string | null;
  isShortTerm: boolean;
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

const POSITIONAL_WINDOW_SUFFIX = /(?:^|-)(?:primary|secondary)-window$/;

// Codex reuses position ids across plans (`primary-window` is 5h on Plus, weekly on Pro),
// so windows with a known duration pool by that duration instead of by id. Scoped Codex
// limits (`<scope>-primary-window`, e.g. per-model or code review) pool by scope + duration
// so they never merge into the main limit's bars.
function poolKey(group: QuotaGroup): string {
  if (!group.windowSeconds) return group.id;
  const scope = group.id.replace(POSITIONAL_WINDOW_SUFFIX, "");
  return scope && scope !== group.id ? `${scope}:${group.windowSeconds}s` : `${group.windowSeconds}s`;
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

  const pools = new Map<string, { groups: QuotaGroup[]; first: QuotaGroup; firstSiblings: QuotaGroup[] }>();
  for (const account of healthy) {
    for (const group of account.groups) {
      if (group.id === "extra-usage") continue;
      const key = poolKey(group);
      const pool = pools.get(key);
      if (pool) pool.groups.push(group);
      else pools.set(key, { groups: [group], first: group, firstSiblings: account.groups });
    }
  }

  const windowCapacities: WindowCapacity[] = [];

  for (const [poolKey, { groups, first, firstSiblings }] of pools) {
    const scores = groups
      .map((group) => normalizeFraction(group.remainingFraction))
      .filter((score): score is number => score !== null);

    if (scores.length === 0) {
      continue;
    }

    const exhaustedProduct = scores.reduce((product, score) => product * (1 - score), 1);
    const capacity = 1 - exhaustedProduct;

    let earliestReset: string | null = null;
    let minResetTime = Infinity;

    for (const group of groups) {
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
      resetTime: earliestReset,
      isShortTerm: isShortTermQuotaWindow(first, firstSiblings),
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

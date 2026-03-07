import type { QuotaGroup, QuotaAccount, WindowCapacity, ProviderSummary } from "./quota-types";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

const CAPACITY_HIGH_THRESHOLD = 0.6;
const CAPACITY_LOW_THRESHOLD = 0.2;

export function normalizeFraction(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function maskEmail(email: unknown): string {
  if (typeof email !== "string") return "unknown";
  const trimmed = email.trim();
  if (trimmed === "") return "unknown";

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const VISIBLE_CHARS = 3;
  const maskedLocal = local.length <= VISIBLE_CHARS ? `${local}***` : `${local.slice(0, VISIBLE_CHARS)}***`;
  return `${maskedLocal}@${domain}`;
}

export function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Unknown";

  try {
    const resetDate = new Date(isoDate);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();

    if (diffMs <= 0) return "Resetting...";

    const days = Math.floor(diffMs / MS_PER_DAY);
    const hours = Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR);
    const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE);

    if (days > 0) return `Resets in ${days}d ${hours}h`;
    if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
    return `Resets in ${minutes}m`;
  } catch {
    return "Unknown";
  }
}

export function isShortTermGroup(group: QuotaGroup): boolean {
  const id = group.id.toLowerCase();
  const label = group.label.toLowerCase();
  return (
    id.includes("five-hour") ||
    id.includes("primary") ||
    id.includes("request") ||
    id.includes("token") ||
    label.includes("5h") ||
    label.includes("5m") ||
    label.includes("request") ||
    label.includes("token")
  );
}

export function calcAccountWindowScores(groups: QuotaGroup[]): Record<string, { score: number; label: string; isShortTerm: boolean }> {
  const result: Record<string, { score: number; label: string; isShortTerm: boolean }> = {};
  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    result[group.id] = { score, label: group.label, isShortTerm: isShortTermGroup(group) };
  }
  return result;
}

export function calcProviderSummary(accounts: QuotaAccount[]): ProviderSummary {
  const totalAccounts = accounts.length;
  const healthy = accounts.filter(
    (a) => a.supported && !a.error && a.groups && a.groups.length > 0
  );
  const errorAccounts = totalAccounts - healthy.length;

  const allWindowIds = new Set<string>();
  for (const a of healthy) {
    for (const g of a.groups ?? []) {
      if (g.id !== "extra-usage") allWindowIds.add(g.id);
    }
  }

  const windowCapacities: WindowCapacity[] = [];

  for (const windowId of allWindowIds) {
    const relevantAccounts = healthy.filter((a) =>
      a.groups?.some((g) => g.id === windowId)
    );
    if (relevantAccounts.length === 0) continue;

    const scores = relevantAccounts
      .map((a) => {
        const group = a.groups?.find((g) => g.id === windowId);
        return normalizeFraction(group?.remainingFraction);
      })
      .filter((score): score is number => score !== null);

    if (scores.length === 0) continue;

    const exhaustedProduct = scores.reduce((prod, score) => prod * (1 - score), 1);
    const capacity = 1 - exhaustedProduct;

    let earliestReset: string | null = null;
    let minResetTime = Infinity;
    let label = "";
    let shortTerm = false;

    for (const a of relevantAccounts) {
      const g = a.groups?.find((g) => g.id === windowId);
      if (g) {
        if (!label) {
          label = g.label;
          shortTerm = isShortTermGroup(g);
        }
        if (g.resetTime) {
          const t = new Date(g.resetTime).getTime();
          if (t < minResetTime) {
            minResetTime = t;
            earliestReset = g.resetTime;
          }
        }
      }
    }

    windowCapacities.push({
      id: windowId,
      label,
      capacity: Math.max(0, Math.min(1, capacity)),
      resetTime: earliestReset,
      isShortTerm: shortTerm,
    });
  }

  windowCapacities.sort((a, b) => {
    if (a.isShortTerm !== b.isShortTerm) return a.isShortTerm ? 1 : -1;
    return a.label.localeCompare(b.label);
  });

  return {
    provider: accounts[0]?.provider ?? "unknown",
    totalAccounts,
    healthyAccounts: healthy.length,
    errorAccounts,
    windowCapacities,
  };
}

export function calcOverallCapacity(summaries: ProviderSummary[]): { value: number; label: string; provider: string } {
  if (summaries.length === 0) return { value: 0, label: "No Data", provider: "" };

  let weightedCapacity = 0;
  let weightedAccounts = 0;

  for (const summary of summaries) {
    if (summary.healthyAccounts === 0) continue;

    const longTerm = summary.windowCapacities.filter((w) => !w.isShortTerm);
    const shortTerm = summary.windowCapacities.filter((w) => w.isShortTerm);
    const relevantWindows = longTerm.length > 0 ? longTerm : shortTerm;

    if (relevantWindows.length === 0) continue;

    const providerCapacity = Math.min(...relevantWindows.map((w) => w.capacity));
    weightedCapacity += providerCapacity * summary.healthyAccounts;
    weightedAccounts += summary.healthyAccounts;
  }

  if (weightedAccounts === 0) return { value: 0, label: "No Data", provider: "" };

  return {
    value: weightedCapacity / weightedAccounts,
    label: "Weighted capacity",
    provider: "all",
  };
}

export function getCapacityBarClass(value: number): string {
  if (value > CAPACITY_HIGH_THRESHOLD) return "bg-emerald-500/80";
  if (value > CAPACITY_LOW_THRESHOLD) return "bg-amber-500/80";
  return "bg-rose-500/80";
}

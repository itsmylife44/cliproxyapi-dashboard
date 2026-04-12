const HOUR_MS = 60 * 60 * 1000;
const SHORT_TERM_CLUSTER_WINDOW_MS = 6 * HOUR_MS;
const SHORT_TERM_CLUSTER_MIN_SPREAD_MS = 12 * HOUR_MS;
const SHORT_TERM_RESET_FALLBACK_MS = 24 * HOUR_MS;

export interface QuotaWindowLike {
  id: string;
  label: string;
  resetTime: string | null;
}

function hasExplicitShortTermMarker(group: QuotaWindowLike): boolean {
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

function parseResetTime(resetTime: string | null): number | null {
  if (!resetTime) return null;

  const timestamp = new Date(resetTime).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isShortTermQuotaWindow(
  group: QuotaWindowLike,
  siblingGroups: readonly QuotaWindowLike[] = []
): boolean {
  if (hasExplicitShortTermMarker(group)) {
    return true;
  }

  const groupReset = parseResetTime(group.resetTime);
  if (groupReset === null) {
    return false;
  }

  const siblingResets = siblingGroups
    .map((candidate) => parseResetTime(candidate.resetTime))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  if (siblingResets.length >= 2) {
    const earliestReset = siblingResets[0] ?? 0;
    const latestReset = siblingResets[siblingResets.length - 1] ?? 0;
    const hasDistinctClusters = latestReset - earliestReset >= SHORT_TERM_CLUSTER_MIN_SPREAD_MS;

    if (hasDistinctClusters) {
      // Antigravity exposes grouped model quotas without explicit window names.
      // When there are distinct reset clusters, the earlier cluster behaves like
      // the short-term window and the later cluster behaves like the long-term one.
      // Do NOT fall through to time-based fallback when clusters are distinct.
      return groupReset - earliestReset <= SHORT_TERM_CLUSTER_WINDOW_MS;
    }
  }

  // Time-based fallback for providers without distinct clusters (e.g., single window)
  return groupReset - Date.now() <= SHORT_TERM_RESET_FALLBACK_MS;
}

export const ANTIGRAVITY_QUOTA_ENDPOINTS = [
  "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels",
  "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
  "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
] as const;

export const MODEL_FIRST_SNAPSHOT_STALE_MS = 180_000;

export type QuotaMonitorMode = "window-based" | "model-first";

export interface QuotaModel {
  id: string;
  displayName: string;
  remainingFraction?: number | null;
  resetTime: string | null;
}

export interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction?: number | null;
  resetTime: string | null;
  models: QuotaModel[];
  monitorMode?: QuotaMonitorMode;
  readyModelCount?: number;
  depletedModelCount?: number;
  totalModelCount?: number;
  effectiveReadyModelCount?: number;
  minRemainingFraction?: number | null;
  p50RemainingFraction?: number | null;
  nextWindowResetAt?: string | null;
  fullWindowResetAt?: string | null;
  nextRecoveryAt?: string | null;
  fullRecoveryAt?: string | null;
  bottleneckModel?: string | null;
  hasMixedResetTimes?: boolean;
}

export interface QuotaAccount {
  auth_index: string;
  provider: string;
  email?: string | null;
  supported: boolean;
  error?: string;
  groups?: QuotaGroup[];
  raw?: unknown;
  monitorMode?: QuotaMonitorMode;
  snapshotFetchedAt?: string | null;
  snapshotSource?: string | null;
  snapshotStale?: boolean;
}

export interface QuotaResponse {
  accounts: QuotaAccount[];
  generatedAt?: string;
}

export interface ModelFirstGroupSummary {
  id: string;
  label: string;
  totalAccounts: number;
  readyAccounts: number;
  staleAccounts: number;
  minRemainingFraction: number | null;
  p50RemainingFraction: number | null;
  nextWindowResetAt: string | null;
  fullWindowResetAt: string | null;
  nextRecoveryAt: string | null;
  fullRecoveryAt: string | null;
  bottleneckModel: string | null;
}

export interface ModelFirstAccountSummary {
  totalGroups: number;
  readyGroups: number;
  staleSnapshot: boolean;
  minRemainingFraction: number | null;
  p50RemainingFraction: number | null;
  nextWindowResetAt: string | null;
  fullWindowResetAt: string | null;
  nextRecoveryAt: string | null;
}

export interface ModelFirstProviderSummary {
  totalAccounts: number;
  readyAccounts: number;
  staleAccounts: number;
  minRemainingFraction: number | null;
  p50RemainingFraction: number | null;
  nextWindowResetAt: string | null;
  fullWindowResetAt: string | null;
  nextRecoveryAt: string | null;
  groups: ModelFirstGroupSummary[];
}

function isFullFraction(value: number | null | undefined): boolean {
  return normalizeFraction(value) === 1;
}

export function normalizeFraction(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function isModelFirstProvider(provider: string | undefined | null): boolean {
  if (typeof provider !== "string") return false;
  const normalized = provider.trim().toLowerCase();
  return normalized === "antigravity" || normalized === "gemini-cli" || normalized === "gemini";
}

export function isModelFirstAccount(account: Pick<QuotaAccount, "provider" | "monitorMode">): boolean {
  return account.monitorMode === "model-first" || isModelFirstProvider(account.provider);
}

export function isStaleSnapshot(
  snapshotFetchedAt: string | null | undefined,
  nowMs = Date.now(),
  staleAfterMs = MODEL_FIRST_SNAPSHOT_STALE_MS
): boolean {
  if (!snapshotFetchedAt) return true;
  const fetchedAtMs = Date.parse(snapshotFetchedAt);
  if (!Number.isFinite(fetchedAtMs)) return true;
  return nowMs - fetchedAtMs > staleAfterMs;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid] ?? null;
}

function parseReset(resetTime: string | null | undefined): number | null {
  if (!resetTime) return null;
  const parsed = Date.parse(resetTime);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickIso(timestamps: number[], pick: "min" | "max"): string | null {
  if (timestamps.length === 0) return null;
  const value = pick === "min" ? Math.min(...timestamps) : Math.max(...timestamps);
  return new Date(value).toISOString();
}

function getModelDisplayName(model: QuotaModel): string {
  return model.displayName?.trim() || model.id;
}

export function enrichModelFirstGroup(group: QuotaGroup): QuotaGroup {
  const modelFractions = group.models
    .map((model) => normalizeFraction(model.remainingFraction))
    .filter((value): value is number => value !== null);
  const readyModelCount = modelFractions.filter((value) => value > 0).length;
  const depletedModelCount = modelFractions.filter((value) => value <= 0).length;
  const allResetTimes = group.models
    .map((model) => parseReset(model.resetTime))
    .filter((value): value is number => value !== null);
  const depletedResetTimes = group.models
    .filter((model) => {
      const remaining = normalizeFraction(model.remainingFraction);
      return remaining !== null && remaining <= 0;
    })
    .map((model) => parseReset(model.resetTime))
    .filter((value): value is number => value !== null);

  const minRemainingFraction = modelFractions.length > 0 ? Math.min(...modelFractions) : null;
  const p50RemainingFraction = median(modelFractions);
  const nextWindowResetAt = pickIso(allResetTimes, "min");
  const fullWindowResetAt = pickIso(allResetTimes, "max");
  const nextRecoveryAt = pickIso(depletedResetTimes, "min");
  const fullRecoveryAt = pickIso(depletedResetTimes, "max");

  const bottleneck = [...group.models]
    .sort((left, right) => {
      const remainingLeft = normalizeFraction(left.remainingFraction) ?? Number.POSITIVE_INFINITY;
      const remainingRight = normalizeFraction(right.remainingFraction) ?? Number.POSITIVE_INFINITY;
      if (remainingLeft !== remainingRight) return remainingLeft - remainingRight;

      const resetLeft = parseReset(left.resetTime) ?? Number.POSITIVE_INFINITY;
      const resetRight = parseReset(right.resetTime) ?? Number.POSITIVE_INFINITY;
      if (resetLeft !== resetRight) return resetLeft - resetRight;

      return getModelDisplayName(left).localeCompare(getModelDisplayName(right));
    })
    .at(0);

  const hasMixedResetTimes =
    allResetTimes.length > 1 && Math.max(...allResetTimes) - Math.min(...allResetTimes) >= 30 * 60 * 1000;

  return {
    ...group,
    monitorMode: "model-first",
    remainingFraction: minRemainingFraction,
    resetTime: nextWindowResetAt,
    readyModelCount,
    depletedModelCount,
    totalModelCount: group.models.length,
    effectiveReadyModelCount: readyModelCount,
    minRemainingFraction,
    p50RemainingFraction,
    nextWindowResetAt,
    fullWindowResetAt,
    nextRecoveryAt,
    fullRecoveryAt,
    bottleneckModel: bottleneck ? getModelDisplayName(bottleneck) : null,
    hasMixedResetTimes,
  };
}

export function summarizeModelFirstAccount(account: QuotaAccount): ModelFirstAccountSummary {
  const groups = (account.groups ?? []).map((group) =>
    group.monitorMode === "model-first" ? group : enrichModelFirstGroup(group)
  );
  const minFractions = groups
    .map((group) => normalizeFraction(group.minRemainingFraction ?? group.remainingFraction))
    .filter((value): value is number => value !== null);
  const p50Fractions = groups
    .map((group) => normalizeFraction(group.p50RemainingFraction ?? group.remainingFraction))
    .filter((value): value is number => value !== null);
  const nextWindowResetTimes = groups
    .map((group) => parseReset(group.nextWindowResetAt ?? group.resetTime))
    .filter((value): value is number => value !== null);
  const fullWindowResetTimes = groups
    .map((group) => parseReset(group.fullWindowResetAt ?? group.resetTime))
    .filter((value): value is number => value !== null);
  const nextRecoveryTimes = groups
    .map((group) => parseReset(group.nextRecoveryAt))
    .filter((value): value is number => value !== null);

  return {
    totalGroups: groups.length,
    readyGroups: groups.filter((group) => (group.effectiveReadyModelCount ?? group.readyModelCount ?? 0) > 0).length,
    staleSnapshot: isStaleSnapshot(account.snapshotFetchedAt, Date.now()),
    minRemainingFraction: minFractions.length > 0 ? Math.min(...minFractions) : null,
    p50RemainingFraction: median(p50Fractions),
    nextWindowResetAt: pickIso(nextWindowResetTimes, "min"),
    fullWindowResetAt: pickIso(fullWindowResetTimes, "max"),
    nextRecoveryAt: pickIso(nextRecoveryTimes, "min"),
  };
}

export function isModelFirstAccountQuotaUnverified(
  account: QuotaAccount,
  summary = summarizeModelFirstAccount(account)
): boolean {
  if (!isModelFirstAccount(account) || summary.staleSnapshot) {
    return false;
  }

  return isFullFraction(summary.minRemainingFraction) && isFullFraction(summary.p50RemainingFraction);
}

export function summarizeModelFirstProvider(accounts: QuotaAccount[]): ModelFirstProviderSummary {
  const modelFirstAccounts = accounts.filter((account) => isModelFirstAccount(account));
  const groupMap = new Map<string, Array<{ account: QuotaAccount; group: QuotaGroup }>>();

  for (const account of modelFirstAccounts) {
    for (const group of account.groups ?? []) {
      const enriched = group.monitorMode === "model-first" ? group : enrichModelFirstGroup(group);
      const bucket = groupMap.get(enriched.id) ?? [];
      bucket.push({ account, group: enriched });
      groupMap.set(enriched.id, bucket);
    }
  }

  const groupSummaries = Array.from(groupMap.values()).map((entries) => {
    const [firstEntry] = entries;
    const fractions = entries.flatMap(({ group }) =>
      group.models
        .map((model) => normalizeFraction(model.remainingFraction))
        .filter((value): value is number => value !== null)
    );
    const resets = entries.flatMap(({ group }) =>
      group.models
        .map((model) => parseReset(model.resetTime))
        .filter((value): value is number => value !== null)
    );
    const depletedResets = entries.flatMap(({ group }) =>
      group.models
        .filter((model) => {
          const remaining = normalizeFraction(model.remainingFraction);
          return remaining !== null && remaining <= 0;
        })
        .map((model) => parseReset(model.resetTime))
        .filter((value): value is number => value !== null)
    );

    return {
      id: firstEntry?.group.id ?? "unknown",
      label: firstEntry?.group.label ?? "Unknown",
      totalAccounts: entries.length,
      readyAccounts: entries.filter(({ group }) => (group.effectiveReadyModelCount ?? group.readyModelCount ?? 0) > 0).length,
      staleAccounts: entries.filter(({ account }) => isStaleSnapshot(account.snapshotFetchedAt, Date.now())).length,
      minRemainingFraction: fractions.length > 0 ? Math.min(...fractions) : null,
      p50RemainingFraction: median(fractions),
      nextWindowResetAt: pickIso(resets, "min"),
      fullWindowResetAt: pickIso(resets, "max"),
      nextRecoveryAt: pickIso(depletedResets, "min"),
      fullRecoveryAt: pickIso(depletedResets, "max"),
      bottleneckModel: firstEntry?.group.bottleneckModel ?? null,
    };
  });

  groupSummaries.sort((left, right) => left.label.localeCompare(right.label));

  const accountSummaries = modelFirstAccounts.map((account) => summarizeModelFirstAccount(account));
  const nextWindowResetTimes = accountSummaries
    .map((summary) => parseReset(summary.nextWindowResetAt))
    .filter((value): value is number => value !== null);
  const fullWindowResetTimes = accountSummaries
    .map((summary) => parseReset(summary.fullWindowResetAt))
    .filter((value): value is number => value !== null);
  const nextRecoveryTimes = accountSummaries
    .map((summary) => parseReset(summary.nextRecoveryAt))
    .filter((value): value is number => value !== null);
  const groupFractions = groupSummaries
    .flatMap((summary) => [summary.minRemainingFraction, summary.p50RemainingFraction])
    .filter((value): value is number => value !== null);

  return {
    totalAccounts: modelFirstAccounts.length,
    readyAccounts: accountSummaries.filter((summary) => !summary.staleSnapshot && summary.readyGroups > 0).length,
    staleAccounts: accountSummaries.filter((summary) => summary.staleSnapshot).length,
    minRemainingFraction: groupFractions.length > 0 ? Math.min(...groupFractions) : null,
    p50RemainingFraction: median(
      groupSummaries
        .map((summary) => summary.p50RemainingFraction)
        .filter((value): value is number => value !== null)
    ),
    nextWindowResetAt: pickIso(nextWindowResetTimes, "min"),
    fullWindowResetAt: pickIso(fullWindowResetTimes, "max"),
    nextRecoveryAt: pickIso(nextRecoveryTimes, "min"),
    groups: groupSummaries,
  };
}

export function isModelFirstProviderQuotaUnverified(
  summary: ModelFirstProviderSummary | null | undefined
): boolean {
  if (!summary || summary.totalAccounts === 0) {
    return false;
  }

  return isFullFraction(summary.minRemainingFraction) && isFullFraction(summary.p50RemainingFraction);
}

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeFraction, type QuotaAccount } from "@/lib/model-first-monitoring";

export const SNAPSHOT_HEARTBEAT_MS = 15 * 60 * 1000;
export const SNAPSHOT_DELTA_THRESHOLD = 0.005;
export const RESET_TIME_TOLERANCE_MS = 60_000;
export const QUOTA_SNAPSHOT_RETENTION_DAYS = 30;
export const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const RECENT_LOOKUP_WINDOW_MS = 24 * 60 * 60 * 1000;

let lastPrunedAtMs: number | null = null;

interface SnapshotCandidate {
  authIndex: string;
  provider: string;
  groupId: string;
  modelId: string;
  remaining: number;
  resetTime: Date | null;
}

function parseResetDate(resetTime: string | null | undefined): Date | null {
  if (!resetTime) return null;
  const ms = Date.parse(resetTime);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * Persist deduplicated quota snapshots for healthy accounts.
 * Writes when no recent snapshot exists, remaining changed by >= 0.5%,
 * resetTime shifted by > 60s, or 15m elapsed since the previous snapshot.
 */
export async function recordQuotaSnapshots(
  accounts: QuotaAccount[],
  now: Date = new Date()
): Promise<number> {
  const candidates: SnapshotCandidate[] = [];

  for (const account of accounts) {
    if (!account.supported || account.error || !account.groups?.length || !account.auth_index) {
      continue;
    }

    for (const group of account.groups) {
      if (group.id === "extra-usage") continue;
      const entries =
        group.models.length > 0
          ? group.models
          : [{ id: "", remainingFraction: group.remainingFraction, resetTime: group.resetTime }];

      for (const entry of entries) {
        const remaining = normalizeFraction(entry.remainingFraction);
        if (remaining === null) continue;
        candidates.push({
          authIndex: account.auth_index,
          provider: account.provider,
          groupId: group.id,
          modelId: entry.id,
          remaining,
          resetTime: parseResetDate(entry.resetTime),
        });
      }
    }
  }

  if (candidates.length === 0) return 0;

  const nowMs = now.getTime();
  const authIndices = Array.from(new Set(candidates.map((c) => c.authIndex)));
  const recentCutoff = new Date(nowMs - RECENT_LOOKUP_WINDOW_MS);

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

  const toInsert = candidates.filter((c) => {
    const prev = latestMap.get(`${c.authIndex}|${c.groupId}|${c.modelId}`);
    if (!prev) return true;
    if (nowMs - prev.capturedAt.getTime() >= SNAPSHOT_HEARTBEAT_MS) return true;
    if (Math.abs(prev.remaining - c.remaining) >= SNAPSHOT_DELTA_THRESHOLD) return true;
    const prevReset = prev.resetTime?.getTime() ?? 0;
    const nextReset = c.resetTime?.getTime() ?? 0;
    if (Math.abs(prevReset - nextReset) > RESET_TIME_TOLERANCE_MS) return true;
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
      capturedAt: now,
    })),
  });

  return created.count;
}

/**
 * Delete quota snapshots older than the retention window.
 */
export async function pruneOldQuotaSnapshots(
  retentionDays: number = QUOTA_SNAPSHOT_RETENTION_DAYS,
  now: Date = new Date()
): Promise<number> {
  const pruneBefore = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await prisma.quotaSnapshot.deleteMany({
    where: { capturedAt: { lt: pruneBefore } },
  });
  return deleted.count;
}

/**
 * Deterministically prune expired quota snapshots at most once per PRUNE_INTERVAL_MS.
 */
export async function pruneQuotaSnapshotsIfDue(
  now: Date = new Date(),
  retentionDays: number = QUOTA_SNAPSHOT_RETENTION_DAYS
): Promise<number> {
  const nowMs = now.getTime();
  if (lastPrunedAtMs !== null && nowMs - lastPrunedAtMs < PRUNE_INTERVAL_MS) {
    return 0;
  }

  try {
    const count = await pruneOldQuotaSnapshots(retentionDays, now);
    lastPrunedAtMs = nowMs;
    return count;
  } catch (err) {
    logger.warn({ err }, "Failed to prune old quota snapshots");
    return 0;
  }
}

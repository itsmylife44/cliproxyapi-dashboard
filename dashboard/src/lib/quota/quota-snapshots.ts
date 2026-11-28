import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeFraction, type QuotaAccount } from "@/lib/model-first-monitoring";

export const SNAPSHOT_HEARTBEAT_MS = 15 * 60 * 1000;
export const SNAPSHOT_DELTA_THRESHOLD = 0.005;
export const RESET_TIME_TOLERANCE_MS = 60_000;
export const COMPLETED_QUOTA_WINDOWS_FOR_ESTIMATES = 5;
/** Longest range the quota history chart can show. */
export const HISTORY_WINDOW_DAYS = 14;
export const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LOOKUP_WINDOW_MS = DAY_MS;

let lastPrunedAtMs: number | null = null;

interface SnapshotCandidate {
  authIndex: string;
  provider: string;
  groupId: string;
  modelId: string;
  remaining: number;
  resetTime: Date | null;
  windowSeconds: number | null;
  usageModels: string[];
}

export interface StoredSnapshot {
  remaining: number;
  resetTime: Date | null;
  capturedAt: Date;
}

/** Latest stored snapshot per `authIndex|groupId|modelId`, as it was before this pass wrote. */
export type PreviousSnapshots = Map<string, StoredSnapshot>;

export function snapshotKey(authIndex: string, groupId: string, modelId = ""): string {
  return `${authIndex}|${groupId}|${modelId}`;
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
 * Returns the latest rows stored before this write.
 */
export async function recordQuotaSnapshots(
  accounts: QuotaAccount[],
  now: Date = new Date()
): Promise<PreviousSnapshots> {
  const candidates: SnapshotCandidate[] = [];

  for (const account of accounts) {
    if (!account.supported || account.error || !account.groups?.length || !account.auth_index) {
      continue;
    }

    for (const group of account.groups) {
      const entries =
        group.models.length > 0
          ? group.models
          : [{ id: "", remainingFraction: group.remainingFraction, resetTime: group.resetTime }];
      const usageModels = group.usageModels ?? (group.scope ? [group.scope.id] : []);

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
          windowSeconds: group.windowSeconds ?? null,
          usageModels,
        });
      }
    }
  }

  const previous: PreviousSnapshots = new Map();
  if (candidates.length === 0) return previous;

  const nowMs = now.getTime();
  const existing = await prisma.quotaSnapshot.findMany({
    where: {
      authIndex: { in: Array.from(new Set(candidates.map((c) => c.authIndex))) },
      capturedAt: { gte: new Date(nowMs - RECENT_LOOKUP_WINDOW_MS) },
    },
    distinct: ["authIndex", "groupId", "modelId"],
    orderBy: { capturedAt: "desc" },
    select: { authIndex: true, groupId: true, modelId: true, remaining: true, resetTime: true, capturedAt: true },
  });

  for (const row of existing) {
    const key = snapshotKey(row.authIndex, row.groupId, row.modelId);
    if (!previous.has(key)) previous.set(key, row);
  }

  const toInsert = candidates.filter((c) => {
    const prev = previous.get(snapshotKey(c.authIndex, c.groupId, c.modelId));
    if (!prev) return true;
    if (nowMs - prev.capturedAt.getTime() >= SNAPSHOT_HEARTBEAT_MS) return true;
    if (Math.abs(prev.remaining - c.remaining) >= SNAPSHOT_DELTA_THRESHOLD) return true;
    const prevReset = prev.resetTime?.getTime() ?? 0;
    const nextReset = c.resetTime?.getTime() ?? 0;
    return Math.abs(prevReset - nextReset) > RESET_TIME_TOLERANCE_MS;
  });

  if (toInsert.length > 0) {
    await prisma.quotaSnapshot.createMany({
      data: toInsert.map((c) => ({ ...c, capturedAt: now })),
    });
  }

  return previous;
}

/**
 * Each snapshot is kept for the chart range or for the active window plus the
 * completed windows the estimate samples, whichever is longer. Reset/prime pins
 * older than an account's oldest snapshot have nothing left to sit on.
 */
export async function pruneOldQuotaSnapshots(now: Date = new Date()): Promise<number> {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "quota_snapshots"
    WHERE "capturedAt" < ${now}::timestamp - make_interval(secs => GREATEST(
      ${HISTORY_WINDOW_DAYS * DAY_MS / 1000}::double precision,
      ${COMPLETED_QUOTA_WINDOWS_FOR_ESTIMATES + 1} * COALESCE("windowSeconds", 0)
    ))`;
  await prisma.$executeRaw`
    DELETE FROM "quota_reset_events" e
    WHERE NOT EXISTS (
      SELECT 1 FROM "quota_snapshots" s WHERE s."authIndex" = e."authIndex" AND s."capturedAt" <= e."at"
    )`;
  return deleted;
}

/**
 * Deterministically prune expired quota snapshots at most once per PRUNE_INTERVAL_MS.
 */
export async function pruneQuotaSnapshotsIfDue(now: Date = new Date()): Promise<number> {
  const nowMs = now.getTime();
  if (lastPrunedAtMs !== null && nowMs - lastPrunedAtMs < PRUNE_INTERVAL_MS) {
    return 0;
  }

  try {
    const count = await pruneOldQuotaSnapshots(now);
    lastPrunedAtMs = nowMs;
    return count;
  } catch (err) {
    logger.warn({ err }, "Failed to prune old quota snapshots");
    return 0;
  }
}

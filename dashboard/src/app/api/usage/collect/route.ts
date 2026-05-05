import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { syncKeysToCliProxyApi } from "@/lib/api-keys/sync";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { randomUUID, timingSafeEqual } from "crypto";
import { Errors } from "@/lib/errors";

const CLIPROXYAPI_MANAGEMENT_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;
const COLLECTOR_API_KEY = process.env.COLLECTOR_API_KEY;

const BATCH_SIZE = 500;
const LATENCY_BACKFILL_BATCH_SIZE = 100;
const COLLECTOR_LEASE_STALE_MS = 15 * 60 * 1000;

// CLIProxyAPI v6.10+ replaced the aggregated `/usage` endpoint with a
// drain-on-read queue at `/usage-queue`. Each GET returns the events
// recorded since the previous read, then empties the queue server-side.
// The response is a flat array of QueueEntry objects.

function markCollectorError(runId: string, errorMessage: string): Promise<void> {
  return prisma.collectorState
    .upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        lastCollectedAt: new Date(),
        lastStatus: "error",
        recordsStored: 0,
        errorMessage,
      },
      update: {
        lastCollectedAt: new Date(),
        lastStatus: "error",
        recordsStored: 0,
        errorMessage,
      },
    })
    .then(() => {
      logger.warn({ runId, errorMessage }, "Collector state marked as error");
    })
    .catch((stateError) => {
      logger.error({ err: stateError, runId }, "Failed to mark collector error state");
    });
}

interface TokenDetails {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  total_tokens?: number;
}

interface UsageQueueEntry {
  timestamp: string;
  latency_ms?: number;
  source?: string;
  auth_index: string;
  tokens?: TokenDetails;
  failed?: boolean;
  provider?: string;
  model: string;
  alias?: string;
  endpoint?: string;
  auth_type?: string;
  api_key?: string;
  request_id?: string;
}

function isUsageQueueEntry(value: unknown): value is UsageQueueEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.timestamp === "string" &&
    typeof v.auth_index === "string" &&
    typeof v.model === "string"
  );
}

interface UsageRecordCandidate {
  authIndex: string;
  apiKeyId: string | null;
  userId: string | null;
  model: string;
  source: string;
  timestamp: Date;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  failed: boolean;
}

function usageDedupKey(candidate: Pick<UsageRecordCandidate, "authIndex" | "model" | "timestamp" | "source" | "totalTokens">): string {
  return [
    candidate.authIndex,
    candidate.model,
    candidate.timestamp.toISOString(),
    candidate.source,
    String(candidate.totalTokens),
  ].join("|");
}

function buildLatencyBackfillCandidates(candidates: UsageRecordCandidate[]): UsageRecordCandidate[] {
  const deduped = new Map<string, UsageRecordCandidate>();

  for (const candidate of candidates) {
    if (candidate.latencyMs <= 0) {
      continue;
    }
    const key = usageDedupKey(candidate);
    const existing = deduped.get(key);
    if (!existing || candidate.latencyMs > existing.latencyMs) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()];
}

async function tryAcquireCollectorLease(now: Date): Promise<boolean> {
  await prisma.collectorState.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      lastCollectedAt: now,
      lastStatus: "idle",
      recordsStored: 0,
      errorMessage: null,
    },
    update: {},
  });

  const staleBefore = new Date(now.getTime() - COLLECTOR_LEASE_STALE_MS);
  const claim = await prisma.collectorState.updateMany({
    where: {
      id: "singleton",
      OR: [
        { lastStatus: { not: "running" } },
        { updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      lastStatus: "running",
      errorMessage: null,
    },
  });

  return claim.count === 1;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isCronAuth = (() => {
    if (!COLLECTOR_API_KEY || !authHeader) return false;
    const expected = `Bearer ${COLLECTOR_API_KEY}`;
    if (authHeader.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
    } catch {
      return false;
    }
  })();

  if (!isCronAuth) {
    const session = await verifySession();
    if (!session) {
      return Errors.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return Errors.forbidden();
    }

    const originError = validateOrigin(request);
    if (originError) return originError;
  }

  if (!MANAGEMENT_API_KEY) {
    logger.error("MANAGEMENT_API_KEY is not configured");
    return Errors.internal("Server configuration error");
  }

  const runId = randomUUID();
  const startedAtMs = Date.now();
  const leaseAcquiredAt = new Date();

  try {
    const leaseAcquired = await tryAcquireCollectorLease(leaseAcquiredAt);
    if (!leaseAcquired) {
      logger.warn({ runId }, "Usage collection skipped: collector already running");
      return NextResponse.json({ success: false, message: "Collector already running", runId }, { status: 202 });
    }
  } catch (error) {
    logger.error({ err: error, runId }, "Failed to acquire collector lease");
    return Errors.internal("Failed to acquire collector lock");
  }

  try {
    let usageResponse: Response;
    let authFilesResponse: Response | null = null;
    try {
      [usageResponse, authFilesResponse] = await Promise.all([
        fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/usage-queue`, {
          method: "GET",
          headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
          signal: AbortSignal.timeout(30_000),
        }),
        fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/auth-files`, {
          method: "GET",
          headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
          signal: AbortSignal.timeout(30_000),
        }).catch(() => null),
      ]);
    } catch (fetchError) {
      logger.error({ err: fetchError }, "Failed to connect to CLIProxyAPI");
      await markCollectorError(runId, "Proxy service unavailable");
      return Errors.serviceUnavailable("Proxy service unavailable during usage collection");
    }

    interface AuthFileEntry {
      auth_index: string;
      file_name?: string;
      email?: string;
      provider?: string;
    }

    const authIndexToFile = new Map<string, { fileName: string; email: string }>();
    if (authFilesResponse?.ok) {
      try {
        const authFilesJson: unknown = await authFilesResponse.json();
        const entries: AuthFileEntry[] = Array.isArray(authFilesJson)
          ? authFilesJson
          : Array.isArray((authFilesJson as Record<string, unknown>)?.auth_files)
            ? (authFilesJson as Record<string, unknown>).auth_files as AuthFileEntry[]
            : Array.isArray((authFilesJson as Record<string, unknown>)?.files)
              ? (authFilesJson as Record<string, unknown>).files as AuthFileEntry[]
              : [];
        for (const entry of entries) {
          if (entry.auth_index) {
            authIndexToFile.set(entry.auth_index, {
              fileName: entry.file_name ?? "",
              email: entry.email ?? "",
            });
          }
        }
      } catch {
        logger.warn("Failed to parse auth-files response");
      }
    } else if (authFilesResponse) {
      await authFilesResponse.body?.cancel();
    }

    if (!usageResponse.ok) {
      await usageResponse.body?.cancel();
      logger.error(
        { status: usageResponse.status, statusText: usageResponse.statusText },
        "CLIProxyAPI usage-queue endpoint returned error"
      );
      await markCollectorError(runId, "Failed to fetch usage data");
      return Errors.badGateway("Failed to fetch usage data from CLIProxyAPI");
    }

    const responseJson: unknown = await usageResponse.json();

    // /usage-queue returns a flat array. Be defensive about wrapped shapes
    // that some intermediates may add (e.g. {queue: [...]} or {events: [...]}).
    const rawEntries: unknown =
      Array.isArray(responseJson)
        ? responseJson
        : typeof responseJson === "object" && responseJson !== null
          ? (responseJson as Record<string, unknown>).queue ??
            (responseJson as Record<string, unknown>).events ??
            (responseJson as Record<string, unknown>).usage ??
            null
          : null;

    if (!Array.isArray(rawEntries)) {
      logger.error(
        { response: JSON.stringify(responseJson).slice(0, 200) },
        "Unexpected usage-queue response format from CLIProxyAPI"
      );
      await markCollectorError(runId, "Invalid usage data format");
      return Errors.badGateway("Invalid usage data format from CLIProxyAPI");
    }

    const entries = rawEntries.filter(isUsageQueueEntry);

    const syncResult = await syncKeysToCliProxyApi();
    if (!syncResult.ok) {
      logger.warn({ error: syncResult.error }, "API key sync failed before collection, continuing anyway");
    }

    const [apiKeys, oauthOwnerships, users] = await Promise.all([
      prisma.userApiKey.findMany({
        select: { id: true, key: true, userId: true },
      }),
      prisma.providerOAuthOwnership.findMany({
        select: { accountName: true, accountEmail: true, userId: true },
      }),
      prisma.user.findMany({
        select: { id: true, username: true },
      }),
    ]);

    const sourceToUser = new Map<string, string>();
    for (const o of oauthOwnerships) {
      if (o.accountEmail) {
        sourceToUser.set(o.accountEmail.toLowerCase(), o.userId);
      }
      sourceToUser.set(o.accountName.toLowerCase(), o.userId);
    }
    for (const u of users) {
      sourceToUser.set(u.username.toLowerCase(), u.id);
    }

    const fullKeyMap = new Map<string, { apiKeyId: string; userId: string }>();
    for (const k of apiKeys) {
      fullKeyMap.set(k.key, { apiKeyId: k.id, userId: k.userId });
    }

    const keyMap = new Map<string, { apiKeyId: string; userId: string }>();
    for (const k of apiKeys) {
      const keyWithoutPrefix = k.key.startsWith("sk-") ? k.key.slice(3) : k.key;
      const prefix16 = keyWithoutPrefix.substring(0, 16);
      keyMap.set(prefix16, { apiKeyId: k.id, userId: k.userId });
    }

    const userToApiKey = new Map<string, string>();
    for (const k of apiKeys) {
      userToApiKey.set(k.userId, k.id);
    }

    const candidates: UsageRecordCandidate[] = [];

    for (const entry of entries) {
      const authIndex = entry.auth_index;
      if (!authIndex) continue;

      const tokens = entry.tokens ?? {};
      const source = entry.source ?? "";
      const model = entry.model;

      let resolvedUserId: string | null = null;
      let resolvedApiKeyId: string | null = null;

      // Resolution priority:
      // 1) full api_key included on the queue entry (new endpoint provides this directly)
      // 2) auth-files lookup by auth_index
      // 3) source email
      // 4) auth_index treated as a key prefix
      if (entry.api_key) {
        const keyInfo = fullKeyMap.get(entry.api_key);
        if (keyInfo) {
          resolvedUserId = keyInfo.userId;
          resolvedApiKeyId = keyInfo.apiKeyId;
        }
      }

      if (!resolvedUserId) {
        const authFile = authIndexToFile.get(authIndex);
        if (authFile) {
          const byFile = sourceToUser.get(authFile.fileName.toLowerCase());
          if (byFile) {
            resolvedUserId = byFile;
          } else if (authFile.email) {
            resolvedUserId = sourceToUser.get(authFile.email.toLowerCase()) ?? null;
          }
        }
      }

      if (!resolvedUserId && source) {
        resolvedUserId = sourceToUser.get(source.toLowerCase()) ?? null;
      }

      if (!resolvedUserId) {
        const keyInfo = keyMap.get(authIndex);
        if (keyInfo) {
          resolvedUserId = keyInfo.userId;
          resolvedApiKeyId = keyInfo.apiKeyId;
        }
      }

      if (resolvedUserId && !resolvedApiKeyId) {
        resolvedApiKeyId = userToApiKey.get(resolvedUserId) ?? null;
      }

      const ts = new Date(entry.timestamp);
      if (Number.isNaN(ts.getTime())) continue;

      candidates.push({
        authIndex,
        apiKeyId: resolvedApiKeyId,
        userId: resolvedUserId,
        model,
        source,
        timestamp: ts,
        latencyMs: Number.isFinite(Number(entry.latency_ms)) ? Math.max(0, Math.round(Number(entry.latency_ms))) : 0,
        inputTokens: tokens.input_tokens || 0,
        outputTokens: tokens.output_tokens || 0,
        reasoningTokens: tokens.reasoning_tokens || 0,
        cachedTokens: tokens.cached_tokens || 0,
        totalTokens: tokens.total_tokens || 0,
        failed: entry.failed || false,
      });
    }

    let totalStored = 0;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const result = await prisma.usageRecord.createMany({
        data: batch,
        skipDuplicates: true,
      });
      totalStored += result.count;
    }

    let latencyBackfilled = 0;
    const latencyBackfillCandidates = buildLatencyBackfillCandidates(candidates);
    for (let i = 0; i < latencyBackfillCandidates.length; i += LATENCY_BACKFILL_BATCH_SIZE) {
      const batch = latencyBackfillCandidates.slice(i, i + LATENCY_BACKFILL_BATCH_SIZE);
      const results = await prisma.$transaction(
        batch.map((candidate) =>
          prisma.usageRecord.updateMany({
            where: {
              authIndex: candidate.authIndex,
              model: candidate.model,
              timestamp: candidate.timestamp,
              source: candidate.source,
              totalTokens: candidate.totalTokens,
              latencyMs: 0,
            },
            data: {
              latencyMs: candidate.latencyMs,
            },
          })
        )
      );
      for (const result of results) {
        latencyBackfilled += result.count;
      }
    }

    const skipped = candidates.length - totalStored;
    const now = new Date();
    const durationMs = Date.now() - startedAtMs;

    await prisma.collectorState.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        lastCollectedAt: now,
        lastStatus: "success",
        recordsStored: totalStored,
        errorMessage: null,
      },
      update: {
        lastCollectedAt: now,
        lastStatus: "success",
        recordsStored: totalStored,
        errorMessage: null,
      },
    });

    logger.info(
      { runId, processed: candidates.length, stored: totalStored, skipped, latencyBackfilled, durationMs },
      "Usage collection completed"
    );

    return NextResponse.json({
      runId,
      processed: candidates.length,
      stored: totalStored,
      skipped,
      latencyBackfilled,
      durationMs,
      lastCollectedAt: now.toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAtMs;
    logger.error({ err: error, runId, durationMs }, "Usage collection failed");

    try {
      await prisma.collectorState.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          lastCollectedAt: new Date(),
          lastStatus: "error",
          recordsStored: 0,
          errorMessage: "Collection failed",
        },
        update: {
          lastCollectedAt: new Date(),
          lastStatus: "error",
          recordsStored: 0,
          errorMessage: "Collection failed",
        },
      });
    } catch {
      /* state update failed, continue */
    }

    return Errors.internal("Collection failed");
  }
}

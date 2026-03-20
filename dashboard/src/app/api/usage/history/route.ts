import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { usageCache } from "@/lib/cache";
import { Errors } from "@/lib/errors";

const USAGE_HISTORY_CACHE_TTL_MS = 15_000;
const USAGE_RECORD_LIMIT = 25_000;
const REQUEST_EVENT_LIMIT = 200;
const LATENCY_SERIES_LIMIT = 120;

interface KeyUsage {
  keyName: string;
  username?: string;
  userId?: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
  models: Record<string, {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

interface RequestEvent {
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  failed: boolean;
}

interface LatencyPoint {
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  latencyMs: number;
  failed: boolean;
}

interface LatencySummary {
  sampleCount: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
}

function isValidDateParam(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function summarizeLatency(values: number[]): LatencySummary {
  if (values.length === 0) {
    return {
      sampleCount: 0,
      averageMs: 0,
      p95Ms: 0,
      maxMs: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));

  return {
    sampleCount: values.length,
    averageMs: Math.round(total / values.length),
    p95Ms: sorted[p95Index] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  const searchParams = request.nextUrl.searchParams;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return Errors.missingFields(["from", "to"]);
  }

  if (!isValidDateParam(fromParam) || !isValidDateParam(toParam)) {
    return Errors.validation("Invalid date format. Use YYYY-MM-DD.");
  }

  const fromDate = new Date(fromParam + "T00:00:00.000Z");
  const toDate = new Date(toParam + "T23:59:59.999Z");

  if (fromDate > toDate) {
    return Errors.validation("from date must be before to date");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true, username: true },
    });
    const isAdmin = user?.isAdmin ?? false;
    const cacheKey = `usage-history:v1:${session.userId}:${isAdmin ? "admin" : "user"}:${fromParam}:${toParam}`;
    const cached = usageCache.get(cacheKey) as { data: unknown; isAdmin: boolean } | null;
    if (cached) {
      logger.debug({ userId: session.userId, from: fromParam, to: toParam }, "Usage history cache hit");
      return NextResponse.json(cached);
    }

    let sourceFilter: string[] = [];
    if (!isAdmin) {
      const oauthOwnerships = await prisma.providerOAuthOwnership.findMany({
        where: { userId: session.userId },
        select: { accountName: true, accountEmail: true },
      });
      sourceFilter = [];
      if (user?.username) sourceFilter.push(user.username);
      for (const o of oauthOwnerships) {
        if (o.accountEmail) sourceFilter.push(o.accountEmail);
        sourceFilter.push(o.accountName);
      }
    }

    const whereClause = {
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
      // Only show usage from dashboard-generated API keys (not OAuth auth-files)
      apiKeyId: { not: null },
      ...(isAdmin
        ? {}
        : {
            OR: [
              { userId: session.userId },
              ...(sourceFilter.length > 0
                ? [{ source: { in: sourceFilter } }]
                : []),
            ],
          }),
    };

    const usageRecords = await prisma.usageRecord.findMany({
      where: whereClause,
      select: {
        apiKeyId: true,
        userId: true,
        authIndex: true,
        model: true,
        latencyMs: true,
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        cachedTokens: true,
        failed: true,
        timestamp: true,
        user: {
          select: {
            username: true,
          },
        },
        apiKey: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: USAGE_RECORD_LIMIT + 1,
    });

    const truncated = usageRecords.length > USAGE_RECORD_LIMIT;
    if (truncated) {
      usageRecords.pop();
    }

    const collectorState = await prisma.collectorState.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const keyUsageMap: Record<string, KeyUsage> = {};
    const dailyMap: Record<string, { requests: number; tokens: number; inputTokens: number; outputTokens: number; success: number; failure: number }> = {};
    const modelTotalsMap: Record<string, { requests: number; tokens: number }> = {};
    const requestEvents: RequestEvent[] = [];
    const latencySeriesSeed: LatencyPoint[] = [];
    const latencyValues: number[] = [];
    let totalRequests = 0;
    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    for (const record of usageRecords) {
      const groupKey = record.apiKeyId ?? record.userId ?? record.authIndex;

      if (!keyUsageMap[groupKey]) {
        const keyName = record.apiKey?.name
          ?? (record.user?.username ? record.user.username : `Key ${record.authIndex.slice(0, 6)}`);

        keyUsageMap[groupKey] = {
          keyName,
          ...(isAdmin && record.user?.username ? { username: record.user.username } : {}),
          ...(isAdmin && record.userId ? { userId: record.userId } : {}),
          totalRequests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cachedTokens: 0,
          successCount: 0,
          failureCount: 0,
          models: {},
        };
      }

      const keyUsage = keyUsageMap[groupKey];
      const username = record.user?.username;
      keyUsage.totalRequests += 1;
      keyUsage.totalTokens += record.totalTokens;
      keyUsage.inputTokens += record.inputTokens;
      keyUsage.outputTokens += record.outputTokens;
      keyUsage.reasoningTokens += record.reasoningTokens;
      keyUsage.cachedTokens += record.cachedTokens;

      if (record.failed) {
        keyUsage.failureCount += 1;
      } else {
        keyUsage.successCount += 1;
      }

      const modelName = record.model;
      if (!keyUsage.models[modelName]) {
        keyUsage.models[modelName] = {
          totalRequests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      keyUsage.models[modelName].totalRequests += 1;
      keyUsage.models[modelName].totalTokens += record.totalTokens;
      keyUsage.models[modelName].inputTokens += record.inputTokens;
      keyUsage.models[modelName].outputTokens += record.outputTokens;

      // Daily aggregation for charts
      const dayKey = record.timestamp.toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { requests: 0, tokens: 0, inputTokens: 0, outputTokens: 0, success: 0, failure: 0 };
      }
      dailyMap[dayKey].requests += 1;
      dailyMap[dayKey].tokens += record.totalTokens;
      dailyMap[dayKey].inputTokens += record.inputTokens;
      dailyMap[dayKey].outputTokens += record.outputTokens;
      if (record.failed) {
        dailyMap[dayKey].failure += 1;
      } else {
        dailyMap[dayKey].success += 1;
      }

      // Model totals aggregation for charts
      if (!modelTotalsMap[modelName]) {
        modelTotalsMap[modelName] = { requests: 0, tokens: 0 };
      }
      modelTotalsMap[modelName].requests += 1;
      modelTotalsMap[modelName].tokens += record.totalTokens;

      const event: RequestEvent = {
        timestamp: record.timestamp.toISOString(),
        keyName: keyUsage.keyName,
        ...(isAdmin && username ? { username } : {}),
        model: modelName,
        latencyMs: Math.max(0, record.latencyMs),
        totalTokens: record.totalTokens,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        failed: record.failed,
      };
      if (requestEvents.length < REQUEST_EVENT_LIMIT) {
        requestEvents.push(event);
      }
      if (event.latencyMs > 0) {
        latencyValues.push(event.latencyMs);
        if (latencySeriesSeed.length < LATENCY_SERIES_LIMIT) {
          latencySeriesSeed.push({
            timestamp: event.timestamp,
            keyName: event.keyName,
            ...(event.username ? { username: event.username } : {}),
            model: event.model,
            latencyMs: event.latencyMs,
            failed: event.failed,
          });
        }
      }

      totalRequests += 1;
      totalTokens += record.totalTokens;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      if (record.failed) {
        totalFailureCount += 1;
      } else {
        totalSuccessCount += 1;
      }
    }

    // Build sorted daily breakdown array
    const dailyBreakdown = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // Build sorted model breakdown array (top models first)
    const modelBreakdown = Object.entries(modelTotalsMap)
      .sort(([, a], [, b]) => b.requests - a.requests)
      .map(([model, data]) => ({ model, ...data }));
    const latencySummary = summarizeLatency(latencyValues);
    const latencySeries = [...latencySeriesSeed].reverse();

    const responseData = {
      data: {
        keys: keyUsageMap,
        totals: {
          totalRequests,
          totalTokens,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          successCount: totalSuccessCount,
          failureCount: totalFailureCount,
        },
        dailyBreakdown,
        modelBreakdown,
        requestEvents,
        latencySeries,
        latencySummary,
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        collectorStatus: {
          lastCollectedAt: collectorState?.lastCollectedAt?.toISOString() ?? "",
          lastStatus: collectorState?.lastStatus ?? "unknown",
        },
        truncated,
      },
      isAdmin,
    };

    usageCache.set(cacheKey, responseData, USAGE_HISTORY_CACHE_TTL_MS);
    logger.info(
      {
        userId: session.userId,
        isAdmin,
        from: fromParam,
        to: toParam,
        recordCount: usageRecords.length,
        truncated,
        durationMs: Date.now() - requestStartedAt,
      },
      "Usage history request completed"
    );

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error({ err: error, userId: session.userId, durationMs: Date.now() - requestStartedAt }, "Failed to fetch usage history");
    return Errors.internal("Failed to fetch usage history");
  }
}

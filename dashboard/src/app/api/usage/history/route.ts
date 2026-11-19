import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { usageCache } from "@/lib/cache";
import { Errors } from "@/lib/errors";
import { isLongContextPrompt, isPeakRequest, resolveModelPrice, splitCachedInput, type ModelPrice } from "@/lib/model-pricing";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";
import { inferModelProvider } from "@/lib/usage-cost-breakdown";
import { isCancelledFailure } from "@/lib/usage-failures";

// Cache for 5 seconds to allow frequent polling without overwhelming the database
// The frontend polls every 60 seconds, so 5s cache won't cause missed updates
const USAGE_HISTORY_CACHE_TTL_MS = 5_000;
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
    cachedTokens: number;
    cacheWriteTokens: number;
    cacheWrite1hTokens: number;
    /**
     * Subset of the totals above from requests whose prompt reached the
     * long-context threshold. Tiering must happen per request: providers with
     * long-context pricing bill the whole request at the higher rate.
     */
    longContextInputTokens: number;
    longContextOutputTokens: number;
    longContextCachedTokens: number;
    longContextCacheWriteTokens: number;
    longContextCacheWrite1hTokens: number;
    /**
     * Subset from requests started in the model's UTC peak hours. Disjoint
     * from the long-context subset: a long-context request is never counted
     * here, so the two tiers never stack.
     */
    peakInputTokens: number;
    peakOutputTokens: number;
    peakCachedTokens: number;
    peakCacheWriteTokens: number;
    peakCacheWrite1hTokens: number;
  }>;
}

interface RequestEvent {
  id?: string;
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  failed: boolean;
  failureStatus: number | null;
  failureCode: string | null;
  failureBody: string | null;
  cancelled: boolean;
}

interface LatencyPoint {
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  provider?: string;
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
  if (year === undefined || month === undefined || day === undefined) return false;
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

  const [fromYear, fromMonth, fromDay] = fromParam.split("-").map(Number) as [number, number, number];
  const [toYear, toMonth, toDay] = toParam.split("-").map(Number) as [number, number, number];
  const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
  const toDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

  if (fromDate > toDate) {
    return Errors.validation("from date must be before to date");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });
    const isAdmin = user?.isAdmin ?? false;
    const cacheKey = `usage-history:v2:${session.userId}:${isAdmin ? "admin" : "user"}:${fromParam}:${toParam}`;
    const cached = usageCache.get(cacheKey) as { data: unknown; isAdmin: boolean } | null;
    if (cached) {
      logger.debug({ userId: session.userId, from: fromParam, to: toParam }, "Usage history cache hit");
      return NextResponse.json(cached);
    }

    const whereClause = {
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
      // Authorize by the owning API key, not a mutable request source label.
      ...(isAdmin ? { apiKeyId: { not: null } } : { apiKey: { userId: session.userId } }),
    };

    const usageRecords = await prisma.usageRecord.findMany({
      where: whereClause,
      select: {
        id: true,
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
        cacheWriteTokens: true,
        cacheWrite1hTokens: true,
        failed: true,
        failureStatus: true,
        failureCode: true,
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

  const collectorState = await prisma.collectorState.findUnique({
    where: { id: "singleton" },
  });

    const keyUsageMap: Record<string, KeyUsage> = {};
    const bucketSpanMs = toDate.getTime() - fromDate.getTime();
    const useHourlyBuckets = bucketSpanMs <= 48 * 60 * 60 * 1000;
    const formatBucketKey = (dt: Date) => {
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, "0");
      const dy = String(dt.getDate()).padStart(2, "0");
      if (!useHourlyBuckets) return `${yr}-${mo}-${dy}`;
      const hr = String(dt.getHours()).padStart(2, "0");
      return `${yr}-${mo}-${dy}T${hr}:00`;
    };

    const dailyMap: Record<string, {
      requests: number;
      tokens: number;
      inputTokens: number;
      uncachedInputTokens: number;
      cachedTokens: number;
      cacheWriteTokens: number;
      outputTokens: number;
      success: number;
      failure: number;
    }> = {};
    const modelTotalsMap: Record<string, {
      provider: string;
      requests: number;
      tokens: number;
      successCount: number;
      failureCount: number;
      latencyValues: number[];
    }> = {};
    const providerTotalsMap: Record<string, {
      models: Set<string>;
      requests: number;
      tokens: number;
      successCount: number;
      failureCount: number;
      latencyValues: number[];
    }> = {};
    const requestEvents: RequestEvent[] = [];
    const requestEventRecords: Array<{ id?: string; userId: string | null }> = [];
    const latencySeriesSeed: LatencyPoint[] = [];
    const latencyValues: number[] = [];
    let totalRequests = 0;
    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalUncachedInputTokens = 0;
    let totalCachedTokens = 0;
    let totalCacheWriteTokens = 0;
    let totalOutputTokens = 0;
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    // Long-context thresholds and peak hours are per model; resolve each model once.
    // Live catalog + built-in overrides are available server-side (user overrides
    // live in the browser), which is what the bucket split is based on.
    const livePricing = await getLiveModelPricing();
    const modelPrices = new Map<string, ModelPrice | null>();
    const priceForModel = (model: string) => {
      if (!modelPrices.has(model)) {
        modelPrices.set(model, resolveModelPrice(model, undefined, livePricing));
      }
      return modelPrices.get(model) ?? null;
    };

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

      const modelName = record.model;
      const price = priceForModel(modelName);
      const split = price
        ? splitCachedInput(record.inputTokens, record.cachedTokens, price)
        : { uncachedInput: record.inputTokens, cached: record.cachedTokens };
      const cacheWriteTokens = record.cacheWriteTokens ?? 0;
      const cacheWrite1hTokens = record.cacheWrite1hTokens ?? 0;

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

      if (!keyUsage.models[modelName]) {
        keyUsage.models[modelName] = {
          totalRequests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          cacheWriteTokens: 0,
          cacheWrite1hTokens: 0,
          longContextInputTokens: 0,
          longContextOutputTokens: 0,
          longContextCachedTokens: 0,
          longContextCacheWriteTokens: 0,
          longContextCacheWrite1hTokens: 0,
          peakInputTokens: 0,
          peakOutputTokens: 0,
          peakCachedTokens: 0,
          peakCacheWriteTokens: 0,
          peakCacheWrite1hTokens: 0,
        };
      }
      const modelUsage = keyUsage.models[modelName];
      modelUsage.totalRequests += 1;
      modelUsage.totalTokens += record.totalTokens;
      modelUsage.inputTokens += record.inputTokens;
      modelUsage.outputTokens += record.outputTokens;
      modelUsage.cachedTokens += record.cachedTokens;
      modelUsage.cacheWriteTokens += cacheWriteTokens;
      modelUsage.cacheWrite1hTokens += cacheWrite1hTokens;

      // Tier selection happens on the individual request, not on the model sum,
      // and uses that model's own threshold (xAI 200k, OpenAI >272k).
      // Peak hours are likewise decided per request, from its UTC start time.
      if (isLongContextPrompt(record.inputTokens, price)) {
        modelUsage.longContextInputTokens += record.inputTokens;
        modelUsage.longContextOutputTokens += record.outputTokens;
        modelUsage.longContextCachedTokens += record.cachedTokens;
        modelUsage.longContextCacheWriteTokens += cacheWriteTokens;
        modelUsage.longContextCacheWrite1hTokens += cacheWrite1hTokens;
      } else if (isPeakRequest(record.timestamp, price)) {
        modelUsage.peakInputTokens += record.inputTokens;
        modelUsage.peakOutputTokens += record.outputTokens;
        modelUsage.peakCachedTokens += record.cachedTokens;
        modelUsage.peakCacheWriteTokens += cacheWriteTokens;
        modelUsage.peakCacheWrite1hTokens += cacheWrite1hTokens;
      }

      // Time-series aggregation for charts (hourly for <=48h windows, daily otherwise)
      const dayKey = formatBucketKey(record.timestamp);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          requests: 0,
          tokens: 0,
          inputTokens: 0,
          uncachedInputTokens: 0,
          cachedTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: 0,
          success: 0,
          failure: 0,
        };
      }
      dailyMap[dayKey].requests += 1;
      dailyMap[dayKey].tokens += record.totalTokens;
      dailyMap[dayKey].inputTokens += record.inputTokens;
      dailyMap[dayKey].uncachedInputTokens += split.uncachedInput;
      dailyMap[dayKey].cachedTokens += split.cached;
      dailyMap[dayKey].cacheWriteTokens += cacheWriteTokens;
      dailyMap[dayKey].outputTokens += record.outputTokens;
      if (record.failed) {
        dailyMap[dayKey].failure += 1;
      } else {
        dailyMap[dayKey].success += 1;
      }

      // Model and provider performance aggregation for diagnostic charts
      const providerName = inferModelProvider(modelName, price?.provider);
      const modelEntry = (modelTotalsMap[modelName] ??= {
        provider: providerName,
        requests: 0,
        tokens: 0,
        successCount: 0,
        failureCount: 0,
        latencyValues: [],
      });
      modelEntry.requests += 1;
      modelEntry.tokens += record.totalTokens;
      if (record.failed) {
        modelEntry.failureCount += 1;
      } else {
        modelEntry.successCount += 1;
      }
      if (record.latencyMs > 0) {
        modelEntry.latencyValues.push(record.latencyMs);
      }

      const providerEntry = (providerTotalsMap[providerName] ??= {
        models: new Set<string>(),
        requests: 0,
        tokens: 0,
        successCount: 0,
        failureCount: 0,
        latencyValues: [],
      });
      providerEntry.models.add(modelName);
      providerEntry.requests += 1;
      providerEntry.tokens += record.totalTokens;
      if (record.failed) {
        providerEntry.failureCount += 1;
      } else {
        providerEntry.successCount += 1;
      }
      if (record.latencyMs > 0) {
        providerEntry.latencyValues.push(record.latencyMs);
      }

      const failureStatus = record.failureStatus ?? null;
      const failureCode = record.failureCode ?? null;

      const event: RequestEvent = {
        ...(record.id ? { id: record.id } : {}),
        timestamp: record.timestamp.toISOString(),
        keyName: keyUsage.keyName,
        ...(isAdmin && username ? { username } : {}),
        model: modelName,
        latencyMs: Math.max(0, record.latencyMs),
        totalTokens: record.totalTokens,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cachedTokens: record.cachedTokens,
        cacheWriteTokens,
        cacheWrite1hTokens,
        failed: record.failed,
        failureStatus,
        failureCode,
        failureBody: null,
        cancelled: isCancelledFailure(record.failed, failureStatus, failureCode, null),
      };
      if (requestEvents.length < REQUEST_EVENT_LIMIT) {
        requestEvents.push(event);
        requestEventRecords.push({ id: record.id, userId: record.userId });
      }
      if (event.latencyMs > 0) {
        latencyValues.push(event.latencyMs);
        if (latencySeriesSeed.length < LATENCY_SERIES_LIMIT) {
          latencySeriesSeed.push({
            timestamp: event.timestamp,
            keyName: event.keyName,
            ...(event.username ? { username: event.username } : {}),
            model: event.model,
            provider: providerName,
            latencyMs: event.latencyMs,
            failed: event.failed,
          });
        }
      }

      totalRequests += 1;
      totalTokens += record.totalTokens;
      totalInputTokens += record.inputTokens;
      totalUncachedInputTokens += split.uncachedInput;
      totalCachedTokens += split.cached;
      totalCacheWriteTokens += cacheWriteTokens;
      totalOutputTokens += record.outputTokens;
      if (record.failed) {
        totalFailureCount += 1;
      } else {
        totalSuccessCount += 1;
      }
    }

    const failedEventIds = requestEventRecords
      .filter((meta, index) => Boolean(requestEvents[index]?.failed && meta.id))
      .map((meta) => meta.id as string);

    if (failedEventIds.length > 0) {
      const failureBodies = await prisma.usageRecord.findMany({
        where: { id: { in: failedEventIds } },
        select: { id: true, failureBody: true },
      });
      const failureBodyById = new Map(failureBodies.map((row) => [row.id, row.failureBody ?? null]));
      for (let i = 0; i < requestEvents.length; i++) {
        const event = requestEvents[i];
        const meta = requestEventRecords[i];
        if (!event || !event.failed || !meta?.id) continue;
        const body = failureBodyById.get(meta.id) ?? null;
        event.cancelled = isCancelledFailure(event.failed, event.failureStatus, event.failureCode, body);
        event.failureBody = isAdmin || meta.userId === session.userId ? body : null;
      }
    }

    if (useHourlyBuckets && Object.keys(dailyMap).length > 0) {
      const endMs = Math.min(toDate.getTime(), Date.now());
      const cursor = new Date(fromDate);
      cursor.setMinutes(0, 0, 0);
      while (cursor.getTime() <= endMs) {
        const key = formatBucketKey(cursor);
        if (!dailyMap[key]) {
          dailyMap[key] = {
            requests: 0,
            tokens: 0,
            inputTokens: 0,
            uncachedInputTokens: 0,
            cachedTokens: 0,
            cacheWriteTokens: 0,
            outputTokens: 0,
            success: 0,
            failure: 0,
          };
        }
        cursor.setHours(cursor.getHours() + 1);
      }
    }

    // Build sorted time-series breakdown array
    const dailyBreakdown = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // Build sorted model breakdown array (top models first)
    const modelBreakdown = Object.entries(modelTotalsMap)
      .sort(([, a], [, b]) => b.requests - a.requests)
      .map(([model, data]) => {
        const latency = summarizeLatency(data.latencyValues);
        const failureRate = data.requests > 0 ? Number(((data.failureCount / data.requests) * 100).toFixed(1)) : 0;
        return {
          model,
          provider: data.provider,
          requests: data.requests,
          tokens: data.tokens,
          successCount: data.successCount,
          failureCount: data.failureCount,
          failureRate,
          avgLatencyMs: latency.averageMs,
          p95LatencyMs: latency.p95Ms,
          maxLatencyMs: latency.maxMs,
          latencySampleCount: latency.sampleCount,
        };
      });

    const providerBreakdown = Object.entries(providerTotalsMap)
      .map(([provider, data]) => {
        const latency = summarizeLatency(data.latencyValues);
        const failureRate = data.requests > 0 ? Number(((data.failureCount / data.requests) * 100).toFixed(1)) : 0;
        return {
          provider,
          models: data.models.size,
          requests: data.requests,
          tokens: data.tokens,
          successCount: data.successCount,
          failureCount: data.failureCount,
          failureRate,
          avgLatencyMs: latency.averageMs,
          p95LatencyMs: latency.p95Ms,
          maxLatencyMs: latency.maxMs,
          latencySampleCount: latency.sampleCount,
        };
      })
      .sort((a, b) => b.p95LatencyMs - a.p95LatencyMs || b.avgLatencyMs - a.avgLatencyMs || b.requests - a.requests);

    const latencySummary = summarizeLatency(latencyValues);
    const latencySeries = [...latencySeriesSeed].reverse();

    const responseData = {
      data: {
        keys: keyUsageMap,
        totals: {
          totalRequests,
          totalTokens,
          inputTokens: totalInputTokens,
          uncachedInputTokens: totalUncachedInputTokens,
          cachedTokens: totalCachedTokens,
          cacheWriteTokens: totalCacheWriteTokens,
          outputTokens: totalOutputTokens,
          successCount: totalSuccessCount,
          failureCount: totalFailureCount,
        },
        bucketGranularity: useHourlyBuckets ? "hour" : "day",
        dailyBreakdown,
        modelBreakdown,
        providerBreakdown,
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

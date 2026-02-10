import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { usageCache, CACHE_TTL, CACHE_KEYS } from "@/lib/cache";
import { logger } from "@/lib/logger";

const CLIPROXYAPI_MANAGEMENT_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

interface ApiKeyDbRecord {
  key: string;
  name: string;
  userId: string;
}

interface TokenDetails {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  total_tokens: number;
}

interface RequestDetail {
  timestamp: string;
  source: string;
  auth_index: string;
  tokens: TokenDetails;
  failed: boolean;
}

interface ModelUsage {
  total_requests: number;
  total_tokens: number;
  details: RequestDetail[];
}

interface ApiUsageEntry {
  total_requests: number;
  total_tokens: number;
  success_count?: number;
  failure_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  models?: Record<string, ModelUsage>;
  [key: string]: unknown;
}

interface RawUsageResponse {
  total_requests: number;
  success_count: number;
  failure_count: number;
  total_tokens: number;
  apis: Record<string, ApiUsageEntry>;
  requests_by_day?: Record<string, number>;
  requests_by_hour?: Record<string, number>;
  tokens_by_day?: Record<string, number>;
  tokens_by_hour?: Record<string, number>;
}

function isApiUsageEntry(value: unknown): value is ApiUsageEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "total_requests" in value &&
    "total_tokens" in value &&
    typeof (value as ApiUsageEntry).total_requests === "number" &&
    typeof (value as ApiUsageEntry).total_tokens === "number"
  );
}

function isRawUsageResponse(value: unknown): value is RawUsageResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !("total_requests" in value) ||
    !("success_count" in value) ||
    !("failure_count" in value) ||
    !("total_tokens" in value) ||
    !("apis" in value)
  ) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (
    typeof obj.total_requests !== "number" ||
    typeof obj.success_count !== "number" ||
    typeof obj.failure_count !== "number" ||
    typeof obj.total_tokens !== "number" ||
    typeof obj.apis !== "object" ||
    obj.apis === null
  ) {
    return false;
  }

  const apis = obj.apis as Record<string, unknown>;
  for (const apiValue of Object.values(apis)) {
    if (!isApiUsageEntry(apiValue)) {
      return false;
    }
  }

  return true;
}

// Aggregate input_tokens and output_tokens from model details
function aggregateTokensFromModels(models: Record<string, ModelUsage> | undefined): { inputTokens: number; outputTokens: number; reasoningTokens: number; cachedTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let cachedTokens = 0;

  if (!models) return { inputTokens, outputTokens, reasoningTokens, cachedTokens };

  for (const modelData of Object.values(models)) {
    if (modelData.details && Array.isArray(modelData.details)) {
      for (const detail of modelData.details) {
        if (detail.tokens) {
          inputTokens += detail.tokens.input_tokens || 0;
          outputTokens += detail.tokens.output_tokens || 0;
          reasoningTokens += detail.tokens.reasoning_tokens || 0;
          cachedTokens += detail.tokens.cached_tokens || 0;
        }
      }
    }
  }

  return { inputTokens, outputTokens, reasoningTokens, cachedTokens };
}

// Enrich API entry with aggregated token breakdown from model details
function enrichApiEntryWithTokenBreakdown(entry: ApiUsageEntry): ApiUsageEntry {
  const models = entry.models as Record<string, ModelUsage> | undefined;
  const aggregated = aggregateTokensFromModels(models);
  
  // Also enrich each model with its own input/output tokens
  const enrichedModels: Record<string, ModelUsage & { input_tokens?: number; output_tokens?: number; reasoning_tokens?: number; cached_tokens?: number }> = {};
  
  if (models) {
    for (const [modelName, modelData] of Object.entries(models)) {
      let modelInput = 0;
      let modelOutput = 0;
      let modelReasoning = 0;
      let modelCached = 0;
      
      if (modelData.details && Array.isArray(modelData.details)) {
        for (const detail of modelData.details) {
          if (detail.tokens) {
            modelInput += detail.tokens.input_tokens || 0;
            modelOutput += detail.tokens.output_tokens || 0;
            modelReasoning += detail.tokens.reasoning_tokens || 0;
            modelCached += detail.tokens.cached_tokens || 0;
          }
        }
      }
      
      enrichedModels[modelName] = {
        ...modelData,
        input_tokens: modelInput,
        output_tokens: modelOutput,
        reasoning_tokens: modelReasoning,
        cached_tokens: modelCached,
      };
    }
  }
  
  return {
    ...entry,
    input_tokens: aggregated.inputTokens,
    output_tokens: aggregated.outputTokens,
    reasoning_tokens: aggregated.reasoningTokens,
    cached_tokens: aggregated.cachedTokens,
    models: Object.keys(enrichedModels).length > 0 ? enrichedModels : entry.models,
  };
}

function filterAndLabelApis(
  apis: Record<string, ApiUsageEntry>,
  userKeys: ApiKeyDbRecord[],
  isAdmin: boolean
): { apis: Record<string, ApiUsageEntry>; totals: { requests: number; tokens: number; success: number; failure: number; inputTokens: number; outputTokens: number } } {
  const result: Record<string, ApiUsageEntry> = {};
  // CLIProxyAPI sends first 16 chars of API key as auth_index
  // We need to match using the same prefix from our stored keys
  const keySet = new Set(userKeys.map((k) => k.key.substring(0, 16)));
  const keyNameMap = new Map(userKeys.map((k) => [k.key.substring(0, 16), k.name]));
  const usedLabels = new Set<string>();
  
  let totalRequests = 0;
  let totalTokens = 0;
  let totalSuccess = 0;
  let totalFailure = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const [rawKey, entry] of Object.entries(apis)) {
    const isUserKey = keySet.has(rawKey);
    
    if (!isAdmin && !isUserKey) {
      continue;
    }

    const keyName = keyNameMap.get(rawKey);
    let baseLabel = keyName ? keyName : (isAdmin ? `Unknown Key` : "My Key");
    
    // Ensure unique labels by appending suffix if collision detected
    let label = baseLabel;
    let suffix = 1;
    while (usedLabels.has(label)) {
      suffix++;
      label = `${baseLabel} (${suffix})`;
    }
    usedLabels.add(label);

    // Enrich entry with aggregated token breakdown from model details
    const enrichedEntry = enrichApiEntryWithTokenBreakdown(entry);
    
    result[label] = enrichedEntry;
    totalRequests += enrichedEntry.total_requests || 0;
    totalTokens += enrichedEntry.total_tokens || 0;
    totalSuccess += enrichedEntry.success_count || 0;
    totalFailure += enrichedEntry.failure_count || 0;
    totalInputTokens += enrichedEntry.input_tokens || 0;
    totalOutputTokens += enrichedEntry.output_tokens || 0;
  }

  return {
    apis: result,
    totals: {
      requests: totalRequests,
      tokens: totalTokens,
      success: totalSuccess,
      failure: totalFailure,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
  };
}

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MANAGEMENT_API_KEY) {
    logger.error("MANAGEMENT_API_KEY is not configured");
    return NextResponse.json(
      { error: "Server configuration error: management API key not set" },
      { status: 500 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });
    const isAdmin = user?.isAdmin ?? false;

    const cacheKey = `${CACHE_KEYS.usage(session.userId)}:${isAdmin}`;
    const cached = usageCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const [usageResponse, userKeys] = await Promise.all([
      fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/usage`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        },
      }),
      prisma.userApiKey.findMany({
        where: isAdmin ? undefined : { userId: session.userId },
        select: {
          key: true,
          name: true,
          userId: true,
        },
      }),
    ]);

    if (!usageResponse.ok) {
      logger.error(
        { status: usageResponse.status, statusText: usageResponse.statusText },
        "CLIProxyAPI usage endpoint returned error"
      );
      return NextResponse.json(
        { error: "Failed to fetch usage data from CLIProxyAPI" },
        { status: 502 }
      );
    }

    const responseJson: unknown = await usageResponse.json();

    const rawData: unknown =
      typeof responseJson === "object" &&
      responseJson !== null &&
      "usage" in responseJson
        ? (responseJson as Record<string, unknown>).usage
        : responseJson;

    if (!isRawUsageResponse(rawData)) {
      logger.error({ response: JSON.stringify(responseJson).slice(0, 200) }, "Unexpected usage response format from CLIProxyAPI");
      return NextResponse.json(
        { error: "Invalid usage data format from CLIProxyAPI" },
        { status: 502 }
      );
    }

    const { apis: filteredApis, totals } = filterAndLabelApis(rawData.apis, userKeys, isAdmin);

    const responseData = {
      data: {
        total_requests: isAdmin ? rawData.total_requests : totals.requests,
        success_count: isAdmin ? rawData.success_count : totals.success,
        failure_count: isAdmin ? rawData.failure_count : totals.failure,
        total_tokens: isAdmin ? rawData.total_tokens : totals.tokens,
        input_tokens: isAdmin ? totals.inputTokens : totals.inputTokens,
        output_tokens: isAdmin ? totals.outputTokens : totals.outputTokens,
        apis: filteredApis,
        requests_by_day: isAdmin ? rawData.requests_by_day : undefined,
        requests_by_hour: isAdmin ? rawData.requests_by_hour : undefined,
        tokens_by_day: isAdmin ? rawData.tokens_by_day : undefined,
        tokens_by_hour: isAdmin ? rawData.tokens_by_hour : undefined,
      },
      isAdmin,
    };

    usageCache.set(cacheKey, responseData, CACHE_TTL.USAGE);

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch usage data");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

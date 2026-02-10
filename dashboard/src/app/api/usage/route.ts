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

// Aggregated usage per API key (auth_index)
interface AggregatedKeyUsage {
  total_requests: number;
  total_tokens: number;
  success_count: number;
  failure_count: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  sources: string[];
  models: Record<string, { total_requests: number; total_tokens: number; input_tokens: number; output_tokens: number }>;
}

// CLIProxyAPI groups by endpoint -> model -> details (with auth_index per request)
// We need to regroup by auth_index (API key) to show per-user usage
function groupUsageByApiKey(
  apis: Record<string, ApiUsageEntry>
): Record<string, AggregatedKeyUsage> {
  const byKey: Record<string, AggregatedKeyUsage> = {};

  for (const endpointEntry of Object.values(apis)) {
    const models = endpointEntry.models as Record<string, ModelUsage> | undefined;
    if (!models) continue;

    for (const [modelName, modelData] of Object.entries(models)) {
      if (!modelData.details || !Array.isArray(modelData.details)) continue;

      for (const detail of modelData.details) {
        const authIndex = detail.auth_index;
        if (!authIndex) continue;

        if (!byKey[authIndex]) {
          byKey[authIndex] = {
            total_requests: 0,
            total_tokens: 0,
            success_count: 0,
            failure_count: 0,
            input_tokens: 0,
            output_tokens: 0,
            reasoning_tokens: 0,
            cached_tokens: 0,
            sources: [],
            models: {},
          };
        }

        const keyUsage = byKey[authIndex];
        keyUsage.total_requests += 1;
        keyUsage.total_tokens += detail.tokens?.total_tokens || 0;
        keyUsage.input_tokens += detail.tokens?.input_tokens || 0;
        keyUsage.output_tokens += detail.tokens?.output_tokens || 0;
        keyUsage.reasoning_tokens += detail.tokens?.reasoning_tokens || 0;
        keyUsage.cached_tokens += detail.tokens?.cached_tokens || 0;
        if (detail.source && !keyUsage.sources.includes(detail.source)) {
          keyUsage.sources.push(detail.source);
        }

        if (detail.failed) {
          keyUsage.failure_count += 1;
        } else {
          keyUsage.success_count += 1;
        }

        // Aggregate per model
        if (!keyUsage.models[modelName]) {
          keyUsage.models[modelName] = {
            total_requests: 0,
            total_tokens: 0,
            input_tokens: 0,
            output_tokens: 0,
          };
        }
        keyUsage.models[modelName].total_requests += 1;
        keyUsage.models[modelName].total_tokens += detail.tokens?.total_tokens || 0;
        keyUsage.models[modelName].input_tokens += detail.tokens?.input_tokens || 0;
        keyUsage.models[modelName].output_tokens += detail.tokens?.output_tokens || 0;
      }
    }
  }

  return byKey;
}

function filterAndLabelApis(
  apis: Record<string, ApiUsageEntry>,
  userKeys: ApiKeyDbRecord[],
  isAdmin: boolean,
  userSourceMatchers: string[]
): { apis: Record<string, AggregatedKeyUsage>; totals: { requests: number; tokens: number; success: number; failure: number; inputTokens: number; outputTokens: number } } {
  // First, regroup usage by API key (auth_index)
  const usageByKey = groupUsageByApiKey(apis);
  
  const result: Record<string, AggregatedKeyUsage> = {};
  const normalizedSourceMatchers = new Set(
    userSourceMatchers
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  );
  // Dashboard stores full keys like "sk-abc123...", CLIProxyAPI uses 16-char auth_index
  // Match by checking if the stored key starts with "sk-" and comparing after prefix,
  // or by direct 16-char prefix match
  const keyNameMap = new Map<string, string>();
  const keyUserMap = new Map<string, string>();
  
  for (const k of userKeys) {
    // Try matching: CLIProxyAPI might use first 16 chars of the key (without sk- prefix)
    // or some other hash. We'll try multiple matching strategies.
    const keyWithoutPrefix = k.key.startsWith("sk-") ? k.key.slice(3) : k.key;
    const prefix16 = keyWithoutPrefix.substring(0, 16);
    keyNameMap.set(prefix16, k.name);
    keyUserMap.set(prefix16, k.userId);
  }
  
  const usedLabels = new Set<string>();
  let totalRequests = 0;
  let totalTokens = 0;
  let totalSuccess = 0;
  let totalFailure = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const [authIndex, usage] of Object.entries(usageByKey)) {
    const keyName = keyNameMap.get(authIndex);
    const isUserKey = keyName !== undefined;
    const isUserSource = usage.sources.some((source) => normalizedSourceMatchers.has(source.toLowerCase()));
    
    // Non-admin users only see their own keys
    if (!isAdmin && !isUserKey && !isUserSource) {
      continue;
    }

    // For admin: show key name if known, otherwise show truncated auth_index
    // For user: show key name if known, otherwise "My Key"
    let baseLabel = keyName ? keyName : (isAdmin ? `Key ${authIndex}` : `My Key ${authIndex.slice(0, 6)}`);
    
    // Ensure unique labels
    let label = baseLabel;
    let suffix = 1;
    while (usedLabels.has(label)) {
      suffix++;
      label = `${baseLabel} (${suffix})`;
    }
    usedLabels.add(label);

    result[label] = usage;
    totalRequests += usage.total_requests;
    totalTokens += usage.total_tokens;
    totalSuccess += usage.success_count;
    totalFailure += usage.failure_count;
    totalInputTokens += usage.input_tokens;
    totalOutputTokens += usage.output_tokens;
  }

  if (!isAdmin && userKeys.length === 1) {
    const onlyLabel = userKeys[0]?.name || "My Key";
    const allEntries = Object.values(result);

    if (allEntries.length > 1) {
      const merged: AggregatedKeyUsage = {
        total_requests: 0,
        total_tokens: 0,
        success_count: 0,
        failure_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        reasoning_tokens: 0,
        cached_tokens: 0,
        sources: [],
        models: {},
      };

      for (const entry of allEntries) {
        merged.total_requests += entry.total_requests;
        merged.total_tokens += entry.total_tokens;
        merged.success_count += entry.success_count;
        merged.failure_count += entry.failure_count;
        merged.input_tokens += entry.input_tokens;
        merged.output_tokens += entry.output_tokens;
        merged.reasoning_tokens += entry.reasoning_tokens;
        merged.cached_tokens += entry.cached_tokens;

        for (const source of entry.sources) {
          if (!merged.sources.includes(source)) {
            merged.sources.push(source);
          }
        }

        for (const [modelName, modelUsage] of Object.entries(entry.models)) {
          if (!merged.models[modelName]) {
            merged.models[modelName] = {
              total_requests: 0,
              total_tokens: 0,
              input_tokens: 0,
              output_tokens: 0,
            };
          }

          merged.models[modelName].total_requests += modelUsage.total_requests;
          merged.models[modelName].total_tokens += modelUsage.total_tokens;
          merged.models[modelName].input_tokens += modelUsage.input_tokens;
          merged.models[modelName].output_tokens += modelUsage.output_tokens;
        }
      }

      return {
        apis: { [onlyLabel]: merged },
        totals: {
          requests: merged.total_requests,
          tokens: merged.total_tokens,
          success: merged.success_count,
          failure: merged.failure_count,
          inputTokens: merged.input_tokens,
          outputTokens: merged.output_tokens,
        },
      };
    }
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

    const userSourceMatchers = [session.username];
    if (!isAdmin) {
      const oauthOwnerships = await prisma.providerOAuthOwnership.findMany({
        where: { userId: session.userId },
        select: {
          accountName: true,
          accountEmail: true,
        },
      });

      for (const ownership of oauthOwnerships) {
        userSourceMatchers.push(ownership.accountName);
        if (ownership.accountEmail) {
          userSourceMatchers.push(ownership.accountEmail);
        }
      }
    }

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

    const { apis: filteredApis, totals } = filterAndLabelApis(
      rawData.apis,
      userKeys,
      isAdmin,
      userSourceMatchers
    );

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

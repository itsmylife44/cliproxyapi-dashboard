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

interface ApiUsageEntry {
  total_requests: number;
  total_tokens: number;
  success_count?: number;
  failure_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  models?: Record<string, unknown>;
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

function filterAndLabelApis(
  apis: Record<string, ApiUsageEntry>,
  userKeys: ApiKeyDbRecord[],
  isAdmin: boolean
): { apis: Record<string, ApiUsageEntry>; totals: { requests: number; tokens: number; success: number; failure: number } } {
  const result: Record<string, ApiUsageEntry> = {};
  const keySet = new Set(userKeys.map((k) => k.key));
  const keyNameMap = new Map(userKeys.map((k) => [k.key, k.name]));
  const usedLabels = new Set<string>();
  
  let totalRequests = 0;
  let totalTokens = 0;
  let totalSuccess = 0;
  let totalFailure = 0;

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

    result[label] = { ...entry };
    totalRequests += entry.total_requests || 0;
    totalTokens += entry.total_tokens || 0;
    totalSuccess += entry.success_count || 0;
    totalFailure += entry.failure_count || 0;
  }

  return {
    apis: result,
    totals: {
      requests: totalRequests,
      tokens: totalTokens,
      success: totalSuccess,
      failure: totalFailure,
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

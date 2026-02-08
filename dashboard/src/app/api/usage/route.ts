import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { usageCache, CACHE_TTL, CACHE_KEYS } from "@/lib/cache";

const CLIPROXYAPI_MANAGEMENT_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

interface ApiKeyDbRecord {
  key: string;
  name: string;
  user: { username: string };
}

interface ApiKeyLabel {
  name: string;
  username: string;
}

interface ApiUsageEntry {
  total_requests: number;
  total_tokens: number;
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

function buildKeyLookup(
  dbKeys: ApiKeyDbRecord[]
): Map<string, ApiKeyLabel> {
  const lookup = new Map<string, ApiKeyLabel>();
  for (const record of dbKeys) {
    lookup.set(record.key, {
      name: record.name,
      username: record.user.username,
    });
  }
  return lookup;
}

function sanitizeApiKeys(
  apis: Record<string, ApiUsageEntry>,
  keyLookup: Map<string, ApiKeyLabel>
): Record<string, ApiUsageEntry> {
  const sanitized: Record<string, ApiUsageEntry> = {};
  let unknownCounter = 0;

  for (const [rawKey, entry] of Object.entries(apis)) {
    const label = keyLookup.get(rawKey);
    let sanitizedLabel: string;

    if (label) {
      const keyName = label.name.trim() || "Unnamed Key";
      sanitizedLabel = `${keyName} (${label.username})`;
    } else {
      unknownCounter++;
      sanitizedLabel = `Unknown Key ${unknownCounter}`;
    }

    sanitized[sanitizedLabel] = { ...entry };
  }

  return sanitized;
}

async function requireAdmin(): Promise<{ userId: string; username: string } | NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  return { userId: session.userId, username: session.username };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!MANAGEMENT_API_KEY) {
    console.error("MANAGEMENT_API_KEY is not configured");
    return NextResponse.json(
      { error: "Server configuration error: management API key not set" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const skip = (page - 1) * limit;

    const cacheKey = `${CACHE_KEYS.usage(authResult.userId)}:${page}:${limit}`;
    const cached = usageCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const [usageResponse, allKeys, totalKeys] = await Promise.all([
      fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/usage`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        },
      }),
      prisma.userApiKey.findMany({
        select: {
          key: true,
          name: true,
          user: { select: { username: true } },
        },
        skip,
        take: limit,
      }),
      prisma.userApiKey.count(),
    ]);

    if (!usageResponse.ok) {
      console.error(
        `CLIProxyAPI usage endpoint returned ${usageResponse.status}: ${usageResponse.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to fetch usage data from CLIProxyAPI" },
        { status: 502 }
      );
    }

    const responseJson: unknown = await usageResponse.json();

    // CLIProxyAPI wraps data in { usage: { ... } } — unwrap it
    const rawData: unknown =
      typeof responseJson === "object" &&
      responseJson !== null &&
      "usage" in responseJson
        ? (responseJson as Record<string, unknown>).usage
        : responseJson;

    if (!isRawUsageResponse(rawData)) {
      console.error("Unexpected usage response format from CLIProxyAPI:", JSON.stringify(responseJson).slice(0, 200));
      return NextResponse.json(
        { error: "Invalid usage data format from CLIProxyAPI" },
        { status: 502 }
      );
    }

    const keyLookup = buildKeyLookup(allKeys);
    const sanitizedApis = sanitizeApiKeys(rawData.apis, keyLookup);

    const sanitizedResponse = {
      ...rawData,
      apis: sanitizedApis,
    };

    const responseData = {
      data: sanitizedResponse,
      pagination: {
        page,
        limit,
        total: totalKeys,
        hasMore: skip + allKeys.length < totalKeys,
      },
    };

    usageCache.set(cacheKey, responseData, CACHE_TTL.USAGE);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Failed to fetch usage data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

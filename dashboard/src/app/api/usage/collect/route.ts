import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const CLIPROXYAPI_MANAGEMENT_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;
const COLLECTOR_API_KEY = process.env.COLLECTOR_API_KEY;

const BATCH_SIZE = 500;

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

interface UsageRecordCandidate {
  authIndex: string;
  apiKeyId: string | null;
  userId: string | null;
  model: string;
  source: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  failed: boolean;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isCronAuth =
    COLLECTOR_API_KEY &&
    authHeader === `Bearer ${COLLECTOR_API_KEY}`;

  if (!isCronAuth) {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const originError = validateOrigin(request);
    if (originError) return originError;
  }

  if (!MANAGEMENT_API_KEY) {
    logger.error("MANAGEMENT_API_KEY is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    let usageResponse: Response;
    try {
      usageResponse = await fetch(`${CLIPROXYAPI_MANAGEMENT_URL}/usage`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (fetchError) {
      logger.error({ err: fetchError }, "Failed to connect to CLIProxyAPI");
      return NextResponse.json(
        { error: "Proxy service unavailable" },
        { status: 503 }
      );
    }

    if (!usageResponse.ok) {
      logger.error(
        { status: usageResponse.status, statusText: usageResponse.statusText },
        "CLIProxyAPI usage endpoint returned error"
      );
      return NextResponse.json(
        { error: "Failed to fetch usage data" },
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
      logger.error(
        { response: JSON.stringify(responseJson).slice(0, 200) },
        "Unexpected usage response format from CLIProxyAPI"
      );
      return NextResponse.json(
        { error: "Invalid usage data format" },
        { status: 502 }
      );
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

    for (const apiEntry of Object.values(rawData.apis)) {
      const models = apiEntry.models as Record<string, ModelUsage> | undefined;
      if (!models) continue;

      for (const [modelName, modelData] of Object.entries(models)) {
        if (!modelData.details || !Array.isArray(modelData.details)) continue;

        for (const detail of modelData.details) {
          const authIndex = detail.auth_index;
          if (!authIndex) continue;

          let resolvedUserId: string | null = null;
          let resolvedApiKeyId: string | null = null;

          const keyInfo = keyMap.get(authIndex);
          if (keyInfo) {
            resolvedUserId = keyInfo.userId;
            resolvedApiKeyId = keyInfo.apiKeyId;
          }

          if (!resolvedUserId && detail.source) {
            const matchedUserId = sourceToUser.get(detail.source.toLowerCase());
            if (matchedUserId) {
              resolvedUserId = matchedUserId;
              resolvedApiKeyId = userToApiKey.get(matchedUserId) ?? null;
            }
          }

          candidates.push({
            authIndex,
            apiKeyId: resolvedApiKeyId,
            userId: resolvedUserId,
            model: modelName,
            source: detail.source || "",
            timestamp: new Date(detail.timestamp),
            inputTokens: detail.tokens?.input_tokens || 0,
            outputTokens: detail.tokens?.output_tokens || 0,
            reasoningTokens: detail.tokens?.reasoning_tokens || 0,
            cachedTokens: detail.tokens?.cached_tokens || 0,
            totalTokens: detail.tokens?.total_tokens || 0,
            failed: detail.failed || false,
          });
        }
      }
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

    const skipped = candidates.length - totalStored;
    const now = new Date();

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
      { processed: candidates.length, stored: totalStored, skipped },
      "Usage collection completed"
    );

    return NextResponse.json({
      processed: candidates.length,
      stored: totalStored,
      skipped,
      lastCollectedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Usage collection failed");

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

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

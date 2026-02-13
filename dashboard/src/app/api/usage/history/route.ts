import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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

interface ResponseData {
  data: {
    keys: Record<string, KeyUsage>;
    totals: {
      totalRequests: number;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      successCount: number;
      failureCount: number;
    };
    period: { from: string; to: string };
    collectorStatus: { lastCollectedAt: string; lastStatus: string };
  };
  isAdmin: boolean;
}

function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "Missing required parameters: from and to" },
      { status: 400 }
    );
  }

  if (!isValidISODate(fromParam) || !isValidISODate(toParam)) {
    return NextResponse.json(
      { error: "Invalid date format. Use ISO 8601 format." },
      { status: 400 }
    );
  }

  const fromDate = new Date(fromParam);
  const toDate = new Date(toParam);

  if (fromDate > toDate) {
    return NextResponse.json(
      { error: "from date must be before to date" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });
    const isAdmin = user?.isAdmin ?? false;

    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        timestamp: {
          gte: fromDate,
          lte: toDate,
        },
        ...(isAdmin ? {} : { userId: session.userId }),
      },
      include: {
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
    });

    const collectorState = await prisma.collectorState.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const keyUsageMap: Record<string, KeyUsage> = {};
    let totalRequests = 0;
    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    for (const record of usageRecords) {
      const authIndex = record.authIndex;

      if (!keyUsageMap[authIndex]) {
        const keyName = record.apiKey?.name ?? `Key ${authIndex.slice(0, 6)}`;

        keyUsageMap[authIndex] = {
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

      const keyUsage = keyUsageMap[authIndex];
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

    const responseData: ResponseData = {
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
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        collectorStatus: {
          lastCollectedAt: collectorState?.lastCollectedAt?.toISOString() ?? "",
          lastStatus: collectorState?.lastStatus ?? "unknown",
        },
      },
      isAdmin,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch usage history");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

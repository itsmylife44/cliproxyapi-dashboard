import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { getLogs, getLogCount, clearLogs, getLogStats, type LogEntry } from "@/lib/log-storage";
import { logger } from "@/lib/logger";

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
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

  return { userId: session.userId };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") || undefined;
  const limitParam = searchParams.get("limit");
  const sinceParam = searchParams.get("since");

  const limit = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam, 10) || 100)) : 100;
  const since = sinceParam ? parseInt(sinceParam, 10) : undefined;

  const logs: LogEntry[] = getLogs({ level, limit, since });
  const stats = getLogStats();
  const total = Math.max(stats.memoryCount, stats.fileCount);

  return NextResponse.json({
    logs,
    total,
    stats: {
      memoryCount: stats.memoryCount,
      fileCount: stats.fileCount,
      fileSizeKB: Math.round(stats.fileSizeBytes / 1024),
      rotatedFiles: stats.rotatedFiles,
      persistent: true,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const originError = validateOrigin(request);
  if (originError) {
    return originError;
  }

  clearLogs();
  logger.info({ adminId: authResult.userId }, "Logs cleared by admin");

  return NextResponse.json({ success: true });
}

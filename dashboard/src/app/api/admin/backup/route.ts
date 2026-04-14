import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { Errors, apiSuccess } from "@/lib/errors";
import { createBackup, listBackups, getDiskSpaceInfo } from "@/lib/backup/backup-service";

async function requireAdmin(): Promise<{ userId: string; username: string } | NextResponse> {
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

  return { userId: session.userId, username: session.username };
}

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const [backups, diskSpace] = await Promise.all([
      listBackups(),
      getDiskSpaceInfo(),
    ]);

    return apiSuccess({
      backups,
      diskSpace: {
        availableBytes: diskSpace.availableBytes,
        totalBytes: diskSpace.totalBytes,
        ok: diskSpace.ok,
      },
    });
  } catch (error) {
    return Errors.internal("list backups", error);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const result = await createBackup("manual");

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.BACKUP_CREATED,
      target: result.backup.filename,
      metadata: {
        backupId: result.backup.id,
        sizeBytes: result.backup.sizeBytes,
        trigger: "manual",
      },
      ipAddress: extractIpAddress(request),
    });

    return apiSuccess({ backup: result.backup }, 201);
  } catch (error) {
    return Errors.internal("create backup", error);
  }
}
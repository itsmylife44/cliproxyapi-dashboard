import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { Errors, apiSuccess } from "@/lib/errors";
import { BackupScheduleSchema } from "@/lib/validation/schemas";
import {
  getBackupSchedule,
  updateBackupSchedule,
} from "@/lib/backup/backup-service";

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
    const schedule = await getBackupSchedule();
    return apiSuccess({ schedule });
  } catch (error) {
    return Errors.internal("get backup schedule", error);
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const result = BackupScheduleSchema.safeParse(body);

    if (!result.success) {
      return Errors.zodValidation(result.error.issues);
    }

    const { enabled, intervalHours } = result.data;

    await updateBackupSchedule(enabled, intervalHours);

    logAuditAsync({
      userId: authResult.userId,
      action: AUDIT_ACTION.BACKUP_SCHEDULE_CHANGED,
      target: "backup_schedule",
      metadata: { enabled, intervalHours },
      ipAddress: extractIpAddress(request),
    });

    return apiSuccess({ schedule: { enabled, intervalHours: intervalHours ?? 24 } });
  } catch (error) {
    return Errors.internal("update backup schedule", error);
  }
}
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION, extractIpAddress, logAuditAsync } from "@/lib/audit";
import { Errors, apiSuccess } from "@/lib/errors";
import { BackupFileSchema } from "@/lib/validation/schemas";
import {
  parseBackupFile,
  getRestorePreview,
  restoreFromBackup,
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

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const originError = validateOrigin(request);
  if (originError) return originError;

  const isPreview = request.nextUrl.searchParams.get("preview") === "true";

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return Errors.validation("No backup file provided");
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse and validate backup file
    let backupData: any;
    try {
      backupData = await parseBackupFile(buffer);
    } catch {
      return Errors.validation("Invalid backup file — could not decompress or parse");
    }

    const validation = BackupFileSchema.safeParse(backupData);
    if (!validation.success) {
      return Errors.zodValidation(validation.error.issues);
    }

    // Preview mode — return what will be overwritten
    if (isPreview) {
      const preview = await getRestorePreview(backupData);
      return apiSuccess({ preview });
    }

    // Full restore (includes audit logging before users table restoration)
    const result = await restoreFromBackup(backupData, authResult.userId, extractIpAddress(request));

    return apiSuccess({
      restored: true,
      restoredCounts: result.restoredCounts,
      preRestoreBackupId: result.preRestoreBackupId,
    });
  } catch (error) {
    return Errors.internal("restore from backup", error);
  }
}
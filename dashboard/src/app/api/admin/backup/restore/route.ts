import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Errors, apiSuccess } from "@/lib/errors";
import { restoreFromBackup, MAX_BACKUP_SIZE } from "@/lib/backup";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/backup/restore - Restore from uploaded backup file
 */
export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) {
    return Errors.unauthorized();
  }

  // Check admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true, username: true },
  });

  if (!user?.isAdmin) {
    return Errors.forbidden();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Errors.validation("No file provided");
    }

    // Check file size
    if (file.size > MAX_BACKUP_SIZE) {
      return Errors.validation(`File too large. Maximum size: ${Math.round(MAX_BACKUP_SIZE / 1024 / 1024)}MB`);
    }

    // Check file extension
    if (!file.name.endsWith(".json.gz")) {
      return Errors.validation("Invalid file type. Must be a .json.gz backup file");
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Log restore attempt
    logger.info({
      action: "BACKUP_RESTORE_STARTED",
      userId: session.userId,
      username: user.username,
      filename: file.name,
      fileSize: file.size,
    }, "Backup restore started");

    // Perform restore
    await restoreFromBackup(buffer);

    // Invalidate all sessions by incrementing session version for all users
    await prisma.user.updateMany({
      data: { sessionVersion: { increment: 1 } },
    });

    // Log success
    logger.info({
      action: "BACKUP_RESTORE_COMPLETED",
      userId: session.userId,
      username: user.username,
      filename: file.name,
    }, "Backup restore completed successfully");

    return apiSuccess({
      restored: true,
      message: "Backup restored successfully. Please log in again.",
    });
  } catch (error) {
    logger.error({
      action: "BACKUP_RESTORE_FAILED",
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    }, "Backup restore failed");

    if (error instanceof Error) {
      if (error.message.includes("Invalid backup") || error.message.includes("Unsupported backup")) {
        return Errors.validation(error.message);
      }
    }
    return Errors.internal("Failed to restore backup", error);
  }
}

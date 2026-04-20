import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { runScheduledBackupIfDue } from "@/lib/backup";
import { Errors, apiSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const schedulerKey = process.env.BACKUP_SCHEDULER_KEY;
  if (!schedulerKey) {
    logger.error("BACKUP_SCHEDULER_KEY is not configured");
    return Errors.internal("Server configuration error");
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${schedulerKey}`;

  if (!authHeader || authHeader.length !== expected.length) {
    return Errors.unauthorized();
  }

  try {
    if (!timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
      return Errors.unauthorized();
    }
  } catch {
    return Errors.unauthorized();
  }

  try {
    const outcome = await runScheduledBackupIfDue();
    logger.info({ action: "BACKUP_SCHEDULED_TICK", outcome }, "Scheduled backup tick");
    return apiSuccess({ outcome });
  } catch (error) {
    logger.error({ err: error, action: "BACKUP_SCHEDULED_FAILED" }, "Scheduled backup failed");
    return Errors.internal("Scheduled backup failed", error);
  }
}

import "server-only";

import { createBackup, getBackupSchedule } from "@/lib/backup/backup-service";
import { logger } from "@/lib/logger";

/**
 * Backup scheduler — runs as a recursive setTimeout loop in the Next.js server process.
 * Follows the same pattern as the quota alert scheduler in instrumentation-node.ts.
 *
 * Reads schedule config from DB each cycle so changes take effect without restart.
 */

function scheduleTimeout(callback: () => void | Promise<void>, delayMs: number) {
  const timer = setTimeout(callback, delayMs);
  timer.unref?.();
  return timer;
}

export function startBackupScheduler(): void {
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const schedule = await getBackupSchedule();

      if (!schedule.enabled) {
        return; // Skip — scheduling disabled
      }

      logger.info("Scheduled backup: starting...");
      const result = await createBackup("scheduled");
      logger.info(
        { backupId: result.backup.id, filename: result.backup.filename },
        "Scheduled backup completed successfully"
      );
    } catch (error) {
      // Log but never crash — scheduler errors must not take down the server
      logger.error({ error }, "Scheduled backup failed");
    } finally {
      isRunning = false;
    }
  };

  const scheduleNext = async () => {
    await run();
    try {
      const schedule = await getBackupSchedule();
      const intervalMs = schedule.intervalHours * 60 * 60 * 1000;
      scheduleTimeout(scheduleNext, intervalMs);
    } catch {
      // Fallback to 24 hours if DB read fails
      scheduleTimeout(scheduleNext, 24 * 60 * 60 * 1000);
    }
  };

  scheduleNext();
}

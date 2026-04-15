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

  const DISABLED_POLL_MS = 60 * 60 * 1000; // 1 hour when disabled

  const scheduleNext = async () => {
    try {
      const schedule = await getBackupSchedule();

      if (!schedule.enabled) {
        // Poll infrequently when disabled — changes take effect within 1 hour
        scheduleTimeout(scheduleNext, DISABLED_POLL_MS);
        return;
      }

      const intervalMs = schedule.intervalHours * 60 * 60 * 1000;
      scheduleTimeout(async () => {
        // Re-check enabled flag — admin may have disabled backups while timer was pending
        try {
          const current = await getBackupSchedule();
          if (current.enabled) {
            await run();
          } else {
            logger.info("Scheduled backup skipped — schedule was disabled while timer was pending");
          }
        } catch {
          // If DB read fails, skip this cycle rather than running an unwanted backup
          logger.warn("Scheduled backup skipped — could not verify schedule is still enabled");
        }
        scheduleNext();
      }, intervalMs);
    } catch {
      // Fallback to 1 hour polling if DB read fails
      // Do NOT run backup — we don't know if it's enabled
      scheduleTimeout(scheduleNext, 60 * 60 * 1000);
    }
  };

  scheduleNext();
}

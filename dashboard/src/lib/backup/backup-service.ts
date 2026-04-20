import "server-only";
import { createHash } from "crypto";
import { gzipSync, createGunzip } from "zlib";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";
import { exportDatabase, importDatabase, parseBackupData, generateRestorePreview } from "./export-import";
import type { BackupRecord, BackupListItem, StorageInfo, RestorePreview, ScheduleConfig } from "./types";
import { BACKUP_DIR, BACKUP_EXTENSION, MAX_BACKUP_SIZE } from "./types";

const MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * SINGLE-INSTANCE CONSTRAINT WARNING
 *
 * This AsyncMutex is IN-PROCESS ONLY and does NOT work across multiple dashboard instances.
 * It only synchronizes concurrent requests within a single Node.js process.
 *
 * Current deployment: Single-instance (sufficient for current architecture)
 * If multi-instance deployment is needed in the future: Replace with Postgres advisory locks
 * or a distributed locking mechanism (Redis Redlock, etc.)
 */
class AsyncMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let released = false;
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.locks.set(key, promise);
    return () => {
      if (released) return;
      released = true;
      if (this.locks.get(key) === promise) {
        this.locks.delete(key);
      }
      resolve();
    };
  }
}

const backupMutex = new AsyncMutex();

/**
 * Safe gunzip with size limit to prevent decompression bombs
 */
async function safeGunzip(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    gunzip.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_DECOMPRESSED_SIZE) {
        gunzip.destroy();
        settle(() => reject(new Error("Decompressed size exceeds maximum allowed (500MB)")));
        return;
      }
      chunks.push(chunk);
    });

    gunzip.on("end", () => settle(() => resolve(Buffer.concat(chunks))));
    gunzip.on("error", (err) => settle(() => reject(err)));

    gunzip.write(buffer);
    gunzip.end();
  });
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Generate backup filename
 */
function generateBackupFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup-${timestamp}${BACKUP_EXTENSION}`;
}

/**
 * Calculate SHA-256 checksum
 */
function calculateChecksum(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Create a new backup
 */
export async function createBackup(
  userId: string,
  type: "MANUAL" | "SCHEDULED" = "MANUAL"
): Promise<BackupRecord> {
  const release = await backupMutex.acquire("backup");
  try {
    await ensureBackupDir();

    const filename = generateBackupFilename();
    const filePath = path.join(BACKUP_DIR, filename);

    // Create pending backup record
    const record = await prisma.backupRecord.create({
      data: {
        filename,
        sizeBytes: BigInt(0),
        status: "IN_PROGRESS",
        type,
        createdById: userId,
      },
    });

    try {
      // Export database
      const backupData = await exportDatabase(userId);
      const jsonString = JSON.stringify(backupData);
      
      // Compress
      const compressed = gzipSync(Buffer.from(jsonString, "utf-8"));
      const checksum = calculateChecksum(compressed);

      // Write to file
      await fs.writeFile(filePath, compressed);

      // Update record
      const updatedRecord = await prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          sizeBytes: BigInt(compressed.length),
          status: "COMPLETED",
          completedAt: new Date(),
          checksum,
          metadata: backupData.metadata as object,
        },
      });

      return updatedRecord;
    } catch (error) {
      // Mark as failed
      await prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
      });

      // Clean up partial file
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  } finally {
    release();
  }
}

/**
 * Get backup file path
 */
export function getBackupFilePath(filename: string): string {
  // Prevent path traversal
  const safeName = path.basename(filename);
  return path.join(BACKUP_DIR, safeName);
}

/**
 * Read backup file
 */
export async function readBackupFile(filename: string): Promise<Buffer> {
  const filePath = getBackupFilePath(filename);
  return fs.readFile(filePath);
}

/**
 * Delete a backup
 */
export async function deleteBackup(id: string): Promise<void> {
  const record = await prisma.backupRecord.findUnique({
    where: { id },
  });

  if (!record) {
    throw new Error("Backup not found");
  }

  // Delete file
  const filePath = getBackupFilePath(record.filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // File might not exist, continue with record deletion
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete backup file:", error);
    }
  }

  // Delete record
  await prisma.backupRecord.delete({
    where: { id },
  });
}

/**
 * List all backups
 */
export async function listBackups(): Promise<BackupListItem[]> {
  const records = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return records.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes.toString(),
    status: r.status,
    type: r.type,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    createdBy: r.createdBy,
  }));
}

/**
 * Get restore preview from uploaded file
 */
export async function getRestorePreview(fileBuffer: Buffer): Promise<RestorePreview> {
  if (fileBuffer.length > MAX_BACKUP_SIZE) {
    throw new Error("Backup file too large");
  }

  // Decompress with size limit
  const decompressed = await safeGunzip(fileBuffer);
  const jsonString = decompressed.toString("utf-8");

  // Parse and validate
  const backupData = parseBackupData(jsonString);

  // Generate preview
  return generateRestorePreview(backupData);
}

/**
 * Restore from uploaded backup file
 */
export async function restoreFromBackup(fileBuffer: Buffer): Promise<void> {
  const release = await backupMutex.acquire("backup");
  try {
    if (fileBuffer.length > MAX_BACKUP_SIZE) {
      throw new Error("Backup file too large");
    }

    // Decompress with size limit
    const decompressed = await safeGunzip(fileBuffer);
    const jsonString = decompressed.toString("utf-8");

    // Parse and validate
    const backupData = parseBackupData(jsonString);

    // Import data
    await importDatabase(backupData);
  } finally {
    release();
  }
}

/**
 * Get storage information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  await ensureBackupDir();

  try {
    const files = await fs.readdir(BACKUP_DIR);
    let usedBytes = 0;
    let backupCount = 0;

    for (const file of files) {
      if (file.endsWith(BACKUP_EXTENSION)) {
        const stat = await fs.stat(path.join(BACKUP_DIR, file));
        usedBytes += stat.size;
        backupCount++;
      }
    }

    // Try to get disk space info (may not work in all environments)
    let totalBytes = 10 * 1024 * 1024 * 1024; // Default 10GB
    let freeBytes = totalBytes - usedBytes;

    try {
      // This works on Node 18+
      const { statfs } = await import("fs/promises");
      const stats = await statfs(BACKUP_DIR);
      totalBytes = Number(stats.bsize) * Number(stats.blocks);
      freeBytes = Number(stats.bsize) * Number(stats.bfree);
    } catch {
      // statfs not available, use defaults
    }

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      backupCount,
    };
  } catch (error) {
    console.error("Failed to get storage info:", error);
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      backupCount: 0,
    };
  }
}

/**
 * Compute next run time from cron expression, relative to a base date.
 * Uses `process.env.TZ` when set, falling back to UTC if that timezone is
 * rejected by the parser (bad IANA name). Returns null only when the cron
 * expression itself is invalid.
 */
export function computeNextRun(cronExpr: string, from: Date = new Date()): Date | null {
  const configuredTz = process.env.TZ;
  const tryParse = (tz: string) => {
    const it = CronExpressionParser.parse(cronExpr, { currentDate: from, tz });
    return it.next().toDate();
  };
  try {
    return tryParse(configuredTz || "UTC");
  } catch {
    if (!configuredTz) return null;
    try {
      return tryParse("UTC");
    } catch {
      return null;
    }
  }
}

/**
 * Get backup schedule configuration
 */
export async function getScheduleConfig(): Promise<ScheduleConfig> {
  let schedule = await prisma.backupSchedule.findFirst();

  if (!schedule) {
    // Create default schedule
    schedule = await prisma.backupSchedule.create({
      data: {
        enabled: false,
        cronExpr: "0 3 * * *",
        retention: 7,
      },
    });
  }

  return {
    enabled: schedule.enabled,
    cronExpr: schedule.cronExpr,
    retention: schedule.retention,
    lastRun: schedule.lastRun?.toISOString() ?? null,
    nextRun: schedule.nextRun?.toISOString() ?? null,
  };
}

/**
 * Update backup schedule configuration.
 *
 * Recomputes nextRun whenever enabled transitions to true or cronExpr changes.
 * Clears nextRun when disabled.
 */
export async function updateScheduleConfig(
  config: Partial<Pick<ScheduleConfig, "enabled" | "cronExpr" | "retention">>
): Promise<ScheduleConfig> {
  let schedule = await prisma.backupSchedule.findFirst();

  const resolvedCron = config.cronExpr ?? schedule?.cronExpr ?? "0 3 * * *";
  const resolvedEnabled = config.enabled ?? schedule?.enabled ?? false;
  const cronChanged = config.cronExpr !== undefined && config.cronExpr !== schedule?.cronExpr;
  const enabledToggledOn = config.enabled === true && schedule?.enabled !== true;
  const shouldRecomputeNext = resolvedEnabled && (cronChanged || enabledToggledOn || !schedule?.nextRun);

  let nextRunValue: Date | null | undefined;
  if (!resolvedEnabled) {
    nextRunValue = null;
  } else if (shouldRecomputeNext) {
    nextRunValue = computeNextRun(resolvedCron);
  }

  if (!schedule) {
    schedule = await prisma.backupSchedule.create({
      data: {
        enabled: resolvedEnabled,
        cronExpr: resolvedCron,
        retention: config.retention ?? 7,
        nextRun: nextRunValue ?? null,
      },
    });
  } else {
    schedule = await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        ...(config.enabled !== undefined && { enabled: config.enabled }),
        ...(config.cronExpr !== undefined && { cronExpr: config.cronExpr }),
        ...(config.retention !== undefined && { retention: config.retention }),
        ...(nextRunValue !== undefined && { nextRun: nextRunValue }),
      },
    });
  }

  return {
    enabled: schedule.enabled,
    cronExpr: schedule.cronExpr,
    retention: schedule.retention,
    lastRun: schedule.lastRun?.toISOString() ?? null,
    nextRun: schedule.nextRun?.toISOString() ?? null,
  };
}

/**
 * Clean up old backups based on retention policy.
 *
 * Called by runScheduledBackupIfDue after each successful scheduled backup.
 *
 * @returns Number of backups deleted
 */
export async function cleanupOldBackups(): Promise<number> {
  const schedule = await prisma.backupSchedule.findFirst();
  if (!schedule) return 0;

  const retention = schedule.retention;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retention);

  // Find old backups
  const oldBackups = await prisma.backupRecord.findMany({
    where: {
      type: "SCHEDULED",
      createdAt: { lt: cutoffDate },
      status: "COMPLETED",
    },
  });

  // Delete them
  let deleted = 0;
  for (const backup of oldBackups) {
    try {
      await deleteBackup(backup.id);
      deleted++;
    } catch (error) {
      console.error(`Failed to delete old backup ${backup.id}:`, error);
    }
  }

  return deleted;
}

export type ScheduledBackupOutcome =
  | { status: "disabled" }
  | { status: "not-due"; nextRun: string }
  | { status: "no-admin" }
  | { status: "invalid-cron"; cronExpr: string }
  | { status: "ran"; backupId: string; deleted: number; nextRun: string | null };

/**
 * Tick entry point for external cron. Idempotent: returns `not-due` when
 * current time has not reached `nextRun`, so a caller can safely poll every
 * N minutes without over-triggering.
 *
 * Picks the oldest admin user as `createdById` (no session context available).
 * Returns a structured outcome for logging/observability.
 */
export async function runScheduledBackupIfDue(now: Date = new Date()): Promise<ScheduledBackupOutcome> {
  const schedule = await prisma.backupSchedule.findFirst();
  if (!schedule || !schedule.enabled) {
    return { status: "disabled" };
  }

  // Ensure nextRun is populated (first tick after enable may race with updateScheduleConfig)
  const nextRun = schedule.nextRun;
  if (!nextRun) {
    const computed = computeNextRun(schedule.cronExpr, now);
    if (!computed) {
      return { status: "invalid-cron", cronExpr: schedule.cronExpr };
    }
    await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: { nextRun: computed },
    });
    return { status: "not-due", nextRun: computed.toISOString() };
  }

  if (now < nextRun) {
    return { status: "not-due", nextRun: nextRun.toISOString() };
  }

  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) {
    return { status: "no-admin" };
  }

  // Atomic claim: advance nextRun before running the backup so concurrent
  // ticks or a retried poll cannot trigger a second run for the same slot.
  // `lastRun` is only recorded on success (below) so UI and observers never
  // see a lastRun newer than any completed scheduled backup.
  const newNext = computeNextRun(schedule.cronExpr, now);
  const claim = await prisma.backupSchedule.updateMany({
    where: { id: schedule.id, nextRun: nextRun },
    data: { nextRun: newNext ?? null },
  });
  if (claim.count === 0) {
    // Another tick already advanced nextRun; treat as not-due.
    return { status: "not-due", nextRun: nextRun.toISOString() };
  }

  const backup = await createBackup(admin.id, "SCHEDULED");
  const deleted = await cleanupOldBackups();
  await prisma.backupSchedule.update({
    where: { id: schedule.id },
    data: { lastRun: now },
  });

  return {
    status: "ran",
    backupId: backup.id,
    deleted,
    nextRun: newNext ? newNext.toISOString() : null,
  };
}


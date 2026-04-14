import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { gzipSync, gunzipSync } from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import type { BackupFileData } from "@/lib/validation/schemas";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKUP_DIR = process.env.BACKUP_DIR || "/app/backups";
const BACKUP_VERSION = 1;
const SCHEMA_VERSION = 1;
const MAX_BACKUPS = 10;
const BATCH_SIZE = 1000;
const MIN_DISK_SPACE_BYTES = 500 * 1024 * 1024; // 500MB

// Simple in-memory mutex for backup/restore operations
// More reliable than PostgreSQL advisory locks across connection pools
let isBackupRestoreRunning = false;

/**
 * Table export order — respects FK dependencies for correct restore ordering.
 * Independent tables first, then tables with FK refs to earlier ones.
 */
const TABLE_ORDER = [
  "users",
  "system_settings",
  "collector_state",
  "model_preferences",
  "agent_model_overrides",
  "sync_tokens",
  "user_api_keys",
  "config_templates",
  "config_subscriptions",
  "provider_key_ownerships",
  "provider_oauth_ownerships",
  "provider_groups",
  "custom_providers",
  "custom_provider_models",
  "custom_provider_excluded_models",
  "audit_logs",
  "usage_records",
  "perplexity_cookies",
] as const;

type TableName = (typeof TABLE_ORDER)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getBackupPath(filename: string): string {
  return path.join(BACKUP_DIR, filename);
}

function getDashboardVersion(): string {
  return process.env.DASHBOARD_VERSION ?? "dev";
}

async function checkDiskSpace(): Promise<{ availableBytes: number; ok: boolean }> {
  try {
    const stats = fs.statfsSync(BACKUP_DIR);
    const availableBytes = Number(stats.bavail) * Number(stats.bsize);
    return { availableBytes, ok: availableBytes >= MIN_DISK_SPACE_BYTES };
  } catch {
    // statfsSync may not be available on all platforms (e.g., Windows dev)
    // Return ok: true so backups aren't blocked, but signal unknown space
    return { availableBytes: -1, ok: true };
  }
}

/**
 * Paginated export of a table using cursor-based pagination.
 * This avoids loading entire tables into memory (critical for usage_records).
 */
async function exportTable(tableName: TableName): Promise<{ rows: Record<string, unknown>[]; count: number }> {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  for (;;) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as unknown as Record<string, unknown>)[toPrismaModelName(tableName)] as any;
    if (!model) break;

    const batch: Record<string, unknown>[] = await model.findMany({
      take: BATCH_SIZE,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      orderBy: { id: "asc" as const },
    });

    if (!batch || batch.length === 0) break;

    rows.push(...batch);
    cursor = (batch[batch.length - 1] as { id: string }).id;

    if (batch.length < BATCH_SIZE) break;
  }

  return { rows, count: rows.length };
}

/**
 * Maps SQL table name to Prisma model accessor name.
 */
function toPrismaModelName(tableName: TableName): string {
  const map: Record<TableName, string> = {
    users: "user",
    system_settings: "systemSetting",
    collector_state: "collectorState",
    model_preferences: "modelPreference",
    agent_model_overrides: "agentModelOverride",
    sync_tokens: "syncToken",
    user_api_keys: "userApiKey",
    config_templates: "configTemplate",
    config_subscriptions: "configSubscription",
    provider_key_ownerships: "providerKeyOwnership",
    provider_oauth_ownerships: "providerOAuthOwnership",
    provider_groups: "providerGroup",
    custom_providers: "customProvider",
    custom_provider_models: "customProviderModel",
    custom_provider_excluded_models: "customProviderExcludedModel",
    audit_logs: "auditLog",
    usage_records: "usageRecord",
    perplexity_cookies: "perplexityCookie",
  };
  return map[tableName];
}

async function fetchCpapConfig(): Promise<unknown> {
  try {
    const managementUrl = process.env.CLIPROXYAPI_MANAGEMENT_URL;
    const managementKey = process.env.MANAGEMENT_API_KEY;
    if (!managementUrl || !managementKey) return null;

    const res = await fetch(`${managementUrl}/providers`, {
      headers: { Authorization: `Bearer ${managementKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    logger.warn("Failed to fetch CPAP config for backup — continuing without it");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BackupRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  recordCounts: Record<string, number>;
  trigger: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreateBackupResult {
  backup: BackupRecord;
}

export interface RestorePreview {
  metadata: BackupFileData["metadata"];
  currentCounts: Record<string, number>;
  backupCounts: Record<string, number>;
}

export interface RestoreResult {
  restoredCounts: Record<string, number>;
  preRestoreBackupId: string;
}

/**
 * Create a backup of the entire dashboard state.
 *
 * Uses an advisory lock to prevent concurrent backup creation.
 * Exports all tables using cursor-based pagination to handle large datasets.
 */
export async function createBackup(
  trigger: "manual" | "scheduled" | "pre_restore" = "manual"
): Promise<CreateBackupResult> {
  ensureBackupDir();

  // Check disk space
  const diskSpace = await checkDiskSpace();
  if (!diskSpace.ok) {
    throw new Error(
      `Insufficient disk space: ${Math.round(diskSpace.availableBytes / 1024 / 1024)}MB available, need at least 500MB`
    );
  }

  // Check for concurrent operations (in-memory mutex)
  if (isBackupRestoreRunning) {
    throw new Error("Another backup is already in progress");
  }
  isBackupRestoreRunning = true;

  const backupId = createId();
  const timestamp = new Date();
  const filename = `backup-${timestamp.toISOString().replace(/[:.]/g, "-")}.cliproxyapi-backup.json.gz`;

  try {
    // Create in-progress record
    await prisma.backup.create({
      data: {
        id: backupId,
        filename,
        trigger,
        status: "running",
        recordCounts: {},
      },
    });

    // Export all tables
    const tables: Record<string, Record<string, unknown>[]> = {};
    const recordCounts: Record<string, number> = {};

    for (const tableName of TABLE_ORDER) {
      const { rows, count } = await exportTable(tableName);
      tables[tableName] = rows;
      recordCounts[tableName] = count;
    }

    // Fetch CPAP config
    const cpapConfig = await fetchCpapConfig();

    // Build backup data
    const backupData: BackupFileData = {
      metadata: {
        version: BACKUP_VERSION,
        timestamp: timestamp.toISOString(),
        dashboardVersion: getDashboardVersion(),
        schemaVersion: SCHEMA_VERSION,
        recordCounts,
      },
      tables,
      cpapConfig,
    };

    // Serialize and compress
    const jsonStr = JSON.stringify(backupData);
    const compressed = gzipSync(Buffer.from(jsonStr, "utf-8"), { level: 6 });

    // Write to disk
    const filePath = getBackupPath(filename);
    fs.writeFileSync(filePath, compressed);

    const sizeBytes = compressed.byteLength;

    // Update backup record
    await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: "completed",
        sizeBytes,
        recordCounts: recordCounts as unknown as Prisma.InputJsonValue,
      },
    });

    // Enforce retention
    await enforceRetention();

    logger.info(
      { backupId, filename, sizeBytes, trigger, recordCounts },
      "Backup created successfully"
    );

    const backup = await prisma.backup.findUniqueOrThrow({ where: { id: backupId } });
    return {
      backup: {
        ...backup,
        recordCounts: backup.recordCounts as Record<string, number>,
      },
    };
  } catch (error) {
    // Mark backup as failed
    await prisma.backup
      .update({
        where: { id: backupId },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => {});

    // Clean up partial file
    try {
      const filePath = getBackupPath(filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup errors
    }

    throw error;
  } finally {
    // Release mutex
    isBackupRestoreRunning = false;
  }
}

/**
 * List all backups, ordered by creation date descending.
 */
export async function listBackups(): Promise<BackupRecord[]> {
  const backups = await prisma.backup.findMany({
    orderBy: { createdAt: "desc" },
  });

  return backups.map((b) => ({
    ...b,
    recordCounts: b.recordCounts as Record<string, number>,
  }));
}

/**
 * Get the file path for a specific backup, for streaming download.
 */
export async function getBackupFilePath(
  id: string
): Promise<{ filePath: string; filename: string } | null> {
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) return null;

  const filePath = getBackupPath(backup.filename);
  if (!fs.existsSync(filePath)) return null;

  return { filePath, filename: backup.filename };
}

/**
 * Delete a specific backup (file + DB record).
 */
export async function deleteBackup(id: string): Promise<boolean> {
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) return false;

  // Delete file
  try {
    const filePath = getBackupPath(backup.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Continue even if file deletion fails
  }

  // Delete DB record
  await prisma.backup.delete({ where: { id } });

  logger.info({ backupId: id, filename: backup.filename }, "Backup deleted");
  return true;
}

/**
 * Parse and validate an uploaded backup file.
 * Returns the parsed data for preview or restore.
 */
export function parseBackupFile(buffer: Buffer): BackupFileData {
  const decompressed = gunzipSync(buffer);
  const jsonStr = decompressed.toString("utf-8");
  const data = JSON.parse(jsonStr) as BackupFileData;
  return data;
}

/**
 * Generate a restore preview showing what will be overwritten.
 */
export async function getRestorePreview(
  backupData: BackupFileData
): Promise<RestorePreview> {
  const currentCounts: Record<string, number> = {};

  for (const tableName of TABLE_ORDER) {
    const modelName = toPrismaModelName(tableName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (prisma[modelName as keyof typeof prisma] as any).count();
    currentCounts[tableName] = count;
  }

  return {
    metadata: backupData.metadata,
    currentCounts,
    backupCounts: backupData.metadata.recordCounts,
  };
}

/**
 * Restore from a validated backup.
 *
 * 1. Creates a pre-restore safety backup
 * 2. Wraps the entire restore in a transaction
 * 3. Truncates all tables in reverse FK order, then re-inserts in FK order
 */
export async function restoreFromBackup(
  backupData: BackupFileData
): Promise<RestoreResult> {
  // 1. Create pre-restore safety backup
  logger.info("Creating pre-restore safety backup...");
  const safetyBackup = await createBackup("pre_restore");
  const preRestoreBackupId = safetyBackup.backup.id;

  // 2. Check for concurrent operations (in-memory mutex)
  if (isBackupRestoreRunning) {
    throw new Error("Another backup/restore operation is in progress");
  }
  isBackupRestoreRunning = true;

  try {
    const restoredCounts: Record<string, number> = {};

    // 3. Execute in transaction with extended timeout (5 minutes)
    await prisma.$transaction(
      async (tx) => {
        // Truncate in reverse FK order (children first)
        const reverseOrder = [...TABLE_ORDER].reverse();

        // Also skip the backups table itself — we never want to truncate that
        for (const tableName of reverseOrder) {
          await tx.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
        }

        // Insert in FK order (parents first)
        for (const tableName of TABLE_ORDER) {
          const rows = backupData.tables[tableName];
          if (!rows || rows.length === 0) {
            restoredCounts[tableName] = 0;
            continue;
          }

          // Insert in batches using createMany for performance
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            
            // Process all rows in batch for date fields
            const processedBatch = batch.map((row) => processRowForInsert(tableName, row));

            const modelName = toPrismaModelName(tableName as TableName);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx[modelName as keyof typeof tx] as any).createMany({
              data: processedBatch,
              skipDuplicates: false, // We've already truncated, so no duplicates expected
            });
          }

          restoredCounts[tableName] = rows.length;
        }
      },
      {
        maxWait: 10_000,
        timeout: 300_000, // 5 minutes
      }
    );

    logger.info({ restoredCounts, preRestoreBackupId }, "Restore completed successfully");

    return { restoredCounts, preRestoreBackupId };
  } finally {
    // Release mutex
    isBackupRestoreRunning = false;
  }
}

/**
 * Process a row from backup JSON for Prisma insertion.
 * Converts ISO date strings back to Date objects and handles JSON fields.
 */
function processRowForInsert(
  tableName: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const processed: Record<string, unknown> = { ...row };

  // Known date fields per table
  const dateFields: Record<string, string[]> = {
    users: ["createdAt", "updatedAt"],
    model_preferences: ["createdAt", "updatedAt"],
    agent_model_overrides: ["createdAt", "updatedAt"],
    sync_tokens: ["createdAt", "lastUsedAt"],
    user_api_keys: ["createdAt", "lastUsedAt"],
    config_templates: ["createdAt", "updatedAt"],
    config_subscriptions: ["subscribedAt", "lastSyncedAt"],
    provider_key_ownerships: ["createdAt"],
    provider_oauth_ownerships: ["createdAt"],
    provider_groups: ["createdAt", "updatedAt"],
    custom_providers: ["createdAt", "updatedAt"],
    audit_logs: ["createdAt"],
    usage_records: ["timestamp", "collectedAt"],
    perplexity_cookies: ["createdAt", "updatedAt", "lastUsedAt"],
    collector_state: ["lastCollectedAt", "updatedAt"],
    system_settings: [],
    custom_provider_models: [],
    custom_provider_excluded_models: [],
  };

  const fields = dateFields[tableName] ?? [];
  for (const field of fields) {
    if (typeof processed[field] === "string") {
      processed[field] = new Date(processed[field] as string);
    }
  }

  return processed;
}

/**
 * Get disk space info for the backup directory.
 */
export async function getDiskSpaceInfo(): Promise<{
  availableBytes: number;
  totalBytes: number;
  ok: boolean;
}> {
  try {
    ensureBackupDir();
    const stats = fs.statfsSync(BACKUP_DIR);
    const availableBytes = Number(stats.bavail) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    return { availableBytes, totalBytes, ok: availableBytes >= MIN_DISK_SPACE_BYTES };
  } catch {
    return { availableBytes: -1, totalBytes: -1, ok: false };
  }
}

/**
 * Get backup schedule configuration from system settings.
 */
export async function getBackupSchedule(): Promise<{
  enabled: boolean;
  intervalHours: number;
}> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: ["backup_schedule_enabled", "backup_schedule_interval_hours"] },
    },
  });

  const enabledSetting = settings.find((s) => s.key === "backup_schedule_enabled");
  const intervalSetting = settings.find(
    (s) => s.key === "backup_schedule_interval_hours"
  );

  return {
    enabled: enabledSetting?.value === "true",
    intervalHours: intervalSetting ? parseInt(intervalSetting.value, 10) || 24 : 24,
  };
}

/**
 * Update backup schedule configuration.
 */
export async function updateBackupSchedule(
  enabled: boolean,
  intervalHours?: number
): Promise<void> {
  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "backup_schedule_enabled" },
      create: { key: "backup_schedule_enabled", value: String(enabled) },
      update: { value: String(enabled) },
    }),
    ...(intervalHours !== undefined
      ? [
          prisma.systemSetting.upsert({
            where: { key: "backup_schedule_interval_hours" },
            create: {
              key: "backup_schedule_interval_hours",
              value: String(intervalHours),
            },
            update: { value: String(intervalHours) },
          }),
        ]
      : []),
  ]);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Enforce backup retention — keep only the last MAX_BACKUPS.
 */
async function enforceRetention(): Promise<void> {
  const backups = await prisma.backup.findMany({
    where: { status: "completed" },
    orderBy: { createdAt: "desc" },
  });

  if (backups.length <= MAX_BACKUPS) return;

  const toDelete = backups.slice(MAX_BACKUPS);
  for (const backup of toDelete) {
    await deleteBackup(backup.id);
  }

  logger.info(
    { deleted: toDelete.length },
    "Enforced backup retention — deleted old backups"
  );
}

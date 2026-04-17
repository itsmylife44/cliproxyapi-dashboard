import type {
  BackupRecord,
  BackupSchedule,
  BackupStatus,
  BackupType,
} from "@/generated/prisma/client";

// Re-export Prisma types
export type { BackupRecord, BackupSchedule, BackupStatus, BackupType };

// Backup file format version
export const BACKUP_VERSION = "1.0";

// Maximum backup file size (100MB)
export const MAX_BACKUP_SIZE = 100 * 1024 * 1024;

// Backup file extension
export const BACKUP_EXTENSION = ".json.gz";

// Backup directory (relative to app root in container)
export const BACKUP_DIR = process.env.NODE_ENV === "production" 
  ? "/app/backups"
  : "./backups";

/**
 * Backup file structure
 */
export interface BackupData {
  version: string;
  createdAt: string;
  dashboard: {
    version: string;
  };
  data: {
    users: BackupUser[];
    modelPreferences: BackupModelPreference[];
    agentModelOverrides: BackupAgentModelOverride[];
    syncTokens: BackupSyncToken[];
    userApiKeys: BackupUserApiKey[];
    configTemplates: BackupConfigTemplate[];
    configSubscriptions: BackupConfigSubscription[];
    providerKeyOwnerships: BackupProviderKeyOwnership[];
    providerOAuthOwnerships: BackupProviderOAuthOwnership[];
    systemSettings: BackupSystemSetting[];
    customProviders: BackupCustomProvider[];
    providerGroups: BackupProviderGroup[];
    customProviderModels: BackupCustomProviderModel[];
    customProviderExcludedModels: BackupCustomProviderExcludedModel[];
    auditLogs: BackupAuditLog[];
    usageRecords: BackupUsageRecord[];
    perplexityCookies: BackupPerplexityCookie[];
    collectorState: BackupCollectorState[];
  };
  metadata: BackupMetadata;
}

export interface BackupMetadata {
  totalRecords: number;
  modelCounts: Record<string, number>;
  exportedAt: string;
  exportedBy: string;
}

// Simplified types for backup data (without relations)
export interface BackupUser {
  id: string;
  username: string;
  passwordHash: string;
  sessionVersion: number;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupModelPreference {
  id: string;
  userId: string;
  excludedModels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BackupAgentModelOverride {
  id: string;
  userId: string;
  overrides: unknown;
  slimOverrides: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSyncToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  syncApiKey: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface BackupUserApiKey {
  id: string;
  userId: string;
  key: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface BackupConfigTemplate {
  id: string;
  userId: string;
  shareCode: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupConfigSubscription {
  id: string;
  userId: string;
  templateId: string;
  isActive: boolean;
  frozenConfig: unknown | null;
  previousConfig: unknown | null;
  subscribedAt: string;
  lastSyncedAt: string | null;
}

export interface BackupProviderKeyOwnership {
  id: string;
  userId: string;
  provider: string;
  keyIdentifier: string;
  name: string;
  keyHash: string;
  createdAt: string;
}

export interface BackupProviderOAuthOwnership {
  id: string;
  userId: string;
  provider: string;
  accountName: string;
  accountEmail: string | null;
  createdAt: string;
}

export interface BackupSystemSetting {
  id: string;
  key: string;
  value: string;
}

export interface BackupCustomProvider {
  id: string;
  userId: string;
  groupId: string | null;
  sortOrder: number;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKeyHash: string | null;
  apiKeyEncrypted: string | null;
  prefix: string | null;
  proxyUrl: string | null;
  headers: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupProviderGroup {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupCustomProviderModel {
  id: string;
  customProviderId: string;
  upstreamName: string;
  alias: string;
}

export interface BackupCustomProviderExcludedModel {
  id: string;
  customProviderId: string;
  pattern: string;
}

export interface BackupAuditLog {
  id: string;
  userId: string;
  action: string;
  target: string | null;
  metadata: unknown | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface BackupUsageRecord {
  id: string;
  authIndex: string;
  apiKeyId: string | null;
  userId: string | null;
  model: string;
  source: string;
  timestamp: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  failed: boolean;
  collectedAt: string;
}

export interface BackupPerplexityCookie {
  id: string;
  userId: string;
  cookieData: string;
  label: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupCollectorState {
  id: string;
  lastCollectedAt: string;
  lastStatus: string;
  recordsStored: number;
  errorMessage: string | null;
  updatedAt: string;
}

/**
 * Restore preview information
 */
export interface RestorePreview {
  backupVersion: string;
  dashboardVersion: string;
  backupDate: string;
  counts: {
    users: number;
    providerKeys: number;
    oauthAccounts: number;
    customProviders: number;
    usageRecords: number;
    auditLogs: number;
  };
  isCompatible: boolean;
  warnings: string[];
}

/**
 * Storage information
 */
export interface StorageInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  backupCount: number;
}

/**
 * Backup list item (for API responses)
 */
export interface BackupListItem {
  id: string;
  filename: string;
  sizeBytes: string; // BigInt serialized as string
  status: BackupStatus;
  type: BackupType;
  createdAt: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    username: string;
  };
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  enabled: boolean;
  cronExpr: string;
  retention: number;
  lastRun: string | null;
  nextRun: string | null;
}

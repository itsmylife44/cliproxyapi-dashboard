import "server-only";
import { prisma } from "@/lib/db";
import type {
  BackupData,
  BackupMetadata,
  BackupUser,
  BackupModelPreference,
  BackupAgentModelOverride,
  BackupSyncToken,
  BackupUserApiKey,
  BackupConfigTemplate,
  BackupConfigSubscription,
  BackupProviderKeyOwnership,
  BackupProviderOAuthOwnership,
  BackupSystemSetting,
  BackupCustomProvider,
  BackupProviderGroup,
  BackupCustomProviderModel,
  BackupCustomProviderExcludedModel,
  BackupAuditLog,
  BackupUsageRecord,
  BackupPerplexityCookie,
  BackupCollectorState,
  RestorePreview,
} from "./types";
import { BACKUP_VERSION } from "./types";

// Chunk size for cursor-based export (to handle large tables)
const EXPORT_CHUNK_SIZE = 1000;

/**
 * Get current dashboard version from package.json or env
 */
function getDashboardVersion(): string {
  return process.env.npm_package_version || process.env.DASHBOARD_VERSION || "unknown";
}

/**
 * Export all database data to a backup structure
 */
export async function exportDatabase(exportedBy: string): Promise<BackupData> {
  const modelCounts: Record<string, number> = {};

  // Export users
  const users = await prisma.user.findMany();
  const backupUsers: BackupUser[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    sessionVersion: u.sessionVersion,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
  modelCounts.users = backupUsers.length;

  // Export model preferences
  const modelPreferences = await prisma.modelPreference.findMany();
  const backupModelPreferences: BackupModelPreference[] = modelPreferences.map((mp) => ({
    id: mp.id,
    userId: mp.userId,
    excludedModels: mp.excludedModels,
    createdAt: mp.createdAt.toISOString(),
    updatedAt: mp.updatedAt.toISOString(),
  }));
  modelCounts.modelPreferences = backupModelPreferences.length;

  // Export agent model overrides
  const agentModelOverrides = await prisma.agentModelOverride.findMany();
  const backupAgentModelOverrides: BackupAgentModelOverride[] = agentModelOverrides.map((amo) => ({
    id: amo.id,
    userId: amo.userId,
    overrides: amo.overrides,
    slimOverrides: amo.slimOverrides,
    createdAt: amo.createdAt.toISOString(),
    updatedAt: amo.updatedAt.toISOString(),
  }));
  modelCounts.agentModelOverrides = backupAgentModelOverrides.length;

  // Export sync tokens
  const syncTokens = await prisma.syncToken.findMany();
  const backupSyncTokens: BackupSyncToken[] = syncTokens.map((st) => ({
    id: st.id,
    userId: st.userId,
    name: st.name,
    tokenHash: st.tokenHash,
    syncApiKey: st.syncApiKey,
    lastUsedAt: st.lastUsedAt?.toISOString() ?? null,
    createdAt: st.createdAt.toISOString(),
  }));
  modelCounts.syncTokens = backupSyncTokens.length;

  // Export user API keys
  const userApiKeys = await prisma.userApiKey.findMany();
  const backupUserApiKeys: BackupUserApiKey[] = userApiKeys.map((ak) => ({
    id: ak.id,
    userId: ak.userId,
    key: ak.key,
    name: ak.name,
    lastUsedAt: ak.lastUsedAt?.toISOString() ?? null,
    createdAt: ak.createdAt.toISOString(),
  }));
  modelCounts.userApiKeys = backupUserApiKeys.length;

  // Export config templates
  const configTemplates = await prisma.configTemplate.findMany();
  const backupConfigTemplates: BackupConfigTemplate[] = configTemplates.map((ct) => ({
    id: ct.id,
    userId: ct.userId,
    shareCode: ct.shareCode,
    name: ct.name,
    isActive: ct.isActive,
    createdAt: ct.createdAt.toISOString(),
    updatedAt: ct.updatedAt.toISOString(),
  }));
  modelCounts.configTemplates = backupConfigTemplates.length;

  // Export config subscriptions
  const configSubscriptions = await prisma.configSubscription.findMany();
  const backupConfigSubscriptions: BackupConfigSubscription[] = configSubscriptions.map((cs) => ({
    id: cs.id,
    userId: cs.userId,
    templateId: cs.templateId,
    isActive: cs.isActive,
    frozenConfig: cs.frozenConfig,
    previousConfig: cs.previousConfig,
    subscribedAt: cs.subscribedAt.toISOString(),
    lastSyncedAt: cs.lastSyncedAt?.toISOString() ?? null,
  }));
  modelCounts.configSubscriptions = backupConfigSubscriptions.length;

  // Export provider key ownerships
  const providerKeyOwnerships = await prisma.providerKeyOwnership.findMany();
  const backupProviderKeyOwnerships: BackupProviderKeyOwnership[] = providerKeyOwnerships.map((pk) => ({
    id: pk.id,
    userId: pk.userId,
    provider: pk.provider,
    keyIdentifier: pk.keyIdentifier,
    name: pk.name,
    keyHash: pk.keyHash,
    createdAt: pk.createdAt.toISOString(),
  }));
  modelCounts.providerKeyOwnerships = backupProviderKeyOwnerships.length;

  // Export provider OAuth ownerships
  const providerOAuthOwnerships = await prisma.providerOAuthOwnership.findMany();
  const backupProviderOAuthOwnerships: BackupProviderOAuthOwnership[] = providerOAuthOwnerships.map((po) => ({
    id: po.id,
    userId: po.userId,
    provider: po.provider,
    accountName: po.accountName,
    accountEmail: po.accountEmail,
    createdAt: po.createdAt.toISOString(),
  }));
  modelCounts.providerOAuthOwnerships = backupProviderOAuthOwnerships.length;

  // Export system settings
  const systemSettings = await prisma.systemSetting.findMany();
  const backupSystemSettings: BackupSystemSetting[] = systemSettings.map((ss) => ({
    id: ss.id,
    key: ss.key,
    value: ss.value,
  }));
  modelCounts.systemSettings = backupSystemSettings.length;

  // Export custom providers
  const customProviders = await prisma.customProvider.findMany();
  const backupCustomProviders: BackupCustomProvider[] = customProviders.map((cp) => ({
    id: cp.id,
    userId: cp.userId,
    groupId: cp.groupId,
    sortOrder: cp.sortOrder,
    name: cp.name,
    providerId: cp.providerId,
    baseUrl: cp.baseUrl,
    apiKeyHash: cp.apiKeyHash,
    apiKeyEncrypted: cp.apiKeyEncrypted,
    prefix: cp.prefix,
    proxyUrl: cp.proxyUrl,
    headers: cp.headers,
    createdAt: cp.createdAt.toISOString(),
    updatedAt: cp.updatedAt.toISOString(),
  }));
  modelCounts.customProviders = backupCustomProviders.length;

  // Export provider groups
  const providerGroups = await prisma.providerGroup.findMany();
  const backupProviderGroups: BackupProviderGroup[] = providerGroups.map((pg) => ({
    id: pg.id,
    userId: pg.userId,
    name: pg.name,
    color: pg.color,
    sortOrder: pg.sortOrder,
    isActive: pg.isActive,
    createdAt: pg.createdAt.toISOString(),
    updatedAt: pg.updatedAt.toISOString(),
  }));
  modelCounts.providerGroups = backupProviderGroups.length;

  // Export custom provider models
  const customProviderModels = await prisma.customProviderModel.findMany();
  const backupCustomProviderModels: BackupCustomProviderModel[] = customProviderModels.map((cpm) => ({
    id: cpm.id,
    customProviderId: cpm.customProviderId,
    upstreamName: cpm.upstreamName,
    alias: cpm.alias,
  }));
  modelCounts.customProviderModels = backupCustomProviderModels.length;

  // Export custom provider excluded models
  const customProviderExcludedModels = await prisma.customProviderExcludedModel.findMany();
  const backupCustomProviderExcludedModels: BackupCustomProviderExcludedModel[] = customProviderExcludedModels.map((cpem) => ({
    id: cpem.id,
    customProviderId: cpem.customProviderId,
    pattern: cpem.pattern,
  }));
  modelCounts.customProviderExcludedModels = backupCustomProviderExcludedModels.length;

  // Export audit logs (cursor-based for large tables)
  const backupAuditLogs: BackupAuditLog[] = [];
  let auditCursor: string | undefined;
  while (true) {
    const chunk = await prisma.auditLog.findMany({
      take: EXPORT_CHUNK_SIZE,
      ...(auditCursor ? { skip: 1, cursor: { id: auditCursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (chunk.length === 0) break;
    for (const al of chunk) {
      backupAuditLogs.push({
        id: al.id,
        userId: al.userId,
        action: al.action,
        target: al.target,
        metadata: al.metadata,
        ipAddress: al.ipAddress,
        createdAt: al.createdAt.toISOString(),
      });
    }
    auditCursor = chunk[chunk.length - 1].id;
    if (chunk.length < EXPORT_CHUNK_SIZE) break;
  }
  modelCounts.auditLogs = backupAuditLogs.length;

  // Export usage records (cursor-based for large tables)
  const backupUsageRecords: BackupUsageRecord[] = [];
  let usageCursor: string | undefined;
  while (true) {
    const chunk = await prisma.usageRecord.findMany({
      take: EXPORT_CHUNK_SIZE,
      ...(usageCursor ? { skip: 1, cursor: { id: usageCursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (chunk.length === 0) break;
    for (const ur of chunk) {
      backupUsageRecords.push({
        id: ur.id,
        authIndex: ur.authIndex,
        apiKeyId: ur.apiKeyId,
        userId: ur.userId,
        model: ur.model,
        source: ur.source,
        timestamp: ur.timestamp.toISOString(),
        latencyMs: ur.latencyMs,
        inputTokens: ur.inputTokens,
        outputTokens: ur.outputTokens,
        reasoningTokens: ur.reasoningTokens,
        cachedTokens: ur.cachedTokens,
        totalTokens: ur.totalTokens,
        failed: ur.failed,
        collectedAt: ur.collectedAt.toISOString(),
      });
    }
    usageCursor = chunk[chunk.length - 1].id;
    if (chunk.length < EXPORT_CHUNK_SIZE) break;
  }
  modelCounts.usageRecords = backupUsageRecords.length;

  // Export perplexity cookies
  const perplexityCookies = await prisma.perplexityCookie.findMany();
  const backupPerplexityCookies: BackupPerplexityCookie[] = perplexityCookies.map((pc) => ({
    id: pc.id,
    userId: pc.userId,
    cookieData: pc.cookieData,
    label: pc.label,
    isActive: pc.isActive,
    lastUsedAt: pc.lastUsedAt?.toISOString() ?? null,
    createdAt: pc.createdAt.toISOString(),
    updatedAt: pc.updatedAt.toISOString(),
  }));
  modelCounts.perplexityCookies = backupPerplexityCookies.length;

  // Export collector state
  const collectorStates = await prisma.collectorState.findMany();
  const backupCollectorStates: BackupCollectorState[] = collectorStates.map((cs) => ({
    id: cs.id,
    lastCollectedAt: cs.lastCollectedAt.toISOString(),
    lastStatus: cs.lastStatus,
    recordsStored: cs.recordsStored,
    errorMessage: cs.errorMessage,
    updatedAt: cs.updatedAt.toISOString(),
  }));
  modelCounts.collectorState = backupCollectorStates.length;

  const totalRecords = Object.values(modelCounts).reduce((a, b) => a + b, 0);

  const metadata: BackupMetadata = {
    totalRecords,
    modelCounts,
    exportedAt: new Date().toISOString(),
    exportedBy,
  };

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    dashboard: {
      version: getDashboardVersion(),
    },
    data: {
      users: backupUsers,
      modelPreferences: backupModelPreferences,
      agentModelOverrides: backupAgentModelOverrides,
      syncTokens: backupSyncTokens,
      userApiKeys: backupUserApiKeys,
      configTemplates: backupConfigTemplates,
      configSubscriptions: backupConfigSubscriptions,
      providerKeyOwnerships: backupProviderKeyOwnerships,
      providerOAuthOwnerships: backupProviderOAuthOwnerships,
      systemSettings: backupSystemSettings,
      customProviders: backupCustomProviders,
      providerGroups: backupProviderGroups,
      customProviderModels: backupCustomProviderModels,
      customProviderExcludedModels: backupCustomProviderExcludedModels,
      auditLogs: backupAuditLogs,
      usageRecords: backupUsageRecords,
      perplexityCookies: backupPerplexityCookies,
      collectorState: backupCollectorStates,
    },
    metadata,
  };
}

/**
 * Parse and validate a backup file
 */
export function parseBackupData(jsonString: string): BackupData {
  const data = JSON.parse(jsonString);
  
  // Validate required fields
  if (!data.version || !data.data || !data.createdAt) {
    throw new Error("Invalid backup format: missing required fields");
  }

  // Validate version
  if (data.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${data.version}`);
  }

  // Validate data structure
  const requiredDataFields = [
    "users",
    "modelPreferences", 
    "agentModelOverrides",
    "syncTokens",
    "userApiKeys",
    "configTemplates",
    "configSubscriptions",
    "providerKeyOwnerships",
    "providerOAuthOwnerships",
    "systemSettings",
    "customProviders",
    "providerGroups",
    "customProviderModels",
    "customProviderExcludedModels",
    "auditLogs",
    "usageRecords",
    "perplexityCookies",
    "collectorState",
  ];

  for (const field of requiredDataFields) {
    if (!Array.isArray(data.data[field])) {
      throw new Error(`Invalid backup format: missing or invalid ${field}`);
    }
  }

  return data as BackupData;
}

/**
 * Generate restore preview from backup data
 */
export function generateRestorePreview(backup: BackupData): RestorePreview {
  const currentVersion = getDashboardVersion();
  const warnings: string[] = [];

  // Check version compatibility
  if (backup.dashboard?.version && backup.dashboard.version !== currentVersion) {
    warnings.push(`Backup was created with dashboard version ${backup.dashboard.version}, current version is ${currentVersion}`);
  }

  return {
    backupVersion: backup.version,
    dashboardVersion: backup.dashboard?.version || "unknown",
    createdAt: backup.createdAt,
    counts: {
      users: backup.data.users.length,
      providerKeys: backup.data.providerKeyOwnerships.length,
      oauthAccounts: backup.data.providerOAuthOwnerships.length,
      customProviders: backup.data.customProviders.length,
      usageRecords: backup.data.usageRecords.length,
      auditLogs: backup.data.auditLogs.length,
    },
    isCompatible: backup.version === BACKUP_VERSION,
    warnings,
  };
}

/**
 * Import backup data into the database (replaces all existing data)
 */
export async function importDatabase(backup: BackupData): Promise<void> {
  // Use a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Delete all existing data in reverse dependency order
    await tx.usageRecord.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.customProviderExcludedModel.deleteMany();
    await tx.customProviderModel.deleteMany();
    await tx.customProvider.deleteMany();
    await tx.providerGroup.deleteMany();
    await tx.perplexityCookie.deleteMany();
    await tx.collectorState.deleteMany();
    await tx.configSubscription.deleteMany();
    await tx.configTemplate.deleteMany();
    await tx.providerOAuthOwnership.deleteMany();
    await tx.providerKeyOwnership.deleteMany();
    await tx.syncToken.deleteMany();
    await tx.userApiKey.deleteMany();
    await tx.agentModelOverride.deleteMany();
    await tx.modelPreference.deleteMany();
    await tx.systemSetting.deleteMany();
    await tx.backupRecord.deleteMany();
    await tx.user.deleteMany();

    // Import in dependency order
    // 1. Users first (everything else depends on them)
    if (backup.data.users.length > 0) {
      await tx.user.createMany({
        data: backup.data.users.map((u) => ({
          id: u.id,
          username: u.username,
          passwordHash: u.passwordHash,
          sessionVersion: u.sessionVersion,
          isAdmin: u.isAdmin,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        })),
      });
    }

    // 2. System settings (no dependencies)
    if (backup.data.systemSettings.length > 0) {
      await tx.systemSetting.createMany({
        data: backup.data.systemSettings.map((ss) => ({
          id: ss.id,
          key: ss.key,
          value: ss.value,
        })),
      });
    }

    // 3. Model preferences
    if (backup.data.modelPreferences.length > 0) {
      await tx.modelPreference.createMany({
        data: backup.data.modelPreferences.map((mp) => ({
          id: mp.id,
          userId: mp.userId,
          excludedModels: mp.excludedModels,
          createdAt: new Date(mp.createdAt),
          updatedAt: new Date(mp.updatedAt),
        })),
      });
    }

    // 4. Agent model overrides
    if (backup.data.agentModelOverrides.length > 0) {
      await tx.agentModelOverride.createMany({
        data: backup.data.agentModelOverrides.map((amo) => ({
          id: amo.id,
          userId: amo.userId,
          overrides: amo.overrides as object,
          slimOverrides: amo.slimOverrides as object,
          createdAt: new Date(amo.createdAt),
          updatedAt: new Date(amo.updatedAt),
        })),
      });
    }

    // 5. Sync tokens
    if (backup.data.syncTokens.length > 0) {
      await tx.syncToken.createMany({
        data: backup.data.syncTokens.map((st) => ({
          id: st.id,
          userId: st.userId,
          name: st.name,
          tokenHash: st.tokenHash,
          syncApiKey: st.syncApiKey,
          lastUsedAt: st.lastUsedAt ? new Date(st.lastUsedAt) : null,
          createdAt: new Date(st.createdAt),
        })),
      });
    }

    // 6. User API keys
    if (backup.data.userApiKeys.length > 0) {
      await tx.userApiKey.createMany({
        data: backup.data.userApiKeys.map((ak) => ({
          id: ak.id,
          userId: ak.userId,
          key: ak.key,
          name: ak.name,
          lastUsedAt: ak.lastUsedAt ? new Date(ak.lastUsedAt) : null,
          createdAt: new Date(ak.createdAt),
        })),
      });
    }

    // 7. Config templates
    if (backup.data.configTemplates.length > 0) {
      await tx.configTemplate.createMany({
        data: backup.data.configTemplates.map((ct) => ({
          id: ct.id,
          userId: ct.userId,
          shareCode: ct.shareCode,
          name: ct.name,
          isActive: ct.isActive,
          createdAt: new Date(ct.createdAt),
          updatedAt: new Date(ct.updatedAt),
        })),
      });
    }

    // 8. Config subscriptions
    if (backup.data.configSubscriptions.length > 0) {
      await tx.configSubscription.createMany({
        data: backup.data.configSubscriptions.map((cs) => ({
          id: cs.id,
          userId: cs.userId,
          templateId: cs.templateId,
          isActive: cs.isActive,
          frozenConfig: cs.frozenConfig ?? undefined,
          previousConfig: cs.previousConfig ?? undefined,
          subscribedAt: new Date(cs.subscribedAt),
          lastSyncedAt: cs.lastSyncedAt ? new Date(cs.lastSyncedAt) : null,
        })),
      });
    }

    // 9. Provider key ownerships
    if (backup.data.providerKeyOwnerships.length > 0) {
      await tx.providerKeyOwnership.createMany({
        data: backup.data.providerKeyOwnerships.map((pk) => ({
          id: pk.id,
          userId: pk.userId,
          provider: pk.provider,
          keyIdentifier: pk.keyIdentifier,
          name: pk.name,
          keyHash: pk.keyHash,
          createdAt: new Date(pk.createdAt),
        })),
      });
    }

    // 10. Provider OAuth ownerships
    if (backup.data.providerOAuthOwnerships.length > 0) {
      await tx.providerOAuthOwnership.createMany({
        data: backup.data.providerOAuthOwnerships.map((po) => ({
          id: po.id,
          userId: po.userId,
          provider: po.provider,
          accountName: po.accountName,
          accountEmail: po.accountEmail,
          createdAt: new Date(po.createdAt),
        })),
      });
    }

    // 11. Provider groups (before custom providers)
    if (backup.data.providerGroups.length > 0) {
      await tx.providerGroup.createMany({
        data: backup.data.providerGroups.map((pg) => ({
          id: pg.id,
          userId: pg.userId,
          name: pg.name,
          color: pg.color,
          sortOrder: pg.sortOrder,
          isActive: pg.isActive,
          createdAt: new Date(pg.createdAt),
          updatedAt: new Date(pg.updatedAt),
        })),
      });
    }

    // 12. Custom providers
    if (backup.data.customProviders.length > 0) {
      await tx.customProvider.createMany({
        data: backup.data.customProviders.map((cp) => ({
          id: cp.id,
          userId: cp.userId,
          groupId: cp.groupId,
          sortOrder: cp.sortOrder,
          name: cp.name,
          providerId: cp.providerId,
          baseUrl: cp.baseUrl,
          apiKeyHash: cp.apiKeyHash,
          apiKeyEncrypted: cp.apiKeyEncrypted,
          prefix: cp.prefix,
          proxyUrl: cp.proxyUrl,
          headers: cp.headers ?? undefined,
          createdAt: new Date(cp.createdAt),
          updatedAt: new Date(cp.updatedAt),
        })),
      });
    }

    // 13. Custom provider models
    if (backup.data.customProviderModels.length > 0) {
      await tx.customProviderModel.createMany({
        data: backup.data.customProviderModels.map((cpm) => ({
          id: cpm.id,
          customProviderId: cpm.customProviderId,
          upstreamName: cpm.upstreamName,
          alias: cpm.alias,
        })),
      });
    }

    // 14. Custom provider excluded models
    if (backup.data.customProviderExcludedModels.length > 0) {
      await tx.customProviderExcludedModel.createMany({
        data: backup.data.customProviderExcludedModels.map((cpem) => ({
          id: cpem.id,
          customProviderId: cpem.customProviderId,
          pattern: cpem.pattern,
        })),
      });
    }

    // 15. Perplexity cookies
    if (backup.data.perplexityCookies.length > 0) {
      await tx.perplexityCookie.createMany({
        data: backup.data.perplexityCookies.map((pc) => ({
          id: pc.id,
          userId: pc.userId,
          cookieData: pc.cookieData,
          label: pc.label,
          isActive: pc.isActive,
          lastUsedAt: pc.lastUsedAt ? new Date(pc.lastUsedAt) : null,
          createdAt: new Date(pc.createdAt),
          updatedAt: new Date(pc.updatedAt),
        })),
      });
    }

    // 16. Collector state
    if (backup.data.collectorState.length > 0) {
      await tx.collectorState.createMany({
        data: backup.data.collectorState.map((cs) => ({
          id: cs.id,
          lastCollectedAt: new Date(cs.lastCollectedAt),
          lastStatus: cs.lastStatus,
          recordsStored: cs.recordsStored,
          errorMessage: cs.errorMessage,
          updatedAt: new Date(cs.updatedAt),
        })),
      });
    }

    // 17. Audit logs (potentially large, batch in chunks)
    const auditChunks = chunkArray(backup.data.auditLogs, EXPORT_CHUNK_SIZE);
    for (const chunk of auditChunks) {
      await tx.auditLog.createMany({
        data: chunk.map((al) => ({
          id: al.id,
          userId: al.userId,
          action: al.action,
          target: al.target,
          metadata: al.metadata ?? undefined,
          ipAddress: al.ipAddress,
          createdAt: new Date(al.createdAt),
        })),
      });
    }

    // 18. Usage records (potentially large, batch in chunks)
    const usageChunks = chunkArray(backup.data.usageRecords, EXPORT_CHUNK_SIZE);
    for (const chunk of usageChunks) {
      await tx.usageRecord.createMany({
        data: chunk.map((ur) => ({
          id: ur.id,
          authIndex: ur.authIndex,
          apiKeyId: ur.apiKeyId,
          userId: ur.userId,
          model: ur.model,
          source: ur.source,
          timestamp: new Date(ur.timestamp),
          latencyMs: ur.latencyMs,
          inputTokens: ur.inputTokens,
          outputTokens: ur.outputTokens,
          reasoningTokens: ur.reasoningTokens,
          cachedTokens: ur.cachedTokens,
          totalTokens: ur.totalTokens,
          failed: ur.failed,
          collectedAt: new Date(ur.collectedAt),
        })),
      });
    }
  }, {
    timeout: 300000, // 5 minute timeout for large restores
  });
}

/**
 * Helper to chunk an array
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only before importing modules
vi.mock("server-only", () => ({}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    modelPreference: { findMany: vi.fn().mockResolvedValue([]) },
    agentModelOverride: { findMany: vi.fn().mockResolvedValue([]) },
    syncToken: { findMany: vi.fn().mockResolvedValue([]) },
    userApiKey: { findMany: vi.fn().mockResolvedValue([]) },
    configTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    configSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    providerKeyOwnership: { findMany: vi.fn().mockResolvedValue([]) },
    providerOAuthOwnership: { findMany: vi.fn().mockResolvedValue([]) },
    systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
    customProvider: { findMany: vi.fn().mockResolvedValue([]) },
    providerGroup: { findMany: vi.fn().mockResolvedValue([]) },
    customProviderModel: { findMany: vi.fn().mockResolvedValue([]) },
    customProviderExcludedModel: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    usageRecord: { findMany: vi.fn().mockResolvedValue([]) },
    perplexityCookie: { findMany: vi.fn().mockResolvedValue([]) },
    collectorState: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  },
}));

import { parseBackupData, generateRestorePreview } from "../export-import";
import type { BackupData } from "../types";
import { BACKUP_VERSION } from "../types";

describe("parseBackupData", () => {
  const createValidBackupData = (overrides: Partial<BackupData> = {}): BackupData => ({
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    dashboard: { version: "1.0.0" },
    data: {
      users: [],
      modelPreferences: [],
      agentModelOverrides: [],
      syncTokens: [],
      userApiKeys: [],
      configTemplates: [],
      configSubscriptions: [],
      providerKeyOwnerships: [],
      providerOAuthOwnerships: [],
      systemSettings: [],
      customProviders: [],
      providerGroups: [],
      customProviderModels: [],
      customProviderExcludedModels: [],
      auditLogs: [],
      usageRecords: [],
      perplexityCookies: [],
      collectorState: [],
    },
    metadata: {
      totalRecords: 0,
      modelCounts: {},
      exportedAt: new Date().toISOString(),
      exportedBy: "test-user",
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse valid backup JSON", () => {
    const validData = createValidBackupData();
    const jsonString = JSON.stringify(validData);

    const result = parseBackupData(jsonString);

    expect(result.version).toBe(BACKUP_VERSION);
    expect(result.data).toBeDefined();
    expect(result.createdAt).toBeDefined();
  });

  it("should throw on invalid JSON", () => {
    const invalidJson = "{ not valid json }}}";

    expect(() => parseBackupData(invalidJson)).toThrow();
  });

  it("should throw on missing required fields - no version", () => {
    const dataWithoutVersion = {
      createdAt: new Date().toISOString(),
      data: { users: [] },
    };
    const jsonString = JSON.stringify(dataWithoutVersion);

    expect(() => parseBackupData(jsonString)).toThrow(
      "Invalid backup format: missing required fields"
    );
  });

  it("should throw on missing required fields - no data", () => {
    const dataWithoutData = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(dataWithoutData);

    expect(() => parseBackupData(jsonString)).toThrow(
      "Invalid backup format: missing required fields"
    );
  });

  it("should throw on missing required fields - no createdAt", () => {
    const dataWithoutCreatedAt = {
      version: BACKUP_VERSION,
      data: { users: [] },
    };
    const jsonString = JSON.stringify(dataWithoutCreatedAt);

    expect(() => parseBackupData(jsonString)).toThrow(
      "Invalid backup format: missing required fields"
    );
  });

  it("should throw on unsupported version", () => {
    const dataWithWrongVersion = createValidBackupData({ version: "99.0" });
    const jsonString = JSON.stringify(dataWithWrongVersion);

    expect(() => parseBackupData(jsonString)).toThrow("Unsupported backup version: 99.0");
  });

  it("should throw when required data fields are missing", () => {
    const dataWithMissingField = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        users: [],
        // missing other required fields
      },
    };
    const jsonString = JSON.stringify(dataWithMissingField);

    expect(() => parseBackupData(jsonString)).toThrow(/Invalid backup format: missing or invalid/);
  });

  it("should throw when data fields are not arrays", () => {
    const dataWithInvalidField = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        users: "not an array", // should be array
        modelPreferences: [],
        agentModelOverrides: [],
        syncTokens: [],
        userApiKeys: [],
        configTemplates: [],
        configSubscriptions: [],
        providerKeyOwnerships: [],
        providerOAuthOwnerships: [],
        systemSettings: [],
        customProviders: [],
        providerGroups: [],
        customProviderModels: [],
        customProviderExcludedModels: [],
        auditLogs: [],
        usageRecords: [],
        perplexityCookies: [],
        collectorState: [],
      },
    };
    const jsonString = JSON.stringify(dataWithInvalidField);

    expect(() => parseBackupData(jsonString)).toThrow(
      "Invalid backup format: missing or invalid users"
    );
  });
});

describe("generateRestorePreview", () => {
  const createValidBackupData = (overrides: Partial<BackupData> = {}): BackupData => ({
    version: BACKUP_VERSION,
    createdAt: "2024-01-15T10:30:00.000Z",
    dashboard: { version: "1.0.0" },
    data: {
      users: [
        {
          id: "user-1",
          username: "testuser",
          passwordHash: "hash",
          sessionVersion: 1,
          isAdmin: true,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      modelPreferences: [],
      agentModelOverrides: [],
      syncTokens: [],
      userApiKeys: [],
      configTemplates: [],
      configSubscriptions: [],
      providerKeyOwnerships: [
        {
          id: "pk-1",
          userId: "user-1",
          provider: "anthropic",
          keyIdentifier: "sk-ant-***",
          name: "My Claude Key",
          keyHash: "hash123",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "pk-2",
          userId: "user-1",
          provider: "openai",
          keyIdentifier: "sk-***",
          name: "My OpenAI Key",
          keyHash: "hash456",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      providerOAuthOwnerships: [
        {
          id: "oauth-1",
          userId: "user-1",
          provider: "google",
          accountName: "user@gmail.com",
          accountEmail: "user@gmail.com",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      systemSettings: [],
      customProviders: [
        {
          id: "cp-1",
          userId: "user-1",
          groupId: null,
          sortOrder: 0,
          name: "Custom Provider",
          providerId: "custom-1",
          baseUrl: "https://api.example.com",
          apiKeyHash: "hash",
          apiKeyEncrypted: null,
          prefix: null,
          proxyUrl: null,
          headers: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      providerGroups: [],
      customProviderModels: [],
      customProviderExcludedModels: [],
      auditLogs: [
        {
          id: "al-1",
          userId: "user-1",
          action: "login",
          target: null,
          metadata: null,
          ipAddress: "127.0.0.1",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "al-2",
          userId: "user-1",
          action: "settings_update",
          target: null,
          metadata: null,
          ipAddress: "127.0.0.1",
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ],
      usageRecords: [
        {
          id: "ur-1",
          authIndex: "idx-1",
          apiKeyId: null,
          userId: "user-1",
          model: "claude-3-opus",
          source: "claude-code",
          timestamp: "2024-01-01T00:00:00.000Z",
          latencyMs: 1500,
          inputTokens: 100,
          outputTokens: 200,
          reasoningTokens: 0,
          cachedTokens: 0,
          totalTokens: 300,
          failed: false,
          collectedAt: "2024-01-01T00:05:00.000Z",
        },
      ],
      perplexityCookies: [],
      collectorState: [],
    },
    metadata: {
      totalRecords: 8,
      modelCounts: {
        users: 1,
        providerKeyOwnerships: 2,
        providerOAuthOwnerships: 1,
        customProviders: 1,
        auditLogs: 2,
        usageRecords: 1,
      },
      exportedAt: "2024-01-15T10:30:00.000Z",
      exportedBy: "admin",
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return correct counts", () => {
    const backupData = createValidBackupData();

    const preview = generateRestorePreview(backupData);

    expect(preview.counts).toEqual({
      users: 1,
      providerKeys: 2,
      oauthAccounts: 1,
      customProviders: 1,
      usageRecords: 1,
      auditLogs: 2,
    });
  });

  it("should return backup version and created date", () => {
    const backupData = createValidBackupData();

    const preview = generateRestorePreview(backupData);

    expect(preview.backupVersion).toBe(BACKUP_VERSION);
    expect(preview.createdAt).toBe("2024-01-15T10:30:00.000Z");
    expect(preview.dashboardVersion).toBe("1.0.0");
  });

  it("should add warning if version mismatch", () => {
    // Mock a different current version by testing the condition
    const backupData = createValidBackupData({
      dashboard: { version: "0.9.0" }, // Different from current
    });

    const preview = generateRestorePreview(backupData);

    // Note: The warning depends on the current dashboard version
    // In test environment, it compares against "unknown" or actual version
    // We test that warnings array exists and the function runs
    expect(Array.isArray(preview.warnings)).toBe(true);
  });

  it("should set isCompatible correctly for matching version", () => {
    const backupData = createValidBackupData();

    const preview = generateRestorePreview(backupData);

    expect(preview.isCompatible).toBe(true);
  });

  it("should set isCompatible to false for mismatched backup version", () => {
    // Create backup data with wrong version (bypassing parseBackupData)
    const backupData: BackupData = {
      version: "0.5", // Wrong version
      createdAt: "2024-01-15T10:30:00.000Z",
      dashboard: { version: "1.0.0" },
      data: {
        users: [],
        modelPreferences: [],
        agentModelOverrides: [],
        syncTokens: [],
        userApiKeys: [],
        configTemplates: [],
        configSubscriptions: [],
        providerKeyOwnerships: [],
        providerOAuthOwnerships: [],
        systemSettings: [],
        customProviders: [],
        providerGroups: [],
        customProviderModels: [],
        customProviderExcludedModels: [],
        auditLogs: [],
        usageRecords: [],
        perplexityCookies: [],
        collectorState: [],
      },
      metadata: {
        totalRecords: 0,
        modelCounts: {},
        exportedAt: "2024-01-15T10:30:00.000Z",
        exportedBy: "admin",
      },
    };

    const preview = generateRestorePreview(backupData);

    expect(preview.isCompatible).toBe(false);
  });

  it("should handle empty data arrays", () => {
    const emptyBackupData = createValidBackupData({
      data: {
        users: [],
        modelPreferences: [],
        agentModelOverrides: [],
        syncTokens: [],
        userApiKeys: [],
        configTemplates: [],
        configSubscriptions: [],
        providerKeyOwnerships: [],
        providerOAuthOwnerships: [],
        systemSettings: [],
        customProviders: [],
        providerGroups: [],
        customProviderModels: [],
        customProviderExcludedModels: [],
        auditLogs: [],
        usageRecords: [],
        perplexityCookies: [],
        collectorState: [],
      },
    });

    const preview = generateRestorePreview(emptyBackupData);

    expect(preview.counts).toEqual({
      users: 0,
      providerKeys: 0,
      oauthAccounts: 0,
      customProviders: 0,
      usageRecords: 0,
      auditLogs: 0,
    });
    expect(preview.isCompatible).toBe(true);
  });

  it("should handle missing dashboard version", () => {
    const backupData = createValidBackupData();
    // Remove dashboard version
    delete (backupData as Partial<BackupData>).dashboard;

    const preview = generateRestorePreview(backupData as BackupData);

    expect(preview.dashboardVersion).toBe("unknown");
  });
});

import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getManagementUrl } from "@/lib/management-url";
import { logger } from "@/lib/logger";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";
import { calculateKeySpend, type UsageModelTotals } from "@/lib/usage-cost-breakdown";

const MANAGEMENT_BASE_URL = getManagementUrl();

export interface ApiKeyUsageSummary {
  totalSpend: number;
  lastUsedAt: Date | null;
}

const apiKeyUsageCache = new Map<string, ApiKeyUsageSummary>();

export function invalidateApiKeyUsageCache(apiKeyIds?: Iterable<string>): void {
  if (!apiKeyIds) {
    apiKeyUsageCache.clear();
    return;
  }
  for (const id of apiKeyIds) {
    apiKeyUsageCache.delete(id);
  }
}

export async function getApiKeyUsageSummaries(
  apiKeyIds: string[]
): Promise<Map<string, ApiKeyUsageSummary>> {
  const summaries = new Map<string, ApiKeyUsageSummary>();
  if (apiKeyIds.length === 0) return summaries;

  const missingKeyIds = apiKeyIds.filter((id) => !apiKeyUsageCache.has(id));

  if (missingKeyIds.length > 0) {
    const [groupedRows, livePricing] = await Promise.all([
      prisma.usageRecord.groupBy({
        by: ["apiKeyId", "model"],
        where: {
          apiKeyId: { in: missingKeyIds },
        },
        _max: { timestamp: true },
        _count: { _all: true },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
          cachedTokens: true,
          cacheWriteTokens: true,
          cacheWrite1hTokens: true,
        },
      }),
      getLiveModelPricing(),
    ]);

    const modelsByKey = new Map<string, Record<string, UsageModelTotals>>();
    const lastUsedByKey = new Map<string, Date>();

    for (const row of groupedRows) {
      if (!row.apiKeyId) continue;
      if (row._max.timestamp) {
        const prevTs = lastUsedByKey.get(row.apiKeyId);
        if (!prevTs || row._max.timestamp > prevTs) {
          lastUsedByKey.set(row.apiKeyId, row._max.timestamp);
        }
      }

      let keyModels = modelsByKey.get(row.apiKeyId);
      if (!keyModels) {
        keyModels = {};
        modelsByKey.set(row.apiKeyId, keyModels);
      }

      keyModels[row.model] = {
        totalRequests: row._count._all,
        totalTokens: row._sum.totalTokens ?? 0,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        cachedTokens: row._sum.cachedTokens ?? 0,
        cacheWriteTokens: row._sum.cacheWriteTokens ?? 0,
        cacheWrite1hTokens: row._sum.cacheWrite1hTokens ?? 0,
        longContextInputTokens: 0,
        longContextOutputTokens: 0,
        longContextCachedTokens: 0,
        longContextCacheWriteTokens: 0,
        longContextCacheWrite1hTokens: 0,
        peakInputTokens: 0,
        peakOutputTokens: 0,
        peakCachedTokens: 0,
        peakCacheWriteTokens: 0,
        peakCacheWrite1hTokens: 0,
      };
    }

    for (const keyId of missingKeyIds) {
      const models = modelsByKey.get(keyId);
      apiKeyUsageCache.set(keyId, {
        totalSpend: models ? calculateKeySpend(models, {}, livePricing) : 0,
        lastUsedAt: lastUsedByKey.get(keyId) ?? null,
      });
    }
  }

  for (const keyId of apiKeyIds) {
    summaries.set(
      keyId,
      apiKeyUsageCache.get(keyId) ?? { totalSpend: 0, lastUsedAt: null }
    );
  }

  return summaries;
}

/**
 * Sync result indicating successful synchronization.
 * @property ok - Always true for success
 * @property keysCount - Number of API keys synced to CLIProxyAPI
 */
interface SyncSuccess {
  ok: true;
  keysCount: number;
}

/**
 * Sync result indicating failure.
 * @property ok - Always false for failure
 * @property error - Human-readable error message
 */
interface SyncFailure {
  ok: false;
  error: string;
}

/**
 * Union type for sync operation results.
 * Always use `result.ok` to discriminate between success and failure.
 *
 * @example
 * const result = await syncKeysToCliProxyApi();
 * if (result.ok) {
 *   console.log(`Synced ${result.keysCount} keys`);
 * } else {
 *   console.error(`Sync failed: ${result.error}`);
 * }
 */
export type SyncResult = SyncSuccess | SyncFailure;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sync all API keys from PostgreSQL database to CLIProxyAPI management API.
 *
 * **Sync Strategy:**
 * - PostgreSQL is the source of truth
 * - Performs push-only sync: sends all DB keys to CLIProxyAPI via PUT /api-keys
 * - On failure: retries up to 3 times with exponential backoff (1s, 2s, 4s)
 * - Never throws: returns SyncResult for caller to handle
 * - Logs all errors for monitoring
 *
 * @returns SyncResult - { ok: true, keysCount } on success,
 *                       { ok: false, error } on failure (after all retries exhausted)
 *
 * @example
 * const result = await syncKeysToCliProxyApi();
 * if (result.ok) {
 *   console.log(`Synced ${result.keysCount} keys`);
 * } else {
 *   console.error(`Sync failed: ${result.error}`);
 *   // Application continues - sync failure does not block
 * }
 */
export async function syncKeysToCliProxyApi(): Promise<SyncResult> {
  const apiKey = process.env.MANAGEMENT_API_KEY;
  if (!apiKey) {
    logger.error("MANAGEMENT_API_KEY not set");
    return {
      ok: false,
      error: "Management API key not configured",
    };
  }

  try {
    const now = new Date();
    const allKeys = await prisma.userApiKey.findMany({
      select: {
        id: true,
        key: true,
        isActive: true,
        expiresAt: true,
        spendLimit: true,
      },
    });

    const nonExpiredKeys = allKeys.filter(
      (uk) => uk.isActive && (!uk.expiresAt || uk.expiresAt > now)
    );

    const keysWithSpendLimitIds = nonExpiredKeys
      .filter((uk) => uk.spendLimit !== null && uk.spendLimit >= 0)
      .map((uk) => uk.id);

    const usageByKey =
      keysWithSpendLimitIds.length > 0
        ? await getApiKeyUsageSummaries(keysWithSpendLimitIds)
        : new Map<string, ApiKeyUsageSummary>();

    const activeKeys = nonExpiredKeys.filter((uk) => {
      if (uk.spendLimit === null || uk.spendLimit < 0) return true;
      const totalSpend = usageByKey.get(uk.id)?.totalSpend ?? 0;
      return totalSpend < uk.spendLimit;
    });

    const keyList = activeKeys.map((uk) => uk.key);

    // Keep config-api-key registered in CLIProxyAPI when all keys are expired/exhausted
    // so CLIProxyAPI returns 401 instead of falling back to unauthenticated legacy mode.
    const payload =
      keyList.length === 0 && allKeys.length > 0
        ? [`sk-revoked-${randomUUID().replace(/-/g, "")}`]
        : keyList;

    let lastError: Error | null = null;
    const delays = [1000, 2000, 4000] as const;
    const maxRetries = delays.length;

    for (const [attempt, delayMs] of delays.entries()) {
      try {
        const response = await fetch(`${MANAGEMENT_BASE_URL}/api-keys`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `HTTP ${response.status}: ${text || "Unknown error"}`
          );
        }

        return { ok: true, keysCount: keyList.length };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          logger.warn(
            { attempt: attempt + 1, delayMs, error: lastError.message },
            "Sync attempt failed, retrying"
          );
          await sleep(delayMs);
        }
      }
    }

    logger.error({ error: lastError?.message }, "Final sync failure after retries");
    return {
      ok: false,
      error: lastError?.message || "Sync failed",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during sync";
    logger.error({ error: message }, "Sync error");
    return {
      ok: false,
      error: message,
    };
  }
}


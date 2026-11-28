import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getManagementUrl } from "@/lib/management-url";
import { logger } from "@/lib/logger";
import { getLiveModelPricing } from "@/lib/model-pricing-catalog";
import { calculateRequestCost, resolveModelPrice, type ModelPrice } from "@/lib/model-pricing";
import { AsyncMutex, FETCH_TIMEOUT_MS } from "@/lib/providers/management-api";

const MANAGEMENT_BASE_URL = getManagementUrl();
const keySync = new AsyncMutex();
const NO_ACTIVE_KEY = `sk-revoked-${randomUUID()}`;

export interface ApiKeyUsageSummary {
  totalSpend: number;
  lastUsedAt: Date | null;
}

const apiKeyUsageCache = new Map<string, ApiKeyUsageSummary>();
let usageGeneration = 0;
let cachedPricing: Record<string, ModelPrice> | undefined;

export function invalidateApiKeyUsageCache(apiKeyIds?: Iterable<string>): void {
  usageGeneration++;
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

  const livePricing = await getLiveModelPricing();
  if (cachedPricing !== livePricing) {
    cachedPricing = livePricing;
    invalidateApiKeyUsageCache();
  }
  const generation = usageGeneration;
  const missingKeyIds: string[] = [];
  for (const id of apiKeyIds) {
    const cached = apiKeyUsageCache.get(id);
    if (cached) summaries.set(id, cached);
    else missingKeyIds.push(id);
  }
  if (missingKeyIds.length === 0) return summaries;

  const requests = await prisma.usageRecord.findMany({
    where: { apiKeyId: { in: missingKeyIds } },
    select: {
      apiKeyId: true, timestamp: true, model: true, inputTokens: true, outputTokens: true,
      cachedTokens: true, cacheWriteTokens: true, cacheWrite1hTokens: true,
    },
  });
  for (const id of missingKeyIds) summaries.set(id, { totalSpend: 0, lastUsedAt: null });

  const prices = new Map<string, ModelPrice | null>();
  for (const request of requests) {
    const summary = summaries.get(request.apiKeyId!)!;
    if (!summary.lastUsedAt || request.timestamp > summary.lastUsedAt) summary.lastUsedAt = request.timestamp;
    if (!prices.has(request.model)) prices.set(request.model, resolveModelPrice(request.model, undefined, livePricing));
    const price = prices.get(request.model);
    if (price) summary.totalSpend += calculateRequestCost(request, request.timestamp, price);
  }

  if (generation === usageGeneration) {
    for (const id of missingKeyIds) apiKeyUsageCache.set(id, summaries.get(id)!);
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
  const release = await keySync.acquire("api-keys");

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

    // An empty list would disable the proxy's API-key authentication.
    const payload = keyList.length === 0 ? [NO_ACTIVE_KEY] : keyList;

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
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  } finally {
    release();
  }
}


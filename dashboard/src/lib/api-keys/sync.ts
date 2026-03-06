import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const MANAGEMENT_BASE_URL =
  process.env.CLIPROXYAPI_MANAGEMENT_URL ||
  "http://cliproxyapi:8317/v0/management";

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
    const allKeys = await prisma.userApiKey.findMany({
      select: { key: true },
    });

    const keyList = allKeys.map((uk) => uk.key);

    // CLIProxyAPI expects a plain array, not {"api-keys": [...]}
    const payload = keyList;

    let lastError: Error | null = null;
    const maxRetries = 3;
    const delays = [1000, 2000, 4000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
          const delayMs = delays[attempt];
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


/**
 * Node.js-only instrumentation — imported conditionally from instrumentation.ts.
 * Starts a periodic quota alert checker with a configurable interval.
 * Both the check interval and alert cooldown are read from DB settings.
 */

import { runAlertCheck, getCheckIntervalMs } from "@/lib/quota-alerts";
import { recordQuotaSnapshots, pruneQuotaSnapshotsIfDue } from "@/lib/quota/quota-snapshots";
import { evaluateAutoResetsForAccounts } from "@/lib/quota/auto-reset";
import { resyncCustomProviders } from "@/lib/providers/resync";
import { logger } from "@/lib/logger";
import type { QuotaResponse } from "@/lib/model-first-monitoring";

// Idempotency guard for HMR in dev — prevents duplicate intervals
const globalForScheduler = globalThis as typeof globalThis & {
  __quotaSchedulerRegistered?: boolean;
};

function scheduleTimeout(callback: () => void | Promise<void>, delayMs: number) {
  const timer = setTimeout(callback, delayMs);
  timer.unref?.();
  return timer;
}

export function registerNodeInstrumentation() {
  if (globalForScheduler.__quotaSchedulerRegistered) return;
  globalForScheduler.__quotaSchedulerRegistered = true;

  // Delay start to let the server fully initialize
  const STARTUP_DELAY_MS = 30_000; // 30 seconds

  scheduleTimeout(() => {
    startUsageCollectorScheduler();
  }, 10_000);

  scheduleTimeout(() => {
    startQuotaAlertScheduler();
  }, STARTUP_DELAY_MS);

  scheduleTimeout(() => {
    resyncCustomProviders().catch((err) => {
      logger.error({ err }, "Startup custom provider resync failed");
    });
  }, 15_000);
}

function startUsageCollectorScheduler() {
  const COLLECT_INTERVAL_MS = 60_000;
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const managementKey = process.env.MANAGEMENT_API_KEY;
      const collectorKey = process.env.COLLECTOR_API_KEY;
      if (!managementKey && !collectorKey) {
        return;
      }

      const port = process.env.PORT ?? "3000";
      const internalBaseUrl = `http://127.0.0.1:${port}`;
      const headers: Record<string, string> = {};
      if (collectorKey) headers.Authorization = `Bearer ${collectorKey}`;
      else if (managementKey) headers["X-Internal-Key"] = managementKey;

      const res = await fetch(`${internalBaseUrl}/api/usage/collect`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(45_000),
      });
      await res.body?.cancel().catch(() => undefined);
      if (!res.ok) {
        logger.warn({ status: res.status }, "Usage collector scheduler: /api/usage/collect returned non-OK");
      }
    } catch (error) {
      logger.warn({ err: error }, "Usage collector scheduler error");
    } finally {
      isRunning = false;
    }
  };

  const scheduleNext = async () => {
    await run();
    scheduleTimeout(scheduleNext, COLLECT_INTERVAL_MS);
  };

  scheduleNext();
}

function startQuotaAlertScheduler() {
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const managementKey = process.env.MANAGEMENT_API_KEY;
      if (!managementKey) {
        logger.warn("Quota alert scheduler: MANAGEMENT_API_KEY not set, skipping");
        return;
      }

      const port = process.env.PORT ?? "3000";
      const internalBaseUrl = `http://127.0.0.1:${port}`;
      const publicDashboardUrl = process.env.NEXTAUTH_URL ?? process.env.DASHBOARD_URL ?? internalBaseUrl;

      let quotaData: QuotaResponse | null = null;
      try {
        const res = await fetch(`${internalBaseUrl}/api/quota`, {
          headers: { "X-Internal-Key": managementKey },
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) {
          logger.warn({ status: res.status }, "Quota scheduler: failed to fetch /api/quota");
        } else {
          quotaData = (await res.json()) as QuotaResponse;
        }
      } catch (err) {
        logger.warn({ err }, "Quota scheduler: error fetching /api/quota");
      }

      if (quotaData?.accounts?.length) {
        try {
          await recordQuotaSnapshots(quotaData.accounts);
        } catch (err) {
          logger.error({ err }, "Quota scheduler: failed to record quota snapshots");
        }
        try {
          await evaluateAutoResetsForAccounts(quotaData.accounts);
        } catch (err) {
          logger.error({ err }, "Quota scheduler: failed to evaluate auto-resets");
        }
        await pruneQuotaSnapshotsIfDue();
      }

      const result = await runAlertCheck(async () => quotaData, publicDashboardUrl);

      if (result.alertsSent && result.alertsSent > 0) {
        logger.info(
          { alertsSent: result.alertsSent },
          "Scheduled quota alert check: alerts sent"
        );
      }
    } catch (error) {
      // Log but never crash — scheduler errors must not take down the server
      logger.error({ error }, "Quota alert scheduler error");
    } finally {
      isRunning = false;
    }
  };

  // Use recursive setTimeout so interval can be re-read from DB each cycle
  const scheduleNext = async () => {
    await run();
    try {
      const intervalMs = await getCheckIntervalMs();
      scheduleTimeout(scheduleNext, intervalMs);
    } catch {
      // Fallback to 5 minutes if DB read fails
      scheduleTimeout(scheduleNext, 5 * 60 * 1000);
    }
  };

  scheduleNext();
}

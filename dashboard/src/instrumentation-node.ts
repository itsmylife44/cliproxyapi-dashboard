/**
 * Node.js-only instrumentation — imported conditionally from instrumentation.ts.
 * Starts a periodic quota alert checker with a configurable interval.
 * Both the check interval and alert cooldown are read from DB settings.
 */

import { runAlertCheck, getCheckIntervalMs } from "@/lib/quota-alerts";
import { logger } from "@/lib/logger";

// Idempotency guard for HMR in dev — prevents duplicate intervals
const globalForScheduler = globalThis as typeof globalThis & {
  __quotaSchedulerRegistered?: boolean;
};

export function registerNodeInstrumentation() {
  if (globalForScheduler.__quotaSchedulerRegistered) return;
  globalForScheduler.__quotaSchedulerRegistered = true;

  // Delay start to let the server fully initialize
  const STARTUP_DELAY_MS = 30_000; // 30 seconds

  setTimeout(() => {
    startQuotaAlertScheduler();
  }, STARTUP_DELAY_MS);
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
      const baseUrl = process.env.NEXTAUTH_URL ?? process.env.DASHBOARD_URL ?? `http://localhost:${port}`;

      const quotaFetcher = async () => {
        try {
          const res = await fetch(`${baseUrl}/api/quota`, {
            headers: { "X-Internal-Key": managementKey },
            signal: AbortSignal.timeout(60_000),
          });
          if (!res.ok) return null;
          return res.json();
        } catch {
          return null;
        }
      };

      const result = await runAlertCheck(quotaFetcher, baseUrl);

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
      setTimeout(scheduleNext, intervalMs);
    } catch {
      // Fallback to 5 minutes if DB read fails
      setTimeout(scheduleNext, 5 * 60 * 1000);
    }
  };

  scheduleNext();
}

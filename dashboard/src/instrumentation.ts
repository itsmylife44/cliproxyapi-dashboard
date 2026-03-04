/**
 * Next.js Instrumentation — runs once on server startup.
 * Starts a periodic quota alert checker that runs every 5 minutes.
 * The alert system has a 1-hour cooldown, so even with 5-min checks,
 * at most 1 alert per hour is sent.
 */

// Idempotency guard for HMR in dev — prevents duplicate intervals
const globalForScheduler = globalThis as typeof globalThis & {
  __quotaSchedulerRegistered?: boolean;
};

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalForScheduler.__quotaSchedulerRegistered) return;
  globalForScheduler.__quotaSchedulerRegistered = true;

  // Delay start to let the server fully initialize
  const STARTUP_DELAY_MS = 30_000; // 30 seconds
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  setTimeout(() => {
    startQuotaAlertScheduler(CHECK_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

function startQuotaAlertScheduler(intervalMs: number) {
  let isRunning = false;

  // Dynamic imports to avoid loading server modules at build time
  const run = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const { runAlertCheck } = await import("@/lib/quota-alerts");
      const { logger } = await import("@/lib/logger");

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
      try {
        const { logger } = await import("@/lib/logger");
        logger.error({ error }, "Quota alert scheduler error");
      } catch {
        // If even the logger import fails, silently continue
      }
    } finally {
      isRunning = false;
    }
  };

  run();
  setInterval(run, intervalMs);
}

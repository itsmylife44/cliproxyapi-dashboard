/**
 * Next.js Instrumentation — runs once on server startup.
 * Starts a periodic quota alert checker that runs every 5 minutes.
 * The alert system has a 1-hour cooldown, so even with 5-min checks,
 * at most 1 alert per hour is sent.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Delay start to let the server fully initialize
  const STARTUP_DELAY_MS = 30_000; // 30 seconds
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  setTimeout(() => {
    startQuotaAlertScheduler(CHECK_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

function startQuotaAlertScheduler(intervalMs: number) {
  // Dynamic imports to avoid loading server modules at build time
  const run = async () => {
    try {
      const { runAlertCheck } = await import("@/lib/quota-alerts");
      const { logger } = await import("@/lib/logger");

      const managementKey = process.env.MANAGEMENT_API_KEY;
      if (!managementKey) return;

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
    } catch {
      // Silent — scheduler should never crash the server
    }
  };

  run();
  setInterval(run, intervalMs);
}

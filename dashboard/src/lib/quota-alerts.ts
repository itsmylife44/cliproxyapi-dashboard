import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendTelegramMessage, formatQuotaAlertBatch } from "@/lib/telegram";

const SETTING_KEYS = {
  BOT_TOKEN: "telegram_bot_token",
  CHAT_ID: "telegram_chat_id",
  THRESHOLD: "telegram_quota_threshold",
  ENABLED: "telegram_alerts_enabled",
  LAST_ALERT_TIME: "telegram_last_alert_time",
  PROVIDERS: "telegram_alert_providers",
} as const;

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction?: number | null;
  resetTime: string | null;
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email?: string | null;
  supported: boolean;
  error?: string;
  groups?: QuotaGroup[];
}

interface QuotaResponse {
  accounts: QuotaAccount[];
}

interface CapacityEntry {
  provider: string;
  account: string;
  windowId: string;
  windowLabel: string;
  capacity: number;
}

export interface AlertCheckResult {
  checked?: boolean;
  skipped?: boolean;
  reason?: string;
  nextAlertAvailable?: string;
  /** Number of Telegram messages sent (0 or 1) */
  alertsSent?: number;
  /** Number of accounts that breached the threshold */
  breachedCount?: number;
  accounts?: Array<{
    provider: string;
    account: string;
    window: string;
    capacity: number;
    belowThreshold: boolean;
  }>;
}

function calcPooledCapacity(accounts: QuotaAccount[]): CapacityEntry[] {
  const results: CapacityEntry[] = [];

  for (const account of accounts) {
    if (!account.supported || account.error || !account.groups) continue;

    for (const group of account.groups) {
      if (group.id === "extra-usage") continue;
      const fraction =
        typeof group.remainingFraction === "number" &&
        Number.isFinite(group.remainingFraction)
          ? group.remainingFraction
          : null;

      if (fraction === null) continue;

      const capacity = Math.max(0, Math.min(1, fraction));

      results.push({
        provider: account.provider,
        account: account.email ?? account.auth_index,
        windowId: group.id,
        windowLabel: group.label,
        capacity,
      });
    }
  }

  return results;
}

/**
 * Core alert-checking logic. Used by both the API route (manual check)
 * and the server-side scheduler (automatic check).
 *
 * @param quotaFetcher - Function that returns quota data. API route passes
 *   a cookie-authenticated self-fetch; the scheduler passes an internal-key fetch.
 * @param dashboardUrl - Base URL for the "Open Dashboard" link in alerts.
 */
export async function runAlertCheck(
  quotaFetcher: () => Promise<QuotaResponse | null>,
  dashboardUrl?: string
): Promise<AlertCheckResult> {
  // 1. Read telegram settings from DB
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.BOT_TOKEN,
          SETTING_KEYS.CHAT_ID,
          SETTING_KEYS.THRESHOLD,
          SETTING_KEYS.ENABLED,
          SETTING_KEYS.LAST_ALERT_TIME,
          SETTING_KEYS.PROVIDERS,
        ],
      },
    },
  });

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));
  const enabled = settingMap.get(SETTING_KEYS.ENABLED) === "true";
  const botToken = settingMap.get(SETTING_KEYS.BOT_TOKEN) ?? "";
  const chatId = settingMap.get(SETTING_KEYS.CHAT_ID) ?? "";
  const thresholdRaw = parseInt(
    settingMap.get(SETTING_KEYS.THRESHOLD) ?? "20",
    10
  );
  const threshold = Number.isNaN(thresholdRaw) || thresholdRaw < 1 || thresholdRaw > 100
    ? 20
    : thresholdRaw;

  const providersRaw = settingMap.get(SETTING_KEYS.PROVIDERS) ?? "";
  const selectedProviders = providersRaw ? providersRaw.split(",").filter(Boolean) : [];

  // 2. Check if alerts are enabled and configured
  if (!enabled) {
    return { skipped: true, reason: "alerts disabled" };
  }

  if (!botToken || !chatId) {
    return { skipped: true, reason: "bot token or chat ID not configured" };
  }

  // 3. Check cooldown
  const lastAlertTimeStr = settingMap.get(SETTING_KEYS.LAST_ALERT_TIME);
  if (lastAlertTimeStr) {
    const lastAlertTime = parseInt(lastAlertTimeStr, 10);
    if (!Number.isNaN(lastAlertTime) && Date.now() - lastAlertTime < COOLDOWN_MS) {
      return {
        skipped: true,
        reason: "cooldown active (1 alert per hour)",
        nextAlertAvailable: new Date(lastAlertTime + COOLDOWN_MS).toISOString(),
      };
    }
  }

  // 4. Fetch quota data
  const quotaData = await quotaFetcher();
  if (!quotaData) {
    return { skipped: true, reason: "failed to fetch quota data" };
  }

  // 5. Check capacities against threshold
  const thresholdFraction = threshold / 100;
  const allCapacities = calcPooledCapacity(quotaData.accounts);
  const monitoredCapacities = selectedProviders.length > 0
    ? allCapacities.filter((c) => selectedProviders.includes(c.provider))
    : allCapacities;
  const breached = monitoredCapacities.filter(
    (c) => c.capacity < thresholdFraction
  );

  const accountsSummary = monitoredCapacities.map((c) => ({
    provider: c.provider,
    account: c.account,
    window: c.windowLabel,
    capacity: Math.round(c.capacity * 100),
    belowThreshold: c.capacity < thresholdFraction,
  }));

  if (breached.length === 0) {
    return { checked: true, alertsSent: 0, accounts: accountsSummary };
  }

  // 6. Send ONE consolidated alert
  const message = formatQuotaAlertBatch(
    breached.map((b) => ({
      provider: b.provider,
      account: b.account,
      windowId: b.windowId,
      windowLabel: b.windowLabel,
      capacity: b.capacity,
    })),
    threshold,
    dashboardUrl
  );

  const result = await sendTelegramMessage(botToken, chatId, message, "HTML");
  const messageSent = result.ok ? 1 : 0;
  const breachedCount = result.ok ? breached.length : 0;

  if (!result.ok) {
    logger.warn(
      { error: result.error, breachedCount: breached.length },
      "Failed to send Telegram quota alert batch"
    );
  }

  // 7. Update last alert time
  if (messageSent > 0) {
    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEYS.LAST_ALERT_TIME },
      create: { key: SETTING_KEYS.LAST_ALERT_TIME, value: String(Date.now()) },
      update: { value: String(Date.now()) },
    });
  }

  return { checked: true, alertsSent: messageSent, breachedCount, accounts: accountsSummary };
}

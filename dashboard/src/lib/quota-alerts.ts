import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { QuotaGroupScope } from "@/lib/model-first-monitoring";
import { sendTelegramMessage, formatQuotaAlertBatch, formatAutoResetNotice } from "@/lib/telegram";
import type { AutoResetCreditSummary } from "@/lib/quota/auto-reset-rules";

export const QUOTA_ALERT_SETTING_KEYS = {
  BOT_TOKEN: "telegram_bot_token",
  CHAT_ID: "telegram_chat_id",
  THRESHOLD: "telegram_quota_threshold",
  LAST_ALERT_TIME: "telegram_last_alert_time",
  PROVIDERS: "telegram_alert_providers",
  CHECK_INTERVAL: "telegram_check_interval",
  COOLDOWN: "telegram_cooldown",
  CHANNEL: "quota_alert_channel",
  WEBHOOK: "discord_quota_webhook",
} as const;
const SETTING_KEYS = QUOTA_ALERT_SETTING_KEYS;

const DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);

const DISCORD_MAX_LENGTH = 2000;

/** Validate that a URL is an HTTPS Discord webhook endpoint without credentials or unexpected query params. */
export function validDiscordWebhook(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !DISCORD_WEBHOOK_HOSTS.has(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return false;
    }
    if (!/^\/api\/(?:v10\/)?webhooks\/\d+\/[\w-]+$/.test(url.pathname)) {
      return false;
    }
    if (url.search) {
      const keys = Array.from(url.searchParams.keys());
      if (keys.length !== 1 || keys[0] !== "thread_id") {
        return false;
      }
      const threadId = url.searchParams.get("thread_id") ?? "";
      if (!/^\d+$/.test(threadId)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Convert Telegram HTML quota alert content into clean Discord plain text within 2000 chars. */
export function formatDiscordAlertContent(htmlMessage: string): string {
  const withLinks = htmlMessage.replace(
    /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    "$2 ($1)"
  );
  const plain = decodeHtmlEntities(withLinks.replace(/<[^>]*>/g, ""));
  const escaped = plain.replace(/[^\s@:/]+@[^\s@:/]+/g, (email) =>
    email.replace(/([_*])/g, "\\$1")
  );

  if (escaped.length <= DISCORD_MAX_LENGTH) {
    return escaped;
  }

  const lines = escaped.split("\n");
  for (let keep = lines.length - 1; keep >= 1; keep--) {
    const omitted = lines.length - keep;
    const candidate = `${lines.slice(0, keep).join("\n")}\n… ${omitted} more`;
    if (candidate.length <= DISCORD_MAX_LENGTH) {
      return candidate;
    }
  }

  const suffix = lines.length > 1 ? `\n… ${lines.length - 1} more` : "…";
  return `${(lines[0] ?? "").slice(0, Math.max(0, DISCORD_MAX_LENGTH - suffix.length))}${suffix}`.slice(
    0,
    DISCORD_MAX_LENGTH
  );
}

/** Send a plain-text quota alert message to a validated Discord webhook URL. */
export async function sendDiscordAlert(
  url: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  if (!validDiscordWebhook(url)) {
    return { ok: false, error: "Invalid Discord webhook" };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.slice(0, 2000),
        allowed_mentions: { parse: [] },
      }),
    });
    return response.ok ? { ok: true } : { ok: false, error: `Discord HTTP ${response.status}` };
  } catch {
    return { ok: false, error: "Discord request failed" };
  }
}

const DESTINATION_KEYS = [
  SETTING_KEYS.CHANNEL,
  SETTING_KEYS.WEBHOOK,
  SETTING_KEYS.BOT_TOKEN,
  SETTING_KEYS.CHAT_ID,
];

type AlertDestination =
  | { channel: "discord"; webhook: string }
  | { channel: "telegram"; botToken: string; chatId: string };

function getAlertDestination(settings: Map<string, string>): { destination: AlertDestination } | { reason: string } {
  const channel = settings.get(SETTING_KEYS.CHANNEL) ?? "disabled";
  if (channel === "disabled") return { reason: "alerts disabled" };
  if (channel === "discord") {
    const webhook = settings.get(SETTING_KEYS.WEBHOOK) ?? "";
    return validDiscordWebhook(webhook)
      ? { destination: { channel, webhook } }
      : { reason: "Discord webhook not configured" };
  }
  const botToken = settings.get(SETTING_KEYS.BOT_TOKEN);
  const chatId = settings.get(SETTING_KEYS.CHAT_ID);
  return botToken && chatId
    ? { destination: { channel: "telegram", botToken, chatId } }
    : { reason: "bot token or chat ID not configured" };
}

function sendAlertMessage(destination: AlertDestination, html: string) {
  return destination.channel === "discord"
    ? sendDiscordAlert(destination.webhook, formatDiscordAlertContent(html))
    : sendTelegramMessage(destination.botToken, destination.chatId, html, "HTML");
}

export async function notifyAutoResetUsed(
  account: Pick<QuotaAccount, "auth_index" | "provider" | "email">,
  loadCredits: () => Promise<AutoResetCreditSummary>,
  dashboardUrl?: string
): Promise<void> {
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: DESTINATION_KEYS } } });
  const configuration = getAlertDestination(new Map(settings.map((s) => [s.key, s.value])));
  if ("reason" in configuration) return;
  const { destination } = configuration;

  // The post-reset balance is independent of the redemption response (Claude may return only one grant).
  const credits = await loadCredits().catch((error) => {
    logger.warn({ error, authIndex: account.auth_index }, "Failed to refresh reset credits after auto-reset");
    return null;
  });
  const message = formatAutoResetNotice(
    account.provider,
    account.email ?? account.auth_index,
    credits?.availableCount ?? null,
    credits?.nearestExpiresAt ?? null,
    dashboardUrl
  );
  const result = await sendAlertMessage(destination, message);
  if (!result.ok) {
    logger.warn({ channel: destination.channel, error: result.error, authIndex: account.auth_index }, "Failed to send auto-reset notification");
  }
}

const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface QuotaGroup {
  id: string;
  label: string;
  scope?: QuotaGroupScope;
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
      // Scoped limits (e.g. Codex per-model or code review) are informational;
      // alerts track the account's main quota only.
      if (group.scope) continue;
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
          ...DESTINATION_KEYS,
          SETTING_KEYS.THRESHOLD,
          SETTING_KEYS.LAST_ALERT_TIME,
          SETTING_KEYS.PROVIDERS,
          SETTING_KEYS.COOLDOWN,
        ],
      },
    },
  });

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));
  const configuration = getAlertDestination(settingMap);
  const thresholdRaw = parseInt(
    settingMap.get(SETTING_KEYS.THRESHOLD) ?? "20",
    10
  );
  const threshold = Number.isNaN(thresholdRaw) || thresholdRaw < 1 || thresholdRaw > 100
    ? 20
    : thresholdRaw;

  const providersRaw = settingMap.get(SETTING_KEYS.PROVIDERS) ?? "";
  const selectedProviders = providersRaw ? providersRaw.split(",").filter(Boolean) : [];

  const cooldownRaw = parseInt(settingMap.get(SETTING_KEYS.COOLDOWN) ?? "", 10);
  const cooldownMs = !Number.isNaN(cooldownRaw) && cooldownRaw >= 1 ? cooldownRaw * 60 * 1000 : DEFAULT_COOLDOWN_MS;

  // 2. Check if alerts are enabled and configured
  if ("reason" in configuration) return { skipped: true, reason: configuration.reason };
  const { destination } = configuration;

  // 3. Check cooldown
  const lastAlertTimeStr = settingMap.get(SETTING_KEYS.LAST_ALERT_TIME);
  if (lastAlertTimeStr) {
    const lastAlertTime = parseInt(lastAlertTimeStr, 10);
    if (!Number.isNaN(lastAlertTime) && Date.now() - lastAlertTime < cooldownMs) {
      const cooldownMinutes = Math.round(cooldownMs / 60000);
      return {
        skipped: true,
        reason: `cooldown active (1 alert per ${cooldownMinutes} min)`,
        nextAlertAvailable: new Date(lastAlertTime + cooldownMs).toISOString(),
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

  const result = await sendAlertMessage(destination, message);
  const messageSent = result.ok ? 1 : 0;
  const breachedCount = result.ok ? breached.length : 0;

  if (!result.ok) {
    logger.warn(
      { channel: destination.channel, error: result.error, breachedCount: breached.length },
      "Failed to send quota alert batch"
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

/**
 * Read the configured check interval from DB (in milliseconds).
 * Falls back to DEFAULT_CHECK_INTERVAL_MS if not set.
 */
export async function getCheckIntervalMs(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEYS.CHECK_INTERVAL },
    });
    if (setting) {
      const minutes = parseInt(setting.value, 10);
      if (!Number.isNaN(minutes) && minutes >= 1) {
        return minutes * 60 * 1000;
      }
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_CHECK_INTERVAL_MS;
}


import "server-only";

const BOT_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]{35}$/;
const CHAT_ID_REGEX = /^-?\d+$/;

/**
 * Validate Telegram bot token format (e.g., "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_0123456789a")
 */
export function validateBotToken(token: string): boolean {
  return BOT_TOKEN_REGEX.test(token);
}

/**
 * Validate Telegram chat ID — numeric string, can be negative for groups
 */
export function validateChatId(chatId: string): boolean {
  return CHAT_ID_REGEX.test(chatId);
}

/**
 * Send a message via the Telegram Bot API
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode?: "HTML" | "MarkdownV2"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, string> = {
      chat_id: chatId,
      text,
    };

    if (parseMode) {
      body.parse_mode = parseMode;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
    };

    if (!data.ok) {
      return {
        ok: false,
        error: data.description ?? `Telegram API error (HTTP ${response.status})`,
      };
    }

    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error sending Telegram message";
    return { ok: false, error: message };
  }
}

export interface BreachedAccount {
  provider: string;
  account: string;
  windowId: string;
  windowLabel: string;
  capacity: number;
}

/**
 * Classify severity based on remaining capacity
 */
function getSeverity(capacity: number): { label: string; emoji: string } {
  if (capacity <= 0.05) return { label: "CRITICAL", emoji: "🔴" };
  if (capacity <= 0.15) return { label: "LOW", emoji: "🟠" };
  return { label: "WARNING", emoji: "🟡" };
}

/**
 * Format a professional, consolidated HTML alert for all breached accounts.
 * Sends ONE message with full context instead of spamming per-account.
 */
export function formatQuotaAlertBatch(
  breached: BreachedAccount[],
  threshold: number,
  dashboardUrl?: string
): string {
  const now = new Date();
  const timestamp = now.toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  // Group by provider for organized display
  const byProvider = new Map<string, BreachedAccount[]>();
  for (const entry of breached) {
    const existing = byProvider.get(entry.provider) ?? [];
    existing.push(entry);
    byProvider.set(entry.provider, existing);
  }

  const criticalCount = breached.filter((b) => b.capacity <= 0.05).length;
  const lowCount = breached.filter((b) => b.capacity > 0.05 && b.capacity <= 0.15).length;
  const warnCount = breached.length - criticalCount - lowCount;

  // Header
  const lines: string[] = [
    `<b>⚠️ CLIProxyAPI — Quota Alert</b>`,
    ``,
    `<b>${breached.length}</b> account(s) below <b>${threshold}%</b> threshold`,
  ];

  // Severity summary
  const severityParts: string[] = [];
  if (criticalCount > 0) severityParts.push(`🔴 ${criticalCount} critical`);
  if (lowCount > 0) severityParts.push(`🟠 ${lowCount} low`);
  if (warnCount > 0) severityParts.push(`🟡 ${warnCount} warning`);
  lines.push(severityParts.join("  ·  "));
  lines.push(``);

  // Provider breakdown
  for (const [provider, accounts] of byProvider) {
    lines.push(`<b>▸ ${escapeHtml(capitalizeFirst(provider))}</b>`);
    for (const a of accounts) {
      const pct = Math.round(a.capacity * 100);
      const { emoji } = getSeverity(a.capacity);
      lines.push(
        `  ${emoji} ${escapeHtml(a.account)} — <b>${pct}%</b> remaining (${escapeHtml(a.windowLabel)})`
      );
    }
    lines.push(``);
  }

  // Footer
  lines.push(`<i>🕐 ${timestamp} UTC</i>`);
  if (dashboardUrl) {
    lines.push(`<a href="${escapeHtml(dashboardUrl)}/dashboard/quota">Open Dashboard</a>`);
  }

  return lines.join("\n");
}

/**
 * @deprecated Use formatQuotaAlertBatch for consolidated alerts
 */
export function formatQuotaAlert(
  provider: string,
  account: string,
  capacity: number,
  threshold: number
): string {
  return formatQuotaAlertBatch(
    [{ provider, account, windowId: "", windowLabel: "Unknown", capacity }],
    threshold
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findMany, upsert, sendTelegramMessage } = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { systemSetting: { findMany, upsert, findUnique: vi.fn() } },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage,
  formatQuotaAlertBatch: vi.fn(() => "alert"),
}));

import {
  formatDiscordAlertContent,
  runAlertCheck,
  validDiscordWebhook,
} from "@/lib/quota-alerts";

const enabledSettings = [
  { key: "telegram_alerts_enabled", value: "true" },
  { key: "telegram_bot_token", value: "token" },
  { key: "telegram_chat_id", value: "chat" },
  { key: "telegram_quota_threshold", value: "20" },
];

const spark = { id: "codex-bengalfox", label: "GPT-5.3-Codex-Spark" };

describe("runAlertCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue(enabledSettings);
    sendTelegramMessage.mockResolvedValue({ ok: true });
  });

  it("ignores scoped limits so an exhausted Codex per-model limit raises no alert (issue #309)", async () => {
    const result = await runAlertCheck(async () => ({
      accounts: [
        {
          auth_index: "1",
          provider: "codex",
          email: "codex@example.com",
          supported: true,
          groups: [
            { id: "primary-window", label: "5h Window", remainingFraction: 0.8, resetTime: null },
            {
              id: "codex-bengalfox-primary-window",
              label: "GPT-5.3-Codex-Spark 5h Window",
              remainingFraction: 0,
              resetTime: null,
              scope: spark,
            },
            {
              id: "code-review-primary-window",
              label: "Code Review 168h Window",
              remainingFraction: 0.05,
              resetTime: null,
              scope: { id: "code-review", label: "Code Review" },
            },
          ],
        },
      ],
    }));

    expect(result).toMatchObject({ checked: true, alertsSent: 0 });
    expect(result.accounts).toEqual([
      { provider: "codex", account: "codex@example.com", window: "5h Window", capacity: 80, belowThreshold: false },
    ]);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("still alerts when a main window drops below the threshold", async () => {
    const result = await runAlertCheck(async () => ({
      accounts: [
        {
          auth_index: "1",
          provider: "codex",
          email: "codex@example.com",
          supported: true,
          groups: [{ id: "primary-window", label: "5h Window", remainingFraction: 0.1, resetTime: null }],
        },
      ],
    }));

    expect(result).toMatchObject({ checked: true, alertsSent: 1, breachedCount: 1 });
    expect(sendTelegramMessage).toHaveBeenCalledOnce();
  });

  it("sends a breached quota alert to the configured Discord webhook", async () => {
    const webhook = "https://discord.com/api/webhooks/123456/example-token";
    findMany.mockResolvedValue([
      { key: "quota_alert_channel", value: "discord" },
      { key: "discord_quota_webhook", value: webhook },
      { key: "telegram_quota_threshold", value: "20" },
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    try {
      const result = await runAlertCheck(async () => ({ accounts: [{ auth_index: "1", provider: "codex", supported: true, groups: [{ id: "primary-window", label: "5h Window", remainingFraction: 0.1, resetTime: null }] }] }));
      expect(result).toMatchObject({ checked: true, alertsSent: 1, breachedCount: 1 });
      expect(fetchMock).toHaveBeenCalledWith(webhook, expect.objectContaining({ method: "POST", redirect: "error", body: expect.stringContaining("alert") }));
      expect(sendTelegramMessage).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("does not send an alert when the channel is disabled", async () => {
    findMany.mockResolvedValue([{ key: "quota_alert_channel", value: "disabled" }]);
    expect(await runAlertCheck(async () => { throw new Error("quota fetch should not occur"); })).toMatchObject({ skipped: true, reason: "alerts disabled" });
  });

  it("skips with a Discord-specific reason when Discord channel has no valid webhook", async () => {
    findMany.mockResolvedValue([
      { key: "quota_alert_channel", value: "discord" },
      { key: "discord_quota_webhook", value: "" },
    ]);
    expect(
      await runAlertCheck(async () => {
        throw new Error("quota fetch should not occur");
      })
    ).toEqual({ skipped: true, reason: "Discord webhook not configured" });
  });
});

describe("validDiscordWebhook", () => {
  it("accepts official Discord hosts, optional v10 path, and numeric thread_id", () => {
    expect(validDiscordWebhook("https://discord.com/api/webhooks/123456/token_abc-1")).toBe(true);
    expect(validDiscordWebhook("https://discordapp.com/api/webhooks/123456/token_abc")).toBe(true);
    expect(validDiscordWebhook("https://ptb.discord.com/api/v10/webhooks/123456/token_abc")).toBe(true);
    expect(
      validDiscordWebhook(
        "https://canary.discord.com/api/v10/webhooks/123456/token_abc?thread_id=987654321"
      )
    ).toBe(true);
  });

  it("rejects non-HTTPS, non-official hosts, ports, credentials, hashes, and invalid query params", () => {
    expect(validDiscordWebhook("http://discord.com/api/webhooks/123/abc")).toBe(false);
    expect(validDiscordWebhook("https://evil.com/api/webhooks/123/abc")).toBe(false);
    expect(validDiscordWebhook("https://discord.com:8443/api/webhooks/123/abc")).toBe(false);
    expect(validDiscordWebhook("https://user:pass@discord.com/api/webhooks/123/abc")).toBe(false);
    expect(validDiscordWebhook("https://discord.com/api/webhooks/123/abc#frag")).toBe(false);
    expect(validDiscordWebhook("https://discord.com/api/webhooks/123/abc?thread_id=abc")).toBe(false);
    expect(validDiscordWebhook("https://discord.com/api/webhooks/123/abc?wait=true")).toBe(false);
  });
});

describe("formatDiscordAlertContent", () => {
  it("decodes HTML entities, preserves dashboard link URLs, and escapes email markdown", () => {
    const html = [
      "<b>⚠️ CLIProxyAPI — Quota Alert</b>",
      "user_name*1@example.com — <b>5%</b> &amp; &lt;low&gt; &quot;ok&quot; &#39;now&#39;",
      '<a href="https://dash.example.com/dashboard/quota">Open Dashboard</a>',
    ].join("\n");

    const formatted = formatDiscordAlertContent(html);
    expect(formatted).toContain("⚠️ CLIProxyAPI — Quota Alert");
    expect(formatted).toContain("user\\_name\\*1@example.com — 5% & <low> \"ok\" 'now'");
    expect(formatted).toContain("Open Dashboard (https://dash.example.com/dashboard/quota)");
    expect(formatted).not.toContain("<b>");
  });

  it("truncates at line boundaries with '… N more' within 2000 characters", () => {
    const lines = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}: ${"x".repeat(35)}`);
    const formatted = formatDiscordAlertContent(lines.join("\n"));

    expect(formatted.length).toBeLessThanOrEqual(2000);
    expect(formatted).toMatch(/\n… \d+ more$/);
    const omittedMatch = formatted.match(/\n… (\d+) more$/);
    const keptLines = formatted.split("\n").length - 1;
    expect(Number(omittedMatch?.[1]) + keptLines).toBe(80);
  });
});

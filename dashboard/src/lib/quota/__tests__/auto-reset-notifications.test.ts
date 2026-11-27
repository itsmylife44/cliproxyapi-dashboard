import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuotaAccount } from "@/lib/model-first-monitoring";

const db = vi.hoisted(() => {
  const systemSetting = { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() };
  const tx = { systemSetting, $queryRaw: vi.fn() };
  return { systemSetting, $transaction: vi.fn((run: (input: typeof tx) => unknown) => run(tx)) };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/management-url", () => ({ getManagementUrl: () => "https://management.example.test" }));
vi.mock("@/lib/cache", () => ({
  CACHE_KEYS: { quotaAccount: (authIndex: string) => `quota:${authIndex}` },
  quotaCache: { invalidate: vi.fn() },
  quotaAccountCache: { invalidatePattern: vi.fn() },
}));

import { evaluateAutoResetsForAccounts, executeAccountReset } from "../auto-reset";

const account: QuotaAccount = {
  auth_index: "a1",
  provider: "codex",
  email: "team<&>@example.test",
  supported: true,
  groups: [
    { id: "five-hour", label: "5-hour", remainingFraction: 0, resetTime: null, models: [] },
    { id: "weekly", label: "Weekly", remainingFraction: 0, resetTime: null, models: [] },
  ],
};
const telegramSettings = [
  { key: "telegram_alerts_enabled", value: "true" },
  { key: "telegram_bot_token", value: "token" },
  { key: "telegram_chat_id", value: "chat" },
];
const webhook = "https://discord.com/api/webhooks/123456/example-token";
const fetchMock = vi.fn<typeof fetch>();

function upstream(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(Response.json({ status_code: status, body: JSON.stringify(body) }));
}

function authFiles(provider = "codex") {
  fetchMock.mockResolvedValueOnce(Response.json({ files: [{ auth_index: "a1", provider }] }));
}

function lastRequest() {
  const [url, options] = fetchMock.mock.lastCall!;
  return { url, body: JSON.parse(String(options?.body)) };
}

beforeEach(() => {
  vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("MANAGEMENT_API_KEY", "management-key");
  fetchMock.mockReset();
  db.systemSetting.findMany.mockReset().mockResolvedValue(telegramSettings);
  db.systemSetting.findUnique.mockReset().mockResolvedValue({ value: JSON.stringify({ a1: { enabled: true } }) });
  db.systemSetting.upsert.mockReset().mockImplementation(async ({ update }) => {
    db.systemSetting.findUnique.mockResolvedValue({ value: update.value });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("automatic reset notifications", () => {
  it("sends the Codex post-reset count and earliest available expiry to Telegram, regardless of threshold cooldown", async () => {
    db.systemSetting.findMany.mockResolvedValue([...telegramSettings, { key: "telegram_last_alert_time", value: String(Date.now()) }]);
    authFiles();
    upstream({ code: "reset", credit: { expires_at: "2030-01-02T12:00:00Z" }, windows_reset: 2 });
    upstream({
      available_count: 2,
      credits: [
        { status: "redeemed", expires_at: "2030-01-02T12:00:00Z" },
        { status: "available", expires_at: "2030-01-20T12:00:00Z" },
        { status: "available", expires_at: "2030-01-04T12:00:00Z" },
        { status: "redeeming", expires_at: "2030-01-03T12:00:00Z" },
      ],
    });
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));

    expect(await evaluateAutoResetsForAccounts([account], "https://dashboard.example.test")).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      auth_index: "a1", method: "GET", url: expect.stringMatching(/rate-limit-reset-credits$/),
    });
    const { url, body } = lastRequest();
    expect(url).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(body).toMatchObject({ chat_id: "chat", parse_mode: "HTML" });
    expect(body.text).toContain("Quota auto-reset used");
    expect(body.text).toContain("team&lt;&amp;&gt;@example.test");
    expect(body.text).toContain("Resets remaining: 2");
    expect(body.text).toMatch(/Next reset credit expires: in 3 days .*Jan 4, 2030.*UTC/);
    expect(body.text).toContain('href="https://dashboard.example.test/dashboard/quota"');
    expect(db.systemSetting.upsert.mock.calls.every(([{ where }]) => where.key === "quota_auto_reset_rules")).toBe(true);
  });

  it("uses Claude's total post-reset balance rather than the redeemed grant's balance and sends via Discord", async () => {
    db.systemSetting.findMany.mockResolvedValue([
      { key: "quota_alert_channel", value: "discord" },
      { key: "discord_quota_webhook", value: webhook },
    ]);
    authFiles("claude");
    upstream({ cedar_ember: { grants: [{ id: "claimed", resets_left: 1, usable_now: true }] } });
    upstream({ organization: { uuid: "org" } });
    upstream({ result: "reset", resets_left: 0 });
    upstream({ cedar_ember: { grants: [
      { id: "claimed", resets_left: 0, usable_now: true, expires_at: "2030-01-02T12:00:00Z" },
      { id: "other", resets_left: 2, usable_now: true, expires_at: "2030-01-04T12:00:00Z" },
    ] } });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await evaluateAutoResetsForAccounts([{ ...account, provider: "claude" }])).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const { url, body } = lastRequest();
    expect(url).toBe(webhook);
    expect(body.content).toContain("Resets remaining: 2");
    expect(body.content).toMatch(/Next reset credit expires: in 3 days .*Jan 4, 2030.*UTC/);
    expect(body.content).not.toContain("<b>");
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it.each([
    { credits: { available_count: 0, credits: [{ status: "redeemed", expires_at: "2030-01-02T12:00:00Z" }] }, status: 200, remaining: "0", expiry: "No credits remaining" },
    { credits: {}, status: 502, remaining: "Unavailable", expiry: "Unavailable" },
  ])("distinguishes a depleted balance from an unavailable lookup ($status)", async ({ credits, status, remaining, expiry }) => {
    authFiles();
    upstream({ code: "reset" });
    upstream(credits, status);
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));

    expect(await evaluateAutoResetsForAccounts([account])).toBe(1);
    expect(lastRequest().body.text).toContain(`Resets remaining: ${remaining}\nNext reset credit expires: ${expiry}`);
  });

  it("does not look up credits or send when quota notifications are disabled", async () => {
    db.systemSetting.findMany.mockResolvedValue([...telegramSettings, { key: "quota_alert_channel", value: "disabled" }]);
    authFiles();
    upstream({ code: "reset" });

    expect(await evaluateAutoResetsForAccounts([account])).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["no_credit", "nothing_to_reset"])("does not notify when Codex returns %s in a successful HTTP response", async (code) => {
    authFiles();
    upstream({ code });

    expect(await evaluateAutoResetsForAccounts([account])).toBe(0);
    expect(db.systemSetting.findMany).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not notify when Claude reports that no reset was needed", async () => {
    authFiles("claude");
    upstream({ cedar_ember: { grants: [{ id: "claim", resets_left: 1, usable_now: true }] } });
    upstream({ organization: { uuid: "org" } });
    upstream({ result: "not_limited" });

    expect(await evaluateAutoResetsForAccounts([{ ...account, provider: "claude" }])).toBe(0);
    expect(db.systemSetting.findMany).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not notify after a successful manual reset", async () => {
    upstream({ code: "reset" });

    expect(await executeAccountReset(account)).toMatchObject({ ok: true, status: "reset" });
    expect(db.systemSetting.findMany).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

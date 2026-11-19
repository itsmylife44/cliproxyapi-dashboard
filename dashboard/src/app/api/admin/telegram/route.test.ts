import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  verifySession,
  validateOrigin,
  findUserUnique,
  findSettingUnique,
  upsertSetting,
  transaction,
} = vi.hoisted(() => ({
  verifySession: vi.fn(),
  validateOrigin: vi.fn(),
  findUserUnique: vi.fn(),
  findSettingUnique: vi.fn(),
  upsertSetting: vi.fn((args: unknown) => args),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin }));
vi.mock("@/lib/audit", () => ({
  AUDIT_ACTION: { TELEGRAM_SETTINGS_CHANGED: "TELEGRAM_SETTINGS_CHANGED" },
  extractIpAddress: vi.fn(() => "127.0.0.1"),
  logAuditAsync: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: vi.fn(),
  validateBotToken: vi.fn(() => true),
  validateChatId: vi.fn(() => true),
  formatQuotaAlertBatch: vi.fn(() => "alert"),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: findUserUnique },
    systemSetting: {
      findMany: vi.fn(),
      findUnique: findSettingUnique,
      upsert: upsertSetting,
    },
    $transaction: transaction,
  },
}));

import { PUT } from "@/app/api/admin/telegram/route";

function makePutRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/telegram", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/admin/telegram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifySession.mockResolvedValue({ userId: "admin-1", username: "admin" });
    validateOrigin.mockReturnValue(null);
    findUserUnique.mockResolvedValue({ isAdmin: true });
    transaction.mockResolvedValue([]);
  });

  it("syncs telegram_alerts_enabled to false when channel is discord even if enabled=true is sent", async () => {
    const webhook = "https://discord.com/api/webhooks/123456/token";
    const res = await PUT(makePutRequest({ channel: "discord", enabled: true, webhook }));

    expect(res.status).toBe(200);
    expect(upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "quota_alert_channel" },
        update: { value: "discord" },
      })
    );
    expect(upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "telegram_alerts_enabled" },
        update: { value: "false" },
      })
    );
  });

  it("derives quota_alert_channel when only legacy enabled is provided", async () => {
    const resEnable = await PUT(makePutRequest({ enabled: true }));
    expect(resEnable.status).toBe(200);
    expect(upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "quota_alert_channel" },
        update: { value: "telegram" },
      })
    );

    vi.clearAllMocks();
    verifySession.mockResolvedValue({ userId: "admin-1", username: "admin" });
    validateOrigin.mockReturnValue(null);
    findUserUnique.mockResolvedValue({ isAdmin: true });
    transaction.mockResolvedValue([]);

    const resDisable = await PUT(makePutRequest({ enabled: false }));
    expect(resDisable.status).toBe(200);
    expect(upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "quota_alert_channel" },
        update: { value: "disabled" },
      })
    );
  });

  it("rejects channel=discord when no valid webhook is provided or stored in DB", async () => {
    findSettingUnique.mockResolvedValue(null);
    const resMissing = await PUT(makePutRequest({ channel: "discord" }));
    expect(resMissing.status).toBe(400);

    const resEmpty = await PUT(makePutRequest({ channel: "discord", webhook: "" }));
    expect(resEmpty.status).toBe(400);

    findSettingUnique.mockResolvedValue({ key: "discord_quota_webhook", value: "" });
    const resMaskedEmpty = await PUT(makePutRequest({ channel: "discord", webhook: "********" }));
    expect(resMaskedEmpty.status).toBe(400);
  });

  it("allows channel=discord with exact mask '********' when a valid webhook is already in DB", async () => {
    findSettingUnique.mockResolvedValue({
      key: "discord_quota_webhook",
      value: "https://discord.com/api/webhooks/123456/existing",
    });

    const res = await PUT(makePutRequest({ channel: "discord", webhook: "********" }));
    expect(res.status).toBe(200);
    expect(upsertSetting).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "discord_quota_webhook" } })
    );
  });

  it("rejects non-exact asterisk strings for webhook instead of treating them as masked", async () => {
    const res = await PUT(makePutRequest({ channel: "telegram", webhook: "*not-a-mask" }));
    expect(res.status).toBe(400);
  });
});

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

import { runAlertCheck } from "@/lib/quota-alerts";

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
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  verifySession,
  validateOrigin,
  findUserUnique,
  upsertSetting,
  transaction,
} = vi.hoisted(() => ({
  verifySession: vi.fn(),
  validateOrigin: vi.fn(),
  findUserUnique: vi.fn(),
  upsertSetting: vi.fn(async (args: { where: { key: string }; create: { value: string } }) => ({
    id: `id-${args.where.key}`,
    key: args.where.key,
    value: args.create.value,
  })),
  transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/audit", () => ({
  AUDIT_ACTION: { SETTINGS_CHANGED: "SETTINGS_CHANGED" },
  extractIpAddress: vi.fn(() => "127.0.0.1"),
  logAuditAsync: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: findUserUnique },
    systemSetting: {
      findMany: vi.fn(),
      upsert: upsertSetting,
    },
    $transaction: transaction,
  },
}));

import { PUT } from "@/app/api/admin/settings/route";

function makePutRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifySession.mockResolvedValue({ userId: "admin-1", username: "admin" });
    validateOrigin.mockReturnValue(null);
    findUserUnique.mockResolvedValue({ isAdmin: true });
  });

  it("keeps quota_alert_channel in sync when telegram_alerts_enabled is updated", async () => {
    const resTrue = await PUT(
      makePutRequest({ key: "telegram_alerts_enabled", value: "true" })
    );
    expect(resTrue.status).toBe(200);
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

    const resFalse = await PUT(
      makePutRequest({ key: "telegram_alerts_enabled", value: "false" })
    );
    expect(resFalse.status).toBe(200);
    expect(upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "quota_alert_channel" },
        update: { value: "disabled" },
      })
    );
  });
});

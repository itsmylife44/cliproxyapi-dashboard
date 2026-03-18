import { describe, it, expect } from "vitest";
import { filterNotifications } from "@/lib/notification-dismissal";
import { buildNotifications } from "@/hooks/notification-utils";
import type { HealthStatus, QuotaAccount, UpdateCheckResult } from "@/hooks/notification-utils";

const NOW = 1000000;

const healthBothError: HealthStatus = { status: "degraded", database: "error", proxy: "error" };
const healthDbError: HealthStatus = { status: "degraded", database: "error", proxy: "connected" };
const healthProxyError: HealthStatus = { status: "degraded", database: "connected", proxy: "error" };
const healthOk: HealthStatus = { status: "ok", database: "connected", proxy: "connected" };

const accountWithCriticalQuota: QuotaAccount = {
  auth_index: "0",
  provider: "claude",
  email: "user@example.com",
  supported: true,
  groups: [{ id: "5h-session", label: "5h Session", remainingFraction: 0.02 }],
};

const accountWithWarnQuota: QuotaAccount = {
  auth_index: "1",
  provider: "gemini",
  email: "user@example.com",
  supported: true,
  groups: [{ id: "daily", label: "Daily Limit", remainingFraction: 0.15 }],
};

const proxyUpdate: UpdateCheckResult = {
  updateAvailable: true,
  latestVersion: "1.3.0",
  currentVersion: "1.2.3",
  buildInProgress: false,
};

const dashUpdate: UpdateCheckResult = {
  updateAvailable: true,
  latestVersion: "1.0.0",
  currentVersion: "0.9.0",
  buildInProgress: false,
};

describe("buildNotifications — deterministic IDs", () => {
  it("generates stable ID health-db when database is error", () => {
    const result = buildNotifications(healthDbError, null, null, null, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("health-db");
  });

  it("generates stable ID health-proxy when proxy is error", () => {
    const result = buildNotifications(healthProxyError, null, null, null, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("health-proxy");
  });

  it("generates stable ID for quota-critical notification", () => {
    const result = buildNotifications(
      healthOk,
      { accounts: [accountWithCriticalQuota] },
      null,
      null,
      NOW
    );
    const ids = result.map((n) => n.id);
    expect(ids).toContain("quota-critical-claude-0-5h-session");
  });

  it("generates stable ID for quota-warn notification", () => {
    const result = buildNotifications(
      healthOk,
      { accounts: [accountWithWarnQuota] },
      null,
      null,
      NOW
    );
    const ids = result.map((n) => n.id);
    expect(ids).toContain("quota-warn-gemini-1-daily");
  });

  it("generates stable ID update-proxy when proxy update available", () => {
    const result = buildNotifications(healthOk, null, proxyUpdate, null, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("update-proxy");
  });

  it("generates stable ID update-dashboard when dashboard update available", () => {
    const result = buildNotifications(healthOk, null, null, dashUpdate, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("update-dashboard");
  });

  it("IDs are identical across multiple calls with same inputs", () => {
    const inputs = [
      healthBothError,
      { accounts: [accountWithCriticalQuota, accountWithWarnQuota] },
      proxyUpdate,
      dashUpdate,
    ] as const;

    const first = buildNotifications(...inputs, NOW).map((n) => n.id);
    const second = buildNotifications(...inputs, NOW).map((n) => n.id);
    expect(first).toEqual(second);
  });
});

describe("buildNotifications — filtering dismissed IDs", () => {
  it("dismissed health-db ID filters out the notification (pure filtering test — PASSES)", () => {
    const notifications = buildNotifications(healthDbError, null, null, null, NOW);
    const dismissedIds = new Set(["health-db"]);
    const visible = notifications.filter((n) => !dismissedIds.has(n.id));
    expect(visible.length).toBe(notifications.length - 1);
  });

  it("dismissed quota-critical ID filters out critical notification from criticalCount (pure filtering test — PASSES)", () => {
    const notifications = buildNotifications(
      healthOk,
      { accounts: [accountWithCriticalQuota] },
      null,
      null,
      NOW
    );
    const dismissedIds = new Set(["quota-critical-claude-0-5h-session"]);
    const visible = notifications.filter((n) => !dismissedIds.has(n.id));
    const criticalCount = visible.filter((n) => n.type === "critical").length;
    expect(criticalCount).toBe(0);
  });

  it("filterNotifications removes health-db from totalCount", () => {
    const notifications = buildNotifications(healthDbError, null, null, null, NOW);
    const visible = filterNotifications(notifications, new Set(["health-db"]));
    expect(visible.length).toBe(notifications.length - 1);
    expect(visible.find((n) => n.id === "health-db")).toBeUndefined();
  });

  it("filterNotifications removes dismissed critical from criticalCount", () => {
    const notifications = buildNotifications(
      healthOk,
      { accounts: [accountWithCriticalQuota] },
      null,
      null,
      NOW
    );
    const visible = filterNotifications(
      notifications,
      new Set(["quota-critical-claude-0-5h-session"])
    );
    const criticalCount = visible.filter((n) => n.type === "critical").length;
    expect(criticalCount).toBe(0);
  });
});

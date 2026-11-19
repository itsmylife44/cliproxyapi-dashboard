import { describe, it, expect } from "vitest";
import { filterNotifications } from "@/lib/notification-dismissal";
import { buildNotifications } from "@/hooks/notification-utils";
import type { HealthStatus, UpdateCheckResult, TranslationFn } from "@/hooks/notification-utils";

const NOW = 1000000;
// Returns the key so assertions on IDs still pass; titles/messages are not tested here.
const t: TranslationFn = (key) => key;

const healthBothError: HealthStatus = { status: "degraded", database: "error", proxy: "error" };
const healthDbError: HealthStatus = { status: "degraded", database: "error", proxy: "connected" };
const healthProxyError: HealthStatus = { status: "degraded", database: "connected", proxy: "error" };
const healthOk: HealthStatus = { status: "ok", database: "connected", proxy: "connected" };

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
    const result = buildNotifications(healthDbError, null, null, t, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("health-db");
  });

  it("generates stable ID health-proxy when proxy is error", () => {
    const result = buildNotifications(healthProxyError, null, null, t, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("health-proxy");
  });

  it("generates stable ID update-proxy when proxy update available", () => {
    const result = buildNotifications(healthOk, proxyUpdate, null, t, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("update-proxy");
  });

  it("generates stable ID update-dashboard when dashboard update available", () => {
    const result = buildNotifications(healthOk, null, dashUpdate, t, NOW);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("update-dashboard");
  });

  it("IDs are identical across multiple calls with same inputs", () => {
    const inputs = [
      healthBothError,
      proxyUpdate,
      dashUpdate,
    ] as const;

    const first = buildNotifications(...inputs, t, NOW).map((n) => n.id);
    const second = buildNotifications(...inputs, t, NOW).map((n) => n.id);
    expect(first).toEqual(second);
  });
});

describe("buildNotifications — filtering dismissed IDs", () => {
  it("dismissed health-db ID filters out the notification", () => {
    const notifications = buildNotifications(healthDbError, null, null, t, NOW);
    const dismissedIds = new Set(["health-db"]);
    const visible = notifications.filter((n) => !dismissedIds.has(n.id));
    expect(visible.length).toBe(notifications.length - 1);
  });

  it("filterNotifications removes health-db from totalCount", () => {
    const notifications = buildNotifications(healthDbError, null, null, t, NOW);
    const visible = filterNotifications(notifications, new Set(["health-db"]));
    expect(visible.length).toBe(notifications.length - 1);
    expect(visible.find((n) => n.id === "health-db")).toBeUndefined();
  });

  it("filterNotifications removes dismissed critical from criticalCount", () => {
    const notifications = buildNotifications(healthProxyError, null, null, t, NOW);
    const visible = filterNotifications(
      notifications,
      new Set(["health-proxy"])
    );
    const criticalCount = visible.filter((n) => n.type === "critical").length;
    expect(criticalCount).toBe(0);
  });
});

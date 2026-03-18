"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import {
  buildNotifications,
  type Notification,
  type HealthStatus,
  type QuotaAccount,
  type UpdateCheckResult,
} from "@/hooks/notification-utils";
import {
  getDismissedIds,
  addDismissedId,
  filterNotifications,
} from "@/lib/notification-dismissal";

export type { NotificationType, Notification } from "@/hooks/notification-utils";

const CHECK_INTERVAL = 60_000; // 1 minute

function isDebugMode(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("debug-notifications");
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "mock-health-db",
    type: "critical",
    title: "Database Unreachable",
    message: "The database connection has failed. Some features may not work.",
    timestamp: Date.now(),
  },
  {
    id: "mock-quota-critical",
    type: "critical",
    title: "claude Quota Exhausted",
    message: "user@example.com — 5h Session at 2%",
    link: "/dashboard/quota",
    timestamp: Date.now(),
  },
  {
    id: "mock-quota-warn",
    type: "warning",
    title: "gemini Quota Low",
    message: "user@example.com — Daily Limit at 15%",
    link: "/dashboard/quota",
    timestamp: Date.now(),
  },
  {
    id: "mock-update-proxy",
    type: "info",
    title: "Proxy Update Available",
    message: "v1.2.3 → v1.3.0",
    link: "/dashboard/settings",
    timestamp: Date.now(),
  },
  {
    id: "mock-update-dashboard",
    type: "info",
    title: "Dashboard Update Available",
    message: "v0.9.0 → v1.0.0",
    link: "/dashboard/settings",
    timestamp: Date.now(),
  },
];

const silentFetcher = (url: string) =>
  fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

export function useHeaderNotifications(isAdmin: boolean, userId: string) {
  const debug = isDebugMode();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    getDismissedIds(userId)
  );

  useEffect(() => {
    setDismissedIds(getDismissedIds(userId));
  }, [userId]);

  const { data: healthData } = useSWR<HealthStatus>(
    debug ? null : API_ENDPOINTS.HEALTH,
    silentFetcher,
    { refreshInterval: CHECK_INTERVAL, dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  const { data: quotaData } = useSWR<{ accounts: QuotaAccount[] }>(
    debug ? null : API_ENDPOINTS.QUOTA.BASE,
    silentFetcher,
    { refreshInterval: CHECK_INTERVAL, dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  const { data: proxyUpdateData } = useSWR<UpdateCheckResult>(
    debug || !isAdmin ? null : API_ENDPOINTS.UPDATE.CHECK,
    silentFetcher,
    { refreshInterval: 5 * 60_000, dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  const { data: dashUpdateData } = useSWR<UpdateCheckResult>(
    debug || !isAdmin ? null : API_ENDPOINTS.UPDATE.DASHBOARD_CHECK,
    silentFetcher,
    { refreshInterval: 5 * 60_000, dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  const notifications = useMemo<Notification[]>(() => {
    if (debug) return MOCK_NOTIFICATIONS;

    const raw = buildNotifications(healthData, quotaData, proxyUpdateData, dashUpdateData);
    return filterNotifications(raw, dismissedIds);
  }, [debug, healthData, quotaData, proxyUpdateData, dashUpdateData, dismissedIds]);

  const criticalCount = notifications.filter((n) => n.type === "critical").length;
  const totalCount = notifications.length;

  const dismissNotification = useCallback(
    (id: string) => {
      addDismissedId(userId, id);
      setDismissedIds(getDismissedIds(userId));
    },
    [userId]
  );

  return { notifications, criticalCount, totalCount, dismissNotification };
}

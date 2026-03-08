"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

export type NotificationType = "critical" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  timestamp: number;
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email: string;
  supported: boolean;
  error?: string;
  groups?: Array<{
    id: string;
    label: string;
    remainingFraction: number;
  }>;
}

interface HealthStatus {
  status: "ok" | "degraded";
  database: "connected" | "error";
  proxy: "connected" | "error";
}

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  buildInProgress: boolean;
}

const CHECK_INTERVAL = 60_000; // 1 minute
const QUOTA_CRITICAL_THRESHOLD = 0.05; // 5%
const QUOTA_WARNING_THRESHOLD = 0.20; // 20%

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

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  });

const silentFetcher = (url: string) =>
  fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

export function useHeaderNotifications(isAdmin: boolean) {
  const debug = isDebugMode();

  // SWR hooks — same keys as other hooks = automatic deduplication
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

  // Same SWR keys as useUpdateCheck / useProxyUpdateCheck → deduplicated
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

    const items: Notification[] = [];
    const now = Date.now();

    // 1. Health
    if (healthData) {
      if (healthData.database === "error") {
        items.push({
          id: "health-db",
          type: "critical",
          title: "Database Unreachable",
          message: "The database connection has failed. Some features may not work.",
          timestamp: now,
        });
      }
      if (healthData.proxy === "error") {
        items.push({
          id: "health-proxy",
          type: "critical",
          title: "Proxy Unreachable",
          message: "Cannot connect to CLIProxyAPI backend service.",
          link: "/dashboard/monitoring",
          timestamp: now,
        });
      }
    }

    // 2. Quota warnings
    const accounts = quotaData?.accounts ?? [];
    for (const account of accounts) {
      if (!account.supported || !account.groups) continue;
      for (const group of account.groups) {
        if (group.remainingFraction <= QUOTA_CRITICAL_THRESHOLD) {
          items.push({
            id: `quota-critical-${account.provider}-${account.auth_index}-${group.id}`,
            type: "critical",
            title: `${account.provider} Quota Exhausted`,
            message: `${account.email} — ${group.label} at ${Math.round(group.remainingFraction * 100)}%`,
            link: "/dashboard/quota",
            timestamp: now,
          });
        } else if (group.remainingFraction <= QUOTA_WARNING_THRESHOLD) {
          items.push({
            id: `quota-warn-${account.provider}-${account.auth_index}-${group.id}`,
            type: "warning",
            title: `${account.provider} Quota Low`,
            message: `${account.email} — ${group.label} at ${Math.round(group.remainingFraction * 100)}%`,
            link: "/dashboard/quota",
            timestamp: now,
          });
        }
      }
    }

    // 3. Update checks
    if (proxyUpdateData?.updateAvailable && !proxyUpdateData.buildInProgress) {
      items.push({
        id: "update-proxy",
        type: "info",
        title: "Proxy Update Available",
        message: `${proxyUpdateData.currentVersion} → ${proxyUpdateData.latestVersion}`,
        link: "/dashboard/settings",
        timestamp: now,
      });
    }
    if (dashUpdateData?.updateAvailable && !dashUpdateData.buildInProgress) {
      items.push({
        id: "update-dashboard",
        type: "info",
        title: "Dashboard Update Available",
        message: `${dashUpdateData.currentVersion} → ${dashUpdateData.latestVersion}`,
        link: "/dashboard/settings",
        timestamp: now,
      });
    }

    return items;
  }, [debug, healthData, quotaData, proxyUpdateData, dashUpdateData]);

  const criticalCount = notifications.filter((n) => n.type === "critical").length;
  const totalCount = notifications.length;

  return { notifications, criticalCount, totalCount };
}

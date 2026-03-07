"use client";

import { useState, useEffect, useCallback } from "react";
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

export function useHeaderNotifications(isAdmin: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const checkAll = useCallback(async () => {
    const items: Notification[] = [];

    // 1. Health check (DB + Proxy connectivity)
    try {
      const res = await fetch(API_ENDPOINTS.HEALTH);
      if (res.ok) {
        const data: HealthStatus = await res.json();
        if (data.database === "error") {
          items.push({
            id: "health-db",
            type: "critical",
            title: "Database Unreachable",
            message: "The database connection has failed. Some features may not work.",
            timestamp: Date.now(),
          });
        }
        if (data.proxy === "error") {
          items.push({
            id: "health-proxy",
            type: "critical",
            title: "Proxy Unreachable",
            message: "Cannot connect to CLIProxyAPI backend service.",
            link: "/dashboard/monitoring",
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // Network error — proxy status in header already covers this
    }

    // 2. Quota warnings
    try {
      const res = await fetch(API_ENDPOINTS.QUOTA.BASE);
      if (res.ok) {
        const data = await res.json();
        const accounts: QuotaAccount[] = data.accounts ?? [];

        for (const account of accounts) {
          if (!account.supported || !account.groups) continue;

          for (const group of account.groups) {
            if (group.remainingFraction <= QUOTA_CRITICAL_THRESHOLD) {
              items.push({
                id: `quota-critical-${account.provider}-${group.id}`,
                type: "critical",
                title: `${account.provider} Quota Exhausted`,
                message: `${account.email} — ${group.label} at ${Math.round(group.remainingFraction * 100)}%`,
                link: "/dashboard/quota",
                timestamp: Date.now(),
              });
            } else if (group.remainingFraction <= QUOTA_WARNING_THRESHOLD) {
              items.push({
                id: `quota-warn-${account.provider}-${group.id}`,
                type: "warning",
                title: `${account.provider} Quota Low`,
                message: `${account.email} — ${group.label} at ${Math.round(group.remainingFraction * 100)}%`,
                link: "/dashboard/quota",
                timestamp: Date.now(),
              });
            }
          }
        }
      }
    } catch {
      // Quota endpoint may not be reachable
    }

    // 3. Update checks (admin only)
    if (isAdmin) {
      try {
        const [proxyRes, dashRes] = await Promise.all([
          fetch(API_ENDPOINTS.UPDATE.CHECK).catch(() => null),
          fetch(API_ENDPOINTS.UPDATE.DASHBOARD_CHECK).catch(() => null),
        ]);

        if (proxyRes?.ok) {
          const data: UpdateCheckResult = await proxyRes.json();
          if (data.updateAvailable && !data.buildInProgress) {
            items.push({
              id: "update-proxy",
              type: "info",
              title: "Proxy Update Available",
              message: `${data.currentVersion} → ${data.latestVersion}`,
              link: "/dashboard/settings",
              timestamp: Date.now(),
            });
          }
        }

        if (dashRes?.ok) {
          const data: UpdateCheckResult = await dashRes.json();
          if (data.updateAvailable && !data.buildInProgress) {
            items.push({
              id: "update-dashboard",
              type: "info",
              title: "Dashboard Update Available",
              message: `${data.currentVersion} → ${data.latestVersion}`,
              link: "/dashboard/settings",
              timestamp: Date.now(),
            });
          }
        }
      } catch {
        // Update check failures are non-critical
      }
    }

    setNotifications(items);
  }, [isAdmin]);

  useEffect(() => {
    // Delay initial check to let dashboard load first
    const initialTimeout = setTimeout(checkAll, 4000);
    const interval = setInterval(checkAll, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkAll]);

  const criticalCount = notifications.filter((n) => n.type === "critical").length;
  const totalCount = notifications.length;

  return { notifications, criticalCount, totalCount, refresh: checkAll };
}

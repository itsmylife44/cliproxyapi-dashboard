export type NotificationType = "critical" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  timestamp: number;
}

export interface QuotaAccount {
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

export interface HealthStatus {
  status: "ok" | "degraded";
  database: "connected" | "error";
  proxy: "connected" | "error";
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  buildInProgress: boolean;
}

export const QUOTA_CRITICAL_THRESHOLD = 0.05; // 5%
export const QUOTA_WARNING_THRESHOLD = 0.20;  // 20%

export function buildNotifications(
  healthData: HealthStatus | null | undefined,
  quotaData: { accounts: readonly QuotaAccount[] } | null | undefined,
  proxyUpdateData: UpdateCheckResult | null | undefined,
  dashUpdateData: UpdateCheckResult | null | undefined,
  now: number = Date.now()
): Notification[] {
  const items: Notification[] = [];

  // 1. Health notifications
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
}

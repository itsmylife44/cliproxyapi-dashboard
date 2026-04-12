// Minimal translation function type compatible with next-intl's useTranslations return value.
// Callers (hooks) obtain this via useTranslations('notifications') and pass it in; pure utility
// code never imports React or next-intl directly so it remains testable without a provider.
export type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

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
  t: TranslationFn,
  now: number = Date.now()
): Notification[] {
  const items: Notification[] = [];

  // 1. Health notifications
  if (healthData) {
    if (healthData.database === "error") {
      items.push({
        id: "health-db",
        type: "critical",
        title: t("healthDbTitle"),
        message: t("healthDbMessage"),
        timestamp: now,
      });
    }
    if (healthData.proxy === "error") {
      items.push({
        id: "health-proxy",
        type: "critical",
        title: t("healthProxyTitle"),
        message: t("healthProxyMessage"),
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
      const percent = Math.round(group.remainingFraction * 100);
      const message = t("quotaMessage", { email: account.email, label: group.label, percent });
      if (group.remainingFraction <= QUOTA_CRITICAL_THRESHOLD) {
        items.push({
          id: `quota-critical-${account.provider}-${account.auth_index}-${group.id}`,
          type: "critical",
          title: t("quotaExhaustedTitle", { provider: account.provider }),
          message,
          link: "/dashboard/quota",
          timestamp: now,
        });
      } else if (group.remainingFraction <= QUOTA_WARNING_THRESHOLD) {
        items.push({
          id: `quota-warn-${account.provider}-${account.auth_index}-${group.id}`,
          type: "warning",
          title: t("quotaLowTitle", { provider: account.provider }),
          message,
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
      title: t("proxyUpdateTitle"),
      message: t("updateVersionMessage", { current: proxyUpdateData.currentVersion, latest: proxyUpdateData.latestVersion }),
      link: "/dashboard/settings",
      timestamp: now,
    });
  }
  if (dashUpdateData?.updateAvailable && !dashUpdateData.buildInProgress) {
    items.push({
      id: "update-dashboard",
      type: "info",
      title: t("dashboardUpdateTitle"),
      message: t("updateVersionMessage", { current: dashUpdateData.currentVersion, latest: dashUpdateData.latestVersion }),
      link: "/dashboard/settings",
      timestamp: now,
    });
  }

  return items;
}

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

export function buildNotifications(
  healthData: HealthStatus | null | undefined,
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

  // 2. Update checks
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

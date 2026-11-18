"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { NotificationBell } from "@/components/header/notification-bell";
import { LatencyIndicator } from "@/components/header/latency-indicator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useHeaderNotifications } from "@/hooks/use-header-notifications";
import { useAuth } from "@/hooks/use-auth";

interface DashboardHeaderProps {
  onUserClick: () => void;
  username: string;
  isAdmin: boolean;
  externalStatus?: ProxyStatus | null;
}

interface ProxyStatus {
  running: boolean;
  containerName?: string;
  uptime?: number | null;
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "0m";

  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);

  return parts.join(" ");
}

const statusFetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch status");
    return res.json();
  });

export function DashboardHeader({ onUserClick, username, isAdmin, externalStatus }: DashboardHeaderProps) {
  const hasExternalStatus = externalStatus !== undefined;
  const { user } = useAuth();
  const { notifications, criticalCount, totalCount, dismissNotification } = useHeaderNotifications(isAdmin, user?.id ?? "");

  const { data: swrStatus, isLoading: swrLoading } = useSWR<ProxyStatus>(
    hasExternalStatus ? null : API_ENDPOINTS.PROXY.STATUS,
    statusFetcher,
    { refreshInterval: 30_000, dedupingInterval: 10_000, revalidateOnFocus: false, fallbackData: undefined }
  );

  const status = hasExternalStatus ? externalStatus : (swrStatus ?? null);
  const isLoading = hasExternalStatus ? status === null : swrLoading;

  const t = useTranslations("header");

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <header className="mb-5 flex w-full items-center justify-between border-b border-[var(--surface-border)] py-2.5">
      {/* Left Side: Live Ping */}
      <div
        className="flex items-center gap-2.5 text-sm"
        title={
          status?.running && status.uptime != null
            ? `${t('uptimeLabel')}${formatUptime(status.uptime)}`
            : undefined
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-[var(--text-muted)]">{t('checking')}</span>
          </div>
        ) : status?.running ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)]/40 px-2.5 py-1">
            <LatencyIndicator />
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-xs font-medium text-rose-600">{t('systemOffline')}</span>
          </div>
        )}
      </div>

      {/* Right Side: Notifications + User */}
      <div className="flex items-center gap-2">
        <NotificationBell
          notifications={notifications}
          criticalCount={criticalCount}
          totalCount={totalCount}
          onDismiss={dismissNotification}
        />
        <ThemeToggle />

        <button
          type="button"
          onClick={onUserClick}
          aria-label={t('userSettingsAriaLabel')}
          className="flex items-center gap-3 group transition-[color,box-shadow]"
        >
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
              {username}
            </span>
            {isAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t('adminBadge')}
              </span>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--surface-muted)] border border-[var(--surface-border)] flex items-center justify-center text-sm font-medium text-[var(--text-primary)] group-hover:border-[rgba(0,0,0,0.15)] group-hover:shadow-[rgba(78,50,23,0.04)_0px_6px_16px] transition-[color,border-color,box-shadow]">
            {initial}
          </div>
        </button>
      </div>
    </header>
  );
}

"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { NotificationBell } from "@/components/header/notification-bell";
import { LatencyIndicator } from "@/components/header/latency-indicator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useHeaderNotifications } from "@/hooks/use-header-notifications";
import { useAuth } from "@/hooks/use-auth";
import { useMobileSidebar } from "@/components/mobile-sidebar-context";

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

  const { isOpen: isSidebarOpen, toggle: toggleSidebar } = useMobileSidebar();
  const t = useTranslations("header");
  const tMobile = useTranslations("mobile");

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-[var(--surface-border)] bg-[var(--surface-base)]/85 px-3 py-2 backdrop-blur-md lg:static lg:mx-0 lg:mb-5 lg:w-full lg:bg-transparent lg:px-0 lg:py-2.5 lg:backdrop-blur-none">
      {/* Left Side: Mobile Menu + Brand (merged) + Live Ping */}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1 text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] lg:hidden"
          aria-label={tMobile("toggleMenuAriaLabel")}
          aria-expanded={isSidebarOpen}
          aria-controls="dashboard-navigation"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="flex min-w-0 items-center gap-1.5 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt={tMobile("logoAlt")}
            width={20}
            height={22}
            className="shrink-0 rounded-sm"
          />
          <span className="hidden truncate text-sm font-semibold tracking-tight text-[var(--text-primary)] min-[360px]:inline">
            {tMobile("appName")}
          </span>
        </div>

        <div
          className="flex shrink-0 items-center"
          title={
            status?.running && status.uptime != null
              ? `${t('uptimeLabel')}${formatUptime(status.uptime)}`
              : undefined
          }
        >
          {isLoading ? (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-[var(--text-muted)]">{t('checking')}</span>
            </div>
          ) : status?.running ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)]/40 px-2 py-0.5 sm:px-2.5 sm:py-1">
              <LatencyIndicator />
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1">
              <div className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-xs font-medium text-rose-600">{t('systemOffline')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Notifications + Theme + User */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] text-xs font-medium text-[var(--text-primary)] transition-[color,border-color,box-shadow] group-hover:border-[rgba(0,0,0,0.15)] group-hover:shadow-[rgba(78,50,23,0.04)_0px_6px_16px] sm:h-9 sm:w-9 sm:text-sm">
            {initial}
          </div>
        </button>
      </div>
    </header>
  );
}

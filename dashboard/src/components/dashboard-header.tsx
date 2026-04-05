"use client";

import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { NotificationBell } from "@/components/header/notification-bell";
import { LatencyIndicator } from "@/components/header/latency-indicator";
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

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <header className="w-full bg-slate-900/40 border-b border-slate-700/70 backdrop-blur-sm py-2.5 px-4 lg:px-6 rounded-lg mb-4 flex items-center justify-between">
      {/* Left Side: Status + Latency */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-slate-400">Checking\u2026</span>
            </>
          ) : status?.running ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="text-emerald-400 font-medium">All systems operational</span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-red-400 font-medium">System offline</span>
            </>
          )}
        </div>

        {status?.running && status.uptime != null && (
          <>
            <div className="w-px h-4 bg-slate-700" />
            <span className="text-slate-400 text-xs">
              Uptime: {formatUptime(status.uptime)}
            </span>
          </>
        )}

        {status?.running && (
          <>
            <div className="hidden sm:block w-px h-4 bg-slate-700" />
            <div className="hidden sm:block">
              <LatencyIndicator />
            </div>
          </>
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

        <button
          type="button"
          onClick={onUserClick}
          aria-label="User settings"
          className="flex items-center gap-3 group transition-[color,box-shadow]"
        >
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
              {username}
            </span>
            {isAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                Admin
              </span>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-800/60 border border-slate-600/50 flex items-center justify-center text-sm font-medium text-slate-200 group-hover:border-blue-400/50 group-hover:shadow-[0_0_10px_rgba(96,165,250,0.2)] transition-[color,border-color,box-shadow]">
            {initial}
          </div>
        </button>
      </div>
    </header>
  );
}

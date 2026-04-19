"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface LogEntry {
  level: number;
  levelLabel: string;
  time: number;
  msg: string;
  err?: unknown;
  [key: string]: unknown;
}

interface LogStats {
  memoryCount: number;
  fileCount: number;
  fileSizeKB: number;
  rotatedFiles: number;
  persistent: boolean;
}

const DEFAULT_LEVEL_BADGE_CLASS =
  "text-[var(--text-muted)] bg-[var(--surface-muted)] border-[var(--surface-border)]";

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-600 bg-red-500/100/10 border-red-500/20",
  fatal: "text-red-600 bg-red-500/100/10 border-red-500/20",
  warn: "text-yellow-700 bg-yellow-500/100/10 border-yellow-500/20",
  info: "text-blue-600 bg-blue-500/100/10 border-blue-500/20",
  debug: DEFAULT_LEVEL_BADGE_CLASS,
  trace: DEFAULT_LEVEL_BADGE_CLASS,
};

const LEVEL_FILTERS = ["all", "error", "warn", "info", "debug"] as const;
type LevelFilter = (typeof LEVEL_FILTERS)[number];

const LOGS_PER_PAGE = 50;
const EMPTY_LOGS: LogEntry[] = [];

function formatRelativeTime(timestamp: number, t: ReturnType<typeof useTranslations>): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    const seconds = Math.floor(diff / 1000);
    return seconds <= 1 ? t('justNow') : t('secondsAgo', { count: seconds });
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes === 1 ? t('minuteAgo') : t('minutesAgo', { count: minutes });
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return hours === 1 ? t('hourAgo') : t('hoursAgo', { count: hours });
  }

  const days = Math.floor(diff / 86400000);
  return days === 1 ? t('dayAgo') : t('daysAgo', { count: days });
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>(EMPTY_LOGS);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { showToast } = useToast();
  const router = useRouter();
  const t = useTranslations('logs');
  const tc = useTranslations('common');

  const fetchLogs = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (levelFilter !== "all") {
        params.set("level", levelFilter);
      }
      params.set("limit", "200");

      const res = await fetch(`${API_ENDPOINTS.ADMIN.LOGS}?${params.toString()}`, { signal });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        showToast(t('toastAdminRequired'), "error");
        router.push("/dashboard");
        return;
      }

      if (!res.ok) {
        showToast(t('toastLoadFailed'), "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      if (data.stats) {
        setStats(data.stats);
      }
      setLoading(false);
    } catch {
      if (signal?.aborted) return;
      showToast(t('toastNetworkError'), "error");
      setLoading(false);
    }
  }, [levelFilter, router, showToast, t]);

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const pagedLogs = logs.slice(
    (activePage - 1) * LOGS_PER_PAGE,
    activePage * LOGS_PER_PAGE
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchLogs(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchLogs]);

  useEffect(() => {
    const controller = new AbortController();

    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        void fetchLogs(controller.signal);
      }, 5000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      controller.abort();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, fetchLogs]);

  const confirmClear = () => {
    setShowConfirm(true);
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.LOGS, { method: "DELETE" });

      if (!res.ok) {
        showToast(t('toastClearFailed'), "error");
        setClearing(false);
        return;
      }

      showToast(t('toastCleared'), "success");
      setLogs([]);
      setTotal(0);
      setStats(null);
      setClearing(false);
    } catch {
      showToast(t('toastNetworkError'), "error");
      setClearing(false);
    }
  };

  const toggleRowExpansion = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  const getLevelBadgeClass = (level: string): string => {
    return LEVEL_COLORS[level] ?? DEFAULT_LEVEL_BADGE_CLASS;
  };

  const renderLogDetails = (log: LogEntry): string => {
    const details: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(log)) {
      if (!["level", "levelLabel", "time", "msg"].includes(key)) {
        details[key] = value;
      }
    }
    return Object.keys(details).length > 0
      ? JSON.stringify(details, null, 2)
      : t('noAdditionalDetails');
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: tc('dashboard'), href: "/dashboard" }, { label: tc('admin') }, { label: t('breadcrumbLabel') }]} />
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('applicationLogsTitle')}</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('eventLogDescription')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="level-filter" className="text-xs text-[var(--text-muted)]">
                {t('levelLabel')}
              </label>
              <select
                id="level-filter"
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value as LevelFilter);
                  setCurrentPage(1);
                }}
                className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-400/50 transition-colors"
              >
                {LEVEL_FILTERS.map((level) => (
                  <option key={level} value={level} className="bg-[var(--surface-base)]">
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="size-4 rounded border-[var(--surface-border)]/70 bg-[var(--surface-base)] text-[var(--text-primary)] focus:ring-2 focus:ring-black/20 focus:ring-offset-0"
              />
              <span className="text-xs text-[var(--text-muted)]">{t('autoRefresh')}</span>
            </label>

            <Button onClick={() => void fetchLogs()} variant="secondary" className="px-2.5 py-1 text-xs">
              {t('refreshButton')}
            </Button>

            <Button onClick={confirmClear} variant="danger" disabled={clearing} className="px-2.5 py-1 text-xs">
              {clearing ? t('clearing') : t('clearLogsButton')}
            </Button>
          </div>
        </div>
      </section>

      {stats && (
        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${stats.persistent ? "bg-green-500/100" : "bg-yellow-500/100"}`} />
            {stats.persistent ? t('persistentStorageEnabled') : t('persistentStorageDisabled')}
          </span>
          <span>{t('memoryLogs', { count: stats.memoryCount })}</span>
          <span>{t('fileLogs', { count: stats.fileCount, sizeKB: stats.fileSizeKB })}</span>
          {stats.rotatedFiles > 0 && <span>{t('rotatedFiles', { count: stats.rotatedFiles })}</span>}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('logEntriesHeader')}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {logs.length > 0
              ? t('showingLogs', { start: (activePage - 1) * LOGS_PER_PAGE + 1, end: Math.min(activePage * LOGS_PER_PAGE, logs.length), total: logs.length })
              : t('totalLogsCount', { total: total })}
          </span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-[var(--text-muted)]">{t('loadingText')}</div>
        ) : logs.length === 0 ? (
          <div className="p-4">
            <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-muted)]">
              {t('emptyState')}
            </div>
          </div>
        ) : (
          <div className="max-h-[clamp(300px,60vh,700px)] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]/95">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] w-36">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] w-20">
                    Level
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Message
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] w-20">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((log, index) => {
                  const globalIndex = (activePage - 1) * LOGS_PER_PAGE + index;
                  return (
                  <React.Fragment key={`log-${log.time}-${globalIndex}`}>
                    <tr
                      className="border-b border-[var(--surface-border)] last:border-b-0 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(globalIndex)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-[var(--text-primary)]">
                            {formatRelativeTime(log.time, t)}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {formatTimestamp(log.time)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getLevelBadgeClass(log.levelLabel)}`}
                        >
                          {log.levelLabel.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-primary)] font-mono break-all max-w-md">
                        {log.msg}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          {expandedRow === globalIndex ? t('hide') : t('show')}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === globalIndex && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-3 bg-[var(--surface-base)] border-b border-[var(--surface-border)]"
                        >
                          <pre className="text-xs text-[var(--text-muted)] font-mono whitespace-pre-wrap overflow-auto max-h-64">
                            {renderLogDetails(log)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--surface-border)] px-3 py-2">
            <Button
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="px-2.5 py-1 text-xs"
            >
              {t('previous')}
            </Button>
            <span className="text-xs text-[var(--text-muted)]">
              {t('pageOf', { page: activePage, total: totalPages })}
            </span>
            <Button
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage === totalPages}
              className="px-2.5 py-1 text-xs"
            >
              {t('next')}
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleClearLogs}
        title={t('clearAllLogsTitle')}
        message={t('clearAllLogsMessage')}
        confirmLabel={t('clearButton')}
        cancelLabel={tc('cancel')}
        variant="danger"
      />
    </div>
  );
}

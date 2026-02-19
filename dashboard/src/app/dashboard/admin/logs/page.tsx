"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400 bg-red-500/10 border-red-500/30",
  fatal: "text-red-400 bg-red-500/10 border-red-500/30",
  warn: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  info: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  debug: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  trace: "text-gray-500 bg-gray-500/10 border-gray-500/30",
};

const LEVEL_FILTERS = ["all", "error", "warn", "info", "debug"] as const;
type LevelFilter = (typeof LEVEL_FILTERS)[number];

const EMPTY_LOGS: LogEntry[] = [];

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    const seconds = Math.floor(diff / 1000);
    return seconds <= 1 ? "just now" : `${seconds}s ago`;
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(diff / 86400000);
  return days === 1 ? "1 day ago" : `${days} days ago`;
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
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { showToast } = useToast();
  const router = useRouter();

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (levelFilter !== "all") {
        params.set("level", levelFilter);
      }
      params.set("limit", "200");

      const res = await fetch(`/api/admin/logs?${params.toString()}`);

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        showToast("Admin access required", "error");
        router.push("/dashboard");
        return;
      }

      if (!res.ok) {
        showToast("Failed to load logs", "error");
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
      showToast("Network error", "error");
      setLoading(false);
    }
  }, [levelFilter, router, showToast]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        void fetchLogs();
      }, 5000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
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
      const res = await fetch("/api/admin/logs", { method: "DELETE" });

      if (!res.ok) {
        showToast("Failed to clear logs", "error");
        setClearing(false);
        return;
      }

      showToast("Logs cleared", "success");
      setLogs([]);
      setTotal(0);
      setStats(null);
      setClearing(false);
    } catch {
      showToast("Network error", "error");
      setClearing(false);
    }
  };

  const toggleRowExpansion = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  const getLevelBadgeClass = (level: string): string => {
    return LEVEL_COLORS[level] ?? LEVEL_COLORS.debug;
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
      : "No additional details";
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Application Logs</h1>
            <p className="mt-1 text-xs text-slate-400">Dashboard application event log.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="level-filter" className="text-xs text-slate-400">
                Level:
              </label>
              <select
                id="level-filter"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
                className="rounded-sm border border-slate-700/70 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-400/50 transition-colors"
              >
                {LEVEL_FILTERS.map((level) => (
                  <option key={level} value={level} className="bg-slate-900">
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
                className="size-4 rounded border-slate-600/70 bg-slate-900/40 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400">Auto-refresh (5s)</span>
            </label>

            <Button onClick={() => void fetchLogs()} variant="secondary" className="px-2.5 py-1 text-xs">
              Refresh
            </Button>

            <Button onClick={confirmClear} variant="danger" disabled={clearing} className="px-2.5 py-1 text-xs">
              {clearing ? "Clearing..." : "Clear Logs"}
            </Button>
          </div>
        </div>
      </section>

      {stats && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${stats.persistent ? "bg-green-500" : "bg-yellow-500"}`} />
            Persistent storage {stats.persistent ? "enabled" : "disabled"}
          </span>
          <span>Memory: {stats.memoryCount} logs</span>
          <span>File: {stats.fileCount} logs ({stats.fileSizeKB} KB)</span>
          {stats.rotatedFiles > 0 && <span>Rotated files: {stats.rotatedFiles}</span>}
        </div>
      )}

      <section className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
        <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Log Entries</span>
          <span className="text-xs text-slate-400">
            Showing {logs.length} of {total} logs
          </span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-4">
            <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4 text-sm text-slate-400">
              No logs found. Logs will appear here when application events occur.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/70 bg-slate-900/60">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 w-36">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 w-20">
                    Level
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Message
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 w-20">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <React.Fragment key={`log-${log.time}-${index}`}>
                    <tr
                      className="border-b border-slate-700/60 last:border-b-0 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(index)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-200">
                            {formatRelativeTime(log.time)}
                          </span>
                          <span className="text-[10px] text-slate-400">
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
                      <td className="px-3 py-2 text-xs text-slate-200 font-mono break-all max-w-md">
                        {log.msg}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-blue-400 hover:text-blue-300 text-xs underline"
                        >
                          {expandedRow === index ? "Hide" : "Show"}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === index && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-3 bg-slate-900/30 border-b border-slate-700/60"
                        >
                          <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap overflow-auto max-h-64">
                            {renderLogDetails(log)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleClearLogs}
        title="Clear All Logs"
        message="Are you sure you want to clear all logs?"
        confirmLabel="Clear"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}

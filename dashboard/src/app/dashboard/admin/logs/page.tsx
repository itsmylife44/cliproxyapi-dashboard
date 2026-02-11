"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

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

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all logs?")) {
      return;
    }

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
          Application Logs
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="level-filter" className="text-sm text-white/70">
              Level:
            </label>
            <select
              id="level-filter"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
              className="rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {LEVEL_FILTERS.map((level) => (
                <option key={level} value={level} className="bg-gray-900">
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
              className="size-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0"
            />
            <span className="text-sm text-white/70">Auto-refresh (5s)</span>
          </label>

          <Button onClick={() => void fetchLogs()} variant="secondary">
            Refresh
          </Button>

          <Button onClick={handleClearLogs} variant="danger" disabled={clearing}>
            {clearing ? "Clearing..." : "Clear Logs"}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-4 text-xs text-white/60">
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${stats.persistent ? "bg-green-500" : "bg-yellow-500"}`} />
            Persistent storage {stats.persistent ? "enabled" : "disabled"}
          </span>
          <span>Memory: {stats.memoryCount} logs</span>
          <span>File: {stats.fileCount} logs ({stats.fileSizeKB} KB)</span>
          {stats.rotatedFiles > 0 && <span>Rotated files: {stats.rotatedFiles}</span>}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Log Entries</CardTitle>
            <span className="text-xs text-white/50">
              Showing {logs.length} of {total} logs
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 text-center text-white">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="border-l-4 border-white/30 backdrop-blur-xl bg-white/5 p-4 text-sm text-white/80 rounded-r-xl">
              No logs found. Logs will appear here when application events occur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 font-medium text-white/70 w-36">
                      Time
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-white/70 w-20">
                      Level
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-white/70">
                      Message
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-white/70 w-20">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <React.Fragment key={`log-${log.time}-${index}`}>
                      <tr
                        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => toggleRowExpansion(index)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-white/90 text-xs">
                              {formatRelativeTime(log.time)}
                            </span>
                            <span className="text-white/50 text-[10px]">
                              {formatTimestamp(log.time)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getLevelBadgeClass(log.levelLabel)}`}
                          >
                            {log.levelLabel.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white/80 font-mono text-xs break-all max-w-md">
                          {log.msg}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            className="text-purple-400 hover:text-purple-300 text-xs underline"
                          >
                            {expandedRow === index ? "Hide" : "Show"}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === index && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-3 px-4 bg-black/20 border-b border-white/5"
                          >
                            <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap overflow-auto max-h-64">
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
        </CardContent>
      </Card>
    </div>
  );
}

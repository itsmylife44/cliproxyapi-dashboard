"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const LOGS_PER_PAGE = 50;

const LOG_LEVEL = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  UNKNOWN: "unknown",
} as const;

type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

interface LogsResponse {
  lines: string[];
  "line-count": number;
  "latest-timestamp": number;
}

interface FetchLogsParams {
  setLogs: (logs: string[]) => void;
  setLatestTimestamp: (timestamp: number | null) => void;
  setLoading: (loading: boolean) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  after?: number | null;
  append?: boolean;
  currentLogs?: string[];
}

async function fetchLogs({
  setLogs,
  setLatestTimestamp,
  setLoading,
  showToast,
  after,
  append,
  currentLogs,
}: FetchLogsParams) {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (after) {
      params.set("after", String(after));
    }
    const res = await fetch(`/api/management/logs?${params.toString()}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const errorMsg = errorData?.error;
      if (errorMsg === "logging to file disabled") {
        setLogs([]);
        setLoading(false);
        return;
      }
      showToast("Failed to load logs", "error");
      setLoading(false);
      return;
    }

    const data: LogsResponse = await res.json();
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const nextLogs = append && currentLogs ? [...currentLogs, ...lines] : lines;
    setLogs(nextLogs);
    setLatestTimestamp(data["latest-timestamp"] ?? null);
    setLoading(false);
  } catch {
    showToast("Network error", "error");
    setLoading(false);
  }
}

function getLogLevel(line: string): LogLevel {
  const match = line.match(/\[(info|warn|warning|error)\s*\]/i);
  const normalized = match?.[1]?.toLowerCase();
  if (normalized === "error") return LOG_LEVEL.ERROR;
  if (normalized === "warn" || normalized === "warning") return LOG_LEVEL.WARN;
  if (normalized === "info") return LOG_LEVEL.INFO;
  return LOG_LEVEL.UNKNOWN;
}

function getLevelColor(level: LogLevel) {
  switch (level) {
    case LOG_LEVEL.ERROR:
      return "text-red-400";
    case LOG_LEVEL.WARN:
      return "text-yellow-300";
    case LOG_LEVEL.INFO:
      return "text-blue-300";
    default:
      return "text-zinc-300";
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestTimestamp, setLatestTimestamp] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { showToast } = useToast();
  const logsRef = useRef<string[]>([]);
  const latestTimestampRef = useRef<number | null>(null);
  const loadingRef = useRef<boolean>(true);

  const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const pagedLogs = logs.slice(
    (currentPage - 1) * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE
  );

  useEffect(() => {
    void fetchLogs({ setLogs, setLatestTimestamp, setLoading, showToast });
  }, [showToast]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    latestTimestampRef.current = latestTimestamp;
  }, [latestTimestamp]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (loadingRef.current) return;
      void fetchLogs({
        setLogs,
        setLatestTimestamp,
        setLoading,
        showToast,
        after: latestTimestampRef.current,
        append: true,
        currentLogs: logsRef.current,
      });
    }, 10000);

    return () => window.clearInterval(interval);
  }, [showToast]);

  const handleRefresh = () => {
    setCurrentPage(1);
    void fetchLogs({
      setLogs,
      setLatestTimestamp,
      setLoading,
      showToast,
      after: latestTimestamp,
      append: true,
      currentLogs: logs,
    });
  };

  const confirmClear = () => {
    setShowConfirm(true);
  };

  const handleClearLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/management/logs", { method: "DELETE" });
      if (!res.ok) {
        showToast("Failed to clear logs", "error");
        setLoading(false);
        return;
      }
      setLogs([]);
      setLatestTimestamp(null);
      setCurrentPage(1);
      setLoading(false);
      showToast("Logs cleared", "success");
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">Logs</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRefresh} disabled={loading} className="px-2.5 py-1 text-xs">
            Refresh
          </Button>
          <Button onClick={confirmClear} disabled={loading} className="px-2.5 py-1 text-xs">
            Clear Logs
          </Button>
        </div>
      </div>
      </section>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleClearLogs}
        title="Clear All Logs"
        message="Clear all logs? This cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        variant="danger"
      />

      <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Recent Logs</h2>
          {loading ? (
            <div className="p-4 text-center text-slate-400">Loading logs...</div>
          ) : logs.length === 0 ? (
              <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4 text-sm text-slate-400">
                No logs available. File logging may be disabled in the CLIProxyAPI configuration.
                Check <code className="rounded bg-slate-800/80 px-1">logging-to-file</code> in config.
              </div>
          ) : (
            <div
              className="max-h-[520px] overflow-y-auto rounded-sm border border-slate-700/70 bg-black/50 p-4 font-mono text-xs text-zinc-200"
            >
              <div className="space-y-1">
                {pagedLogs.map((line, index) => {
                  const level = getLogLevel(line);
                  return (
                    <div key={`${(currentPage - 1) * LOGS_PER_PAGE + index}-${line}`} className={`${getLevelColor(level)} break-all`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs"
              >
                ← Previous
              </Button>
              <span className="text-xs text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs"
              >
                Next →
              </Button>
            </div>
          )}
      </section>

      <div className="rounded-sm border border-slate-700/70 bg-slate-900/25 p-4 text-xs text-slate-400">
        <strong>TIP:</strong> Logs are fetched from the CLIProxyAPI service. Recent entries are shown here.
        For complete logs, check the Docker container logs.
      </div>
    </div>
  );
}

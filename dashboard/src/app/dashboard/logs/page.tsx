"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

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
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const logsRef = useRef<string[]>([]);
  const latestTimestampRef = useRef<number | null>(null);
  const loadingRef = useRef<boolean>(true);

  useEffect(() => {
    void fetchLogs({ setLogs, setLatestTimestamp, setLoading, showToast });
  }, [showToast]);

  const logsCount = logs.length;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (logsCount >= 0) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logsCount]);

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

  const handleClearLogs = async () => {
    const confirmed = window.confirm("Clear all logs? This cannot be undone.");
    if (!confirmed) return;
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
      setLoading(false);
      showToast("Logs cleared", "success");
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-lg">
          Logs
        </h1>
        <div className="flex items-center gap-3">
          <Button onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={handleClearLogs} disabled={loading}>
            Clear Logs
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 text-center text-white">Loading logs...</div>
          ) : logs.length === 0 ? (
              <div className="border-l-4 border-white/30 backdrop-blur-xl bg-white/5 p-4 text-sm text-white/80 rounded-r-xl">
                No logs available. File logging may be disabled in the CLIProxyAPI configuration.
                Check <code className="bg-white/10 px-1 rounded">logging-to-file</code> in config.
              </div>
          ) : (
            <div
              ref={containerRef}
              className="max-h-[520px] overflow-y-auto backdrop-blur-2xl bg-black/60 border border-white/20 rounded-xl p-4 font-mono text-xs text-zinc-200 shadow-2xl"
            >
              <div className="space-y-1">
                {logs.map((line, index) => {
                  const level = getLogLevel(line);
                  return (
                    <div key={`${index}-${line}`} className={getLevelColor(level)}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="border-l-4 border-blue-400/60 backdrop-blur-xl bg-white/10 p-4 text-xs text-white rounded-r-xl">
        <strong>TIP:</strong> Logs are fetched from the CLIProxyAPI service. Recent entries are shown here.
        For complete logs, check the Docker container logs.
      </div>
    </div>
  );
}

"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface StatusResponse {
  running: boolean;
  containerName?: string;
  uptime?: number;
  error?: string;
}

interface UsageResponse {
  usage: {
    total_requests: number;
    success_count: number;
    failure_count: number;
    total_tokens: number;
    requests_by_day?: Record<string, number>;
    requests_by_hour?: Record<string, number>;
    apis?: Record<string, {
      total_requests: number;
      models?: Record<string, {
        total_requests: number;
        total_tokens: number;
      }>;
    }>;
  };
}

interface LogResponse {
  lines: string[];
  "line-count": number;
  "latest-timestamp": number;
}

interface LogLine {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

const LOGGING_STATE = {
  CHECKING: "checking",
  ENABLED: "enabled",
  DISABLED: "disabled",
  ERROR: "error",
} as const;

type LoggingState = (typeof LOGGING_STATE)[keyof typeof LOGGING_STATE];

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

function parseLogLine(line: string, index: number): LogLine {
  const logRegex = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(info|error|warn|debug)\s+(.+)$/i;
  const match = line.match(logRegex);

  if (match) {
    return {
      id: `${match[1]}-${index}`,
      timestamp: match[1],
      level: match[2].toLowerCase(),
      message: match[3],
      raw: line,
    };
  }

  return {
    id: `${Date.now()}-${index}`,
    timestamp: "",
    level: "info",
    message: line,
    raw: line,
  };
}

export default function MonitoringPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [restarting, setRestarting] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loggingState, setLoggingState] = useState<LoggingState>(LOGGING_STATE.CHECKING);
  const [loggingError, setLoggingError] = useState<string | null>(null);
  const [enablingLogging, setEnablingLogging] = useState(false);
  const logsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/proxy/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      }
    };

    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 5000);

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/management/usage");
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch (error) {
        console.error("Failed to fetch usage:", error);
      }
    };

    fetchUsage();
    const usageInterval = setInterval(fetchUsage, 5000);

    return () => clearInterval(usageInterval);
  }, []);

  useEffect(() => {
    const checkLoggingStatus = async () => {
      try {
        const res = await fetch("/api/management/logging-to-file");
        if (res.ok) {
          const data = await res.json();
          if (data["logging-to-file"]) {
            setLoggingState(LOGGING_STATE.ENABLED);
          } else {
            setLoggingState(LOGGING_STATE.DISABLED);
          }
        } else {
          setLoggingState(LOGGING_STATE.ERROR);
          setLoggingError("Failed to check logging status");
        }
      } catch {
        setLoggingState(LOGGING_STATE.ERROR);
        setLoggingError("Could not reach the API to check logging status");
      }
    };

    checkLoggingStatus();
  }, []);

  const lastTimestampRef = useRef(0);

  useEffect(() => {
    if (loggingState !== LOGGING_STATE.ENABLED) {
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
        logsIntervalRef.current = null;
      }
      return;
    }

    const fetchLogs = async () => {
      try {
        const url = lastTimestampRef.current > 0
          ? `/api/management/logs?after=${lastTimestampRef.current}`
          : "/api/management/logs";

        const res = await fetch(url);
        if (res.ok) {
          const data: LogResponse = await res.json();
          if (data.lines && data.lines.length > 0) {
            setLogs((prev) => {
              const startIdx = prev.length;
              const parsedLines = data.lines.map((line, idx) => parseLogLine(line, startIdx + idx));
              return [...prev, ...parsedLines].slice(-500);
            });
            lastTimestampRef.current = data["latest-timestamp"];
          }
        } else {
          setLoggingState(LOGGING_STATE.ERROR);
          setLoggingError(`Logs request failed with status ${res.status}`);
          if (logsIntervalRef.current) {
            clearInterval(logsIntervalRef.current);
            logsIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
        setLoggingState(LOGGING_STATE.ERROR);
        setLoggingError("Network error while fetching logs");
        if (logsIntervalRef.current) {
          clearInterval(logsIntervalRef.current);
          logsIntervalRef.current = null;
        }
      }
    };

    fetchLogs();
    logsIntervalRef.current = setInterval(fetchLogs, 2000);

    return () => {
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
        logsIntervalRef.current = null;
      }
    };
  }, [loggingState]);

  const handleEnableLogging = async () => {
    setEnablingLogging(true);
    try {
      const res = await fetch("/api/management/logging-to-file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: true }),
      });

      if (res.ok) {
        setLoggingState(LOGGING_STATE.ENABLED);
        setLoggingError(null);
        setLogs([]);
        lastTimestampRef.current = 0;
      } else {
        setLoggingError("Failed to enable logging");
      }
    } catch {
      setLoggingError("Network error while enabling logging");
    } finally {
      setEnablingLogging(false);
    }
  };

  const handleRetryLogging = () => {
    setLoggingState(LOGGING_STATE.CHECKING);
    setLoggingError(null);
    setLogs([]);
    lastTimestampRef.current = 0;

    const recheckLogging = async () => {
      try {
        const res = await fetch("/api/management/logging-to-file");
        if (res.ok) {
          const data = await res.json();
          if (data["logging-to-file"]) {
            setLoggingState(LOGGING_STATE.ENABLED);
          } else {
            setLoggingState(LOGGING_STATE.DISABLED);
          }
        } else {
          setLoggingState(LOGGING_STATE.ERROR);
          setLoggingError("Failed to check logging status");
        }
      } catch {
        setLoggingState(LOGGING_STATE.ERROR);
        setLoggingError("Could not reach the API");
      }
    };

    recheckLogging();
  };

  const handleRestart = async () => {
    if (!confirm("Are you sure you want to restart the CLIProxyAPI service?")) {
      return;
    }

    setRestarting(true);
    try {
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      if (res.ok) {
        setTimeout(() => {
          setRestarting(false);
        }, 5000);
      } else {
        setRestarting(false);
      }
    } catch (error) {
      console.error("Restart failed:", error);
      setRestarting(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const modelStats = usage?.usage.apis
    ? Object.entries(usage.usage.apis).flatMap(([, data]) =>
        data.models
          ? Object.entries(data.models).map(([model, stats]) => ({
              model,
              requests: stats.total_requests,
              tokens: stats.total_tokens,
            }))
          : []
      )
    : [];

  const hourlyData = usage?.usage.requests_by_hour
    ? Object.entries(usage.usage.requests_by_hour).map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
      }))
    : [];

   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           Monitoring
         </h1>
       </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">CLIProxyAPI</span>
              {status?.running ? (
                <span className="backdrop-blur-xl bg-emerald-500/30 border border-emerald-400/40 px-3 py-1 text-xs font-medium text-white rounded-lg">
                  RUNNING
                </span>
              ) : (
                <span className="backdrop-blur-xl bg-red-500/30 border border-red-400/40 px-3 py-1 text-xs font-medium text-white rounded-lg">
                  STOPPED
                </span>
              )}
            </div>

            {status?.uptime !== null && status?.uptime !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Uptime</span>
                <span className="text-sm text-white/70">{formatUptime(status.uptime)}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleRestart}
                disabled={restarting}
                className="flex-1 py-2 text-sm"
              >
                {restarting ? "Restarting..." : "Restart Service"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
        </CardHeader>
        <CardContent>
           {usage ? (
             <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="border-l-4 border-cyan-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-2xl font-bold text-white">
                    {(usage.usage?.total_requests ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Total Requests
                  </div>
                </div>
                <div className="border-l-4 border-green-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-2xl font-bold text-white">
                    {(usage.usage?.success_count ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Success
                  </div>
                </div>
                <div className="border-l-4 border-red-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                  <div className="text-2xl font-bold text-white">
                    {(usage.usage?.failure_count ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    Failed
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-amber-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                <div className="text-2xl font-bold text-white">
                  {(usage.usage?.total_tokens ?? 0).toLocaleString()}
                </div>
                <div className="mt-1 text-xs font-medium text-white/70">
                  Total Tokens
                </div>
              </div>

              {modelStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-3">Requests by Model</h3>
                  <div className="space-y-2">
                    {modelStats.map((stat) => (
                      <div
                        key={stat.model}
                        className="flex items-center justify-between p-3 backdrop-blur-xl bg-white/5 rounded-lg border border-white/10"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{stat.model}</span>
                          <span className="text-xs text-white/60">
                            {stat.tokens.toLocaleString()} tokens
                          </span>
                        </div>
                        <span className="text-lg font-bold text-white/90">
                          {stat.requests.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hourlyData.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-3">Requests by Hour</h3>
                  <div className="space-y-2">
                    {hourlyData.map((item) => {
                      const maxCount = Math.max(...hourlyData.map((d) => d.count));
                      const widthPercent = (item.count / maxCount) * 100;
                      
                      return (
                        <div key={item.hour} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-white/70 w-12">
                            {item.hour}
                          </span>
                          <div className="flex-1 h-8 backdrop-blur-xl bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500/60 to-fuchsia-500/60 flex items-center justify-end pr-3"
                              style={{ width: `${widthPercent}%` }}
                            >
                              {item.count > 0 && (
                                <span className="text-xs font-bold text-white">
                                  {item.count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-white/60">Loading usage statistics...</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live Logs</CardTitle>
          {loggingState === LOGGING_STATE.ENABLED && (
            <Button
              variant="ghost"
              onClick={clearLogs}
              className="px-3 py-1 text-xs"
            >
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loggingState === LOGGING_STATE.CHECKING && (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-3 text-white/60">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Checking logging status...</span>
              </div>
            </div>
          )}

          {loggingState === LOGGING_STATE.DISABLED && (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <div className="w-10 h-10 rounded-xl backdrop-blur-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                <span className="text-xl">&#128196;</span>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-white/90">File logging is disabled</p>
                <p className="text-xs text-white/60 max-w-sm">
                  Enable file logging in CLIProxyAPI to view live logs here.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleEnableLogging}
                disabled={enablingLogging}
                className="mt-2"
              >
                {enablingLogging ? "Enabling..." : "Enable File Logging"}
              </Button>
            </div>
          )}

          {loggingState === LOGGING_STATE.ERROR && (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <div className="w-10 h-10 rounded-xl backdrop-blur-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center">
                <span className="text-xl">&#9888;</span>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-white/90">Logs unavailable</p>
                <p className="text-xs text-white/60 max-w-sm">
                  {loggingError}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={handleRetryLogging}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {loggingState === LOGGING_STATE.ENABLED && (
            <>
              <div
                ref={logsContainerRef}
                onScroll={handleScroll}
                className="h-96 overflow-auto backdrop-blur-xl bg-black/40 border border-white/10 rounded-lg p-3 sm:p-4 font-mono text-[10px] sm:text-xs"
              >
                {logs.length === 0 ? (
                  <div className="text-white/50">Waiting for logs...</div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "mb-1 break-all",
                        log.level === "error" && "text-red-400",
                        log.level === "warn" && "text-yellow-400",
                        log.level === "info" && "text-white/90",
                        log.level === "debug" && "text-blue-400"
                      )}
                    >
                      {log.timestamp && (
                        <span className="text-white/50">{log.timestamp} </span>
                      )}
                      {log.level && (
                        <span className="font-semibold uppercase">
                          [{log.level}]{" "}
                        </span>
                      )}
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
              {!autoScroll && (
                <div className="mt-2 text-xs text-white/50 text-center">
                  Scroll to bottom to enable auto-scroll
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

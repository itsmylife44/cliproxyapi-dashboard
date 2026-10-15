"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ServiceStatus } from "@/components/monitoring/service-status";
import type { UsageSummary } from "@/components/monitoring/usage-stats";
const UsageStats = dynamic(
  () => import("@/components/monitoring/usage-stats").then(mod => ({ default: mod.UsageStats })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" /> }
);
import { LiveLogs } from "@/components/monitoring/live-logs";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useProxyStatusProvider } from "@/components/dashboard-shell";

import { useTranslations } from "next-intl";

interface StatusResponse {
  running: boolean;
  containerName?: string;
  uptime?: number;
  error?: string;
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

function shouldPollDashboard(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

let logIdCounter = 0;

function parseLogLine(line: string, index: number): LogLine {
  const logRegex = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(info|error|warn|debug)\s+(.+)$/i;
  const match = line.match(logRegex);

  if (match) {
    const [, timestamp, level, message] = match;
    if (timestamp && level && message) {
      return {
        id: `${timestamp}-${index}`,
        timestamp,
        level: level.toLowerCase(),
        message,
        raw: line,
      };
    }
  }

  return {
    id: `raw-${++logIdCounter}-${index}`,
    timestamp: "",
    level: "info",
    message: line,
    raw: line,
  };
}

export default function MonitoringPage() {
  const t = useTranslations("monitoring");
  const { provide: provideProxyStatus, clear: clearProxyStatus } = useProxyStatusProvider();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [restarting, setRestarting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingState, setLoggingState] = useState<LoggingState>(LOGGING_STATE.CHECKING);
  const [loggingError, setLoggingError] = useState<string | null>(null);
  const [enablingLogging, setEnablingLogging] = useState(false);
  const logsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!shouldPollDashboard()) return;
      try {
        const res = await fetch(API_ENDPOINTS.PROXY.STATUS);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          provideProxyStatus(data);
        }
      } catch {}
    };

    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 5000);

    return () => {
      clearInterval(statusInterval);
      clearProxyStatus();
    };
  }, [provideProxyStatus, clearProxyStatus]);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!shouldPollDashboard()) return;
      try {
        // Today's usage from our DB; it changes when the collector runs.
        const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
        const res = await fetch(`${API_ENDPOINTS.USAGE.HISTORY}?from=${today}&to=${today}`);
        if (res.ok) {
          const json: { data: UsageSummary } = await res.json();
          setUsage(json.data);
        }
      } catch {}
    };

    fetchUsage();
    const usageInterval = setInterval(fetchUsage, 60_000);

    return () => clearInterval(usageInterval);
  }, []);

  useEffect(() => {
    const checkLoggingStatus = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.MANAGEMENT.LOGGING_TO_FILE);
        if (res.ok) {
          const data = await res.json();
          if (data["logging-to-file"]) {
            setLoggingState(LOGGING_STATE.ENABLED);
          } else {
            setLoggingState(LOGGING_STATE.DISABLED);
          }
        } else {
          setLoggingState(LOGGING_STATE.ERROR);
          setLoggingError(t("errorFailedCheckLogging"));
        }
      } catch {
        setLoggingState(LOGGING_STATE.ERROR);
        setLoggingError(t("errorCouldNotReachApi"));
      }
    };

    checkLoggingStatus();
  }, [t]);

  useEffect(() => {
    if (loggingState !== LOGGING_STATE.ENABLED) {
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
        logsIntervalRef.current = null;
      }
      return;
    }

    const fetchLogs = async () => {
      if (!shouldPollDashboard()) return;
      try {
        const url = lastTimestampRef.current > 0
          ? `${API_ENDPOINTS.MANAGEMENT.LOGS}?after=${lastTimestampRef.current}`
          : API_ENDPOINTS.MANAGEMENT.LOGS;

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
          setLoggingError(t("errorLogsRequestFailed", { status: res.status }));
          if (logsIntervalRef.current) {
            clearInterval(logsIntervalRef.current);
            logsIntervalRef.current = null;
          }
        }
      } catch {
        setLoggingState(LOGGING_STATE.ERROR);
        setLoggingError(t("errorNetworkFetchLogs"));
        if (logsIntervalRef.current) {
          clearInterval(logsIntervalRef.current);
          logsIntervalRef.current = null;
        }
      }
    };

    fetchLogs();
    logsIntervalRef.current = setInterval(fetchLogs, 5000);

    return () => {
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
        logsIntervalRef.current = null;
      }
    };
  }, [loggingState, t]);

  const handleEnableLogging = async () => {
    setEnablingLogging(true);
    try {
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.LOGGING_TO_FILE, {
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
        setLoggingError(t("errorFailedEnableLogging"));
      }
    } catch {
      setLoggingError(t("errorNetworkEnableLogging"));
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
        const res = await fetch(API_ENDPOINTS.MANAGEMENT.LOGGING_TO_FILE);
        if (res.ok) {
          const data = await res.json();
          if (data["logging-to-file"]) {
            setLoggingState(LOGGING_STATE.ENABLED);
          } else {
            setLoggingState(LOGGING_STATE.DISABLED);
          }
        } else {
          setLoggingState(LOGGING_STATE.ERROR);
          setLoggingError(t("errorFailedCheckLogging"));
        }
      } catch {
        setLoggingState(LOGGING_STATE.ERROR);
        setLoggingError(t("errorCouldNotReachApiShort"));
      }
    };

    recheckLogging();
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const res = await fetch(API_ENDPOINTS.RESTART, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      if (res.ok) {
        restartTimeoutRef.current = setTimeout(() => {
          restartTimeoutRef.current = null;
          setRestarting(false);
        }, 5000);
      } else {
        setRestarting(false);
      }
    } catch {
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t("pageTitle")}</h1>
      </section>

      <ServiceStatus
        status={status}
        restarting={restarting}
        onConfirmRestart={() => setShowConfirm(true)}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleRestart}
        title={t("confirmRestartTitle")}
        message={t("confirmRestartMessage")}
        confirmLabel={t("confirmRestartButton")}
        cancelLabel={t("cancelButton")}
        variant="warning"
      />

      <UsageStats usage={usage} />

      <LiveLogs
        logs={logs}
        loggingState={loggingState}
        loggingError={loggingError}
        enablingLogging={enablingLogging}
        onClearLogs={() => setLogs([])}
        onEnableLogging={handleEnableLogging}
        onRetryLogging={handleRetryLogging}
      />
    </div>
  );
}

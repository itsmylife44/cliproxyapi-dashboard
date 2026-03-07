"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogLine {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

type LoggingState = "checking" | "enabled" | "disabled" | "error";

interface LiveLogsProps {
  logs: LogLine[];
  loggingState: LoggingState;
  loggingError: string | null;
  enablingLogging: boolean;
  onClearLogs: () => void;
  onEnableLogging: () => void;
  onRetryLogging: () => void;
}

export function LiveLogs({
  logs,
  loggingState,
  loggingError,
  enablingLogging,
  onClearLogs,
  onEnableLogging,
  onRetryLogging,
}: LiveLogsProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (autoScrollRef.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      autoScrollRef.current = isAtBottom;
    }
  };

  return (
    <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Live Logs</h2>
        {loggingState === "enabled" && (
          <Button
            variant="ghost"
            onClick={onClearLogs}
            className="px-3 py-1 text-xs"
          >
            Clear
          </Button>
        )}
      </div>
        {loggingState === "checking" && (
          <div className="flex items-center justify-center py-6">
            <div className="flex items-center gap-3 text-slate-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Checking logging status...</span>
            </div>
          </div>
        )}

        {loggingState === "disabled" && (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-amber-400/30 bg-amber-500/15">
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
              onClick={onEnableLogging}
              disabled={enablingLogging}
              className="mt-2"
            >
              {enablingLogging ? "Enabling..." : "Enable File Logging"}
            </Button>
          </div>
        )}

        {loggingState === "error" && (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-rose-400/30 bg-rose-500/15">
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
              onClick={onRetryLogging}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {loggingState === "enabled" && (
          <>
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="h-96 overflow-auto rounded-sm border border-slate-700/70 bg-black/40 p-3 font-mono text-[10px] sm:p-4 sm:text-xs"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500">Waiting for logs...</div>
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
            {!autoScrollRef.current && (
              <div className="mt-2 text-center text-xs text-slate-500">
                Scroll to bottom to enable auto-scroll
              </div>
            )}
          </>
        )}
    </section>
  );
}

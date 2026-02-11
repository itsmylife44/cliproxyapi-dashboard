"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ContainerInfo {
  name: string;
  displayName: string;
  status: string;
  state: "running" | "exited" | "paused" | "restarting" | "dead" | "created" | "removing";
  uptime: number | null;
  cpu: string | null;
  memory: string | null;
  memoryPercent: string | null;
  actions: string[];
}

interface LogEntry {
  id: string;
  text: string;
}

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

export default function ContainersPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current && logLines.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logLines.length]);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const res = await fetch("/api/containers/list");
        if (res.ok) {
          const data = await res.json();
          setContainers(Array.isArray(data) ? data : []);
          setFetchError(null);
        } else {
          const data = await res.json().catch(() => ({}));
          const message =
            typeof data.error === "string"
              ? data.error
              : `Failed to load containers (${res.status})`;
          setFetchError(message);
        }
      } catch (error) {
        console.error("Failed to fetch containers:", error);
        setFetchError("Network error while loading containers.");
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (containerName: string, displayName: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} ${displayName}?`)) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, [containerName]: true }));
    try {
      const res = await fetch(`/api/containers/${containerName}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirm: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
      const refreshRes = await fetch("/api/containers/list");
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setContainers(Array.isArray(data) ? data : []);
        setFetchError(null);
      } else {
        const data = await refreshRes.json().catch(() => ({}));
        const message =
          typeof data.error === "string"
            ? data.error
            : `Failed to refresh containers (${refreshRes.status})`;
        setFetchError(message);
      }
    } catch {
      alert("Network error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [containerName]: false }));
    }
  };

  const handleViewLogs = async (containerName: string) => {
    setSelectedContainer(containerName);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/containers/${containerName}/logs?lines=200`);
      if (res.ok) {
        const data = await res.json();
        const lines: string[] = data.lines || [];
        setLogLines(lines.map((line, i) => ({ id: `${containerName}-${i}-${line.slice(0, 20)}`, text: line })));
      } else {
        setLogLines([{ id: "error", text: "Failed to load logs" }]);
      }
    } catch {
      setLogLines([{ id: "error", text: "Failed to load logs" }]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCloseLogs = () => {
    setSelectedContainer(null);
    setLogLines([]);
  };

  const handleRefreshLogs = () => {
    if (selectedContainer) {
      handleViewLogs(selectedContainer);
    }
  };

  const getActionVariant = (action: string): "primary" | "secondary" | "danger" | "ghost" => {
    switch (action.toLowerCase()) {
      case "start":
        return "primary";
      case "stop":
        return "danger";
      case "restart":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getActionLoadingText = (action: string): string => {
    switch (action.toLowerCase()) {
      case "start":
        return "Starting...";
      case "stop":
        return "Stopping...";
      case "restart":
        return "Restarting...";
      default:
        return `${action}ing...`;
    }
  };

  const selectedContainerInfo = containers.find((c) => c.name === selectedContainer);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">Containers</h1>
      </section>

      {loading ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">Loading containers...</div>
      ) : (
        <>
          {fetchError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{fetchError}</div>
          )}

          <div className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
            <div className="grid grid-cols-[minmax(0,1.2fr)_100px_120px_120px_220px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              <span>Container</span>
              <span>State</span>
              <span>Uptime</span>
              <span>Resources</span>
              <span>Actions</span>
            </div>
            {containers.map((container) => {
              const isActionLoading = actionLoading[container.name] || false;

              return (
                <div key={container.name} className="border-b border-slate-700/60 px-3 py-3 last:border-b-0">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_100px_120px_120px_220px] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{container.displayName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{container.status}</p>
                    </div>
                    <span className={cn("text-xs font-medium", container.state === "running" ? "text-emerald-300" : container.state === "exited" || container.state === "dead" ? "text-rose-300" : "text-amber-300")}>
                      {container.state}
                    </span>
                    <span className="text-xs text-slate-300">{container.uptime !== null ? formatUptime(container.uptime) : "-"}</span>
                    <span className="text-xs text-slate-300">
                      {container.cpu ?? "-"}
                      {container.memory !== null && container.memoryPercent !== null ? ` · ${container.memoryPercent}` : ""}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                        {container.actions.map((action) => (
                          <Button
                            key={action}
                            variant={getActionVariant(action)}
                            onClick={() => handleAction(container.name, container.displayName, action)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 text-xs"
                          >
                            {isActionLoading ? getActionLoadingText(action) : action}
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          onClick={() => handleViewLogs(container.name)}
                          className="px-2.5 py-1 text-xs"
                        >
                          Logs
                        </Button>
                      </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedContainer && (
            <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Logs: {selectedContainerInfo?.displayName || selectedContainer}</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleRefreshLogs}
                    className="px-3 py-1 text-xs"
                    disabled={logsLoading}
                  >
                    {logsLoading ? "Loading..." : "Refresh"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleCloseLogs}
                    className="px-3 py-1 text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
                <div className="h-96 overflow-auto rounded-sm border border-slate-700/70 bg-black/40 p-3 font-mono text-[10px] sm:p-4 sm:text-xs">
                  {logsLoading ? (
                    <div className="text-slate-500">Loading logs...</div>
                  ) : logLines.length === 0 ? (
                    <div className="text-slate-500">No logs available</div>
                  ) : (
                    logLines.map((entry) => (
                      <div key={entry.id} className="mb-1 break-all text-slate-200">
                        {entry.text}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

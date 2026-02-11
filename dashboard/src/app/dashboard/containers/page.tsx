"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

  const getStateBadgeClasses = (state: ContainerInfo["state"]) => {
    switch (state) {
      case "running":
        return "bg-emerald-500/30 border-emerald-400/40";
      case "exited":
      case "dead":
        return "bg-red-500/30 border-red-400/40";
      case "paused":
        return "bg-amber-500/30 border-amber-400/40";
      case "restarting":
        return "bg-blue-500/30 border-blue-400/40";
      default:
        return "bg-gray-500/30 border-gray-400/40";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
          Containers
        </h1>
      </div>

      {loading ? (
        <div className="text-sm text-white/60">Loading containers...</div>
      ) : (
        <>
          {fetchError && (
            <Card>
              <CardContent className="pt-4">
                <div className="rounded-xl bg-red-500/20 border border-red-400/30 p-3 text-sm text-red-300">
                  {fetchError}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {containers.map((container) => {
              const isActionLoading = actionLoading[container.name] || false;

              return (
                <Card key={container.name}>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-bold text-white">
                          {container.displayName}
                        </h3>
                        <span
                          className={cn(
                            "backdrop-blur-xl px-3 py-1 text-xs font-medium text-white rounded-lg border",
                            getStateBadgeClasses(container.state)
                          )}
                        >
                          {container.state.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        {container.uptime !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/70">Uptime:</span>
                            <span className="text-white font-medium">
                              {formatUptime(container.uptime)}
                            </span>
                          </div>
                        )}

                        {container.cpu !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/70">CPU:</span>
                            <span className="text-white font-medium">{container.cpu}</span>
                          </div>
                        )}

                        {container.memory !== null && container.memoryPercent !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/70">Memory:</span>
                            <span className="text-white font-medium">
                              {container.memory} ({container.memoryPercent})
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-white/10">
                          <span className="text-xs text-white/60">{container.status}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {container.actions.map((action) => (
                          <Button
                            key={action}
                            variant={getActionVariant(action)}
                            onClick={() => handleAction(container.name, container.displayName, action)}
                            disabled={isActionLoading}
                            className="flex-1 min-w-[80px] py-2 text-xs"
                          >
                            {isActionLoading ? getActionLoadingText(action) : action}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        onClick={() => handleViewLogs(container.name)}
                        className="w-full py-2 text-xs"
                      >
                        View Logs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedContainer && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  Logs: {selectedContainerInfo?.displayName || selectedContainer}
                </CardTitle>
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
              </CardHeader>
              <CardContent>
                <div className="h-96 overflow-auto backdrop-blur-xl bg-black/40 border border-white/10 rounded-lg p-3 sm:p-4 font-mono text-[10px] sm:text-xs">
                  {logsLoading ? (
                    <div className="text-white/50">Loading logs...</div>
                  ) : logLines.length === 0 ? (
                    <div className="text-white/50">No logs available</div>
                  ) : (
                    logLines.map((entry) => (
                      <div key={entry.id} className="mb-1 break-all text-white/90">
                        {entry.text}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

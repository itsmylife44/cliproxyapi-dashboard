"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { cn, extractApiError } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("containers");
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ containerName: string; displayName: string; action: string } | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (logsEndRef.current && logLines.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logLines.length]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchContainers = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.CONTAINERS.LIST, { signal: controller.signal });
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
      } catch {
        if (!controller.signal.aborted) {
          setFetchError("Network error while loading containers.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const confirmAction = (containerName: string, displayName: string, action: string) => {
    setPendingAction({ containerName, displayName, action });
    setShowConfirm(true);
  };

  const handleAction = async () => {
    if (!pendingAction) return;

    const { containerName, action } = pendingAction;

    setActionLoading((prev) => ({ ...prev, [containerName]: true }));
    try {
      const res = await fetch(`/api/containers/${containerName}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirm: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, "Action failed"), "error");
      }
      const refreshRes = await fetch(API_ENDPOINTS.CONTAINERS.LIST);
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
      showToast(t("toastNetworkError"), "error");
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
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Containers</h1>
      </section>

      {loading ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">Loading containers...</div>
      ) : (
        <>
          {fetchError && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">{fetchError}</div>
          )}

          {containers.length === 0 && !fetchError ? (
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-8">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]" aria-hidden="true">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M6 12h.01M10 12h.01M14 12h.01" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">No containers found</h3>
                  <p className="text-xs text-[var(--text-muted)]">No Docker containers are currently running or available</p>
                </div>
              </div>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px] divide-y divide-[var(--surface-border)] overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.2fr)_80px_100px_100px_minmax(140px,auto)] border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <span>Container</span>
                <span>State</span>
                <span>Uptime</span>
                <span>Resources</span>
                <span>Actions</span>
              </div>
            {containers.map((container) => {
              const isActionLoading = actionLoading[container.name] || false;

              return (
                <div key={container.name} className="px-3 py-3">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_80px_100px_100px_minmax(140px,auto)] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{container.displayName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{container.status}</p>
                    </div>
                    <span className={cn("text-xs font-medium", container.state === "running" ? "text-emerald-700" : container.state === "exited" || container.state === "dead" ? "text-rose-600" : "text-amber-700")}>
                      {container.state}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">{container.uptime !== null ? formatUptime(container.uptime) : "-"}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {container.cpu ?? "-"}
                      {container.memory !== null && container.memoryPercent !== null ? ` · ${container.memoryPercent}` : ""}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                        {container.actions.map((action) => (
                          <Button
                            key={action}
                            variant={getActionVariant(action)}
                            onClick={() => confirmAction(container.name, container.displayName, action)}
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
          </div>
          )}

          {selectedContainer && (
            <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Logs: {selectedContainerInfo?.displayName || selectedContainer}</h2>
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
                <div className="h-96 overflow-auto rounded-sm border border-[var(--surface-border)] bg-[#1a1a1a] p-3 font-mono text-[10px] sm:p-4 sm:text-xs">
                  {logsLoading ? (
                    <div className="text-gray-400">Loading logs...</div>
                  ) : logLines.length === 0 ? (
                    <div className="text-gray-400">No logs available</div>
                  ) : (
                    logLines.map((entry) => (
                      <div key={entry.id} className="mb-1 break-all text-gray-200">
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

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingAction(null);
        }}
        onConfirm={handleAction}
        title={`${pendingAction?.action} Container`}
        message={`Are you sure you want to ${pendingAction?.action} ${pendingAction?.displayName}?`}
        confirmLabel={pendingAction?.action || "Confirm"}
        cancelLabel="Cancel"
        variant={pendingAction?.action.toLowerCase() === "stop" ? "danger" : "warning"}
      />
    </div>
  );
}

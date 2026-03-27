"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface DeployStatus {
  status: "idle" | "running" | "success" | "error" | "completed" | "failed";
  step?: string;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  timestamp?: string;
  error?: string;
}

function normalizeStatus(payload: unknown): DeployStatus {
  if (payload && typeof payload === "object" && "status" in payload) {
    const candidate = payload as DeployStatus;
    if (typeof candidate.status === "string") {
      return candidate;
    }
  }
  return { status: "idle", message: "No deployment in progress" };
}

export function DeployDashboard() {
  const [status, setStatus] = useState<DeployStatus>({ status: "idle" });
  const [log, setLog] = useState<string>("");
  const [showLog, setShowLog] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState<boolean | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeploy, setPendingDeploy] = useState<{ noCache: boolean } | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fetchStatusRef = useRef<(shouldStartPolling?: boolean) => Promise<void>>(async () => {});
  const { showToast } = useToast();

  const fetchStatus = useCallback(async (shouldStartPolling = false) => {
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.DEPLOY);
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeStatus(data.status ?? data);
        setStatus(normalized);
        setLog(data.log || "");
        setWebhookConfigured(data.webhookConfigured ?? null);
        
        const s = normalized.status;
        if (s === "running") {
          setDeploying(true);
          setShowLog(true);
          if (shouldStartPolling && !pollingRef.current) {
            pollingRef.current = setInterval(() => {
              void fetchStatusRef.current(false);
            }, 2000);
          }
        } else if (s === "success" || s === "error" || s === "completed" || s === "failed") {
          setDeploying(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatusRef.current = fetchStatus;
  }, [fetchStatus]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchStatus(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (logRef.current && showLog) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [showLog]);

  const startPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(fetchStatus, 2000);
  };

  const handleDeploy = (noCache: boolean) => {
    setPendingDeploy({ noCache });
    setShowConfirm(true);
  };

  const executeDeploy = async () => {
    if (!pendingDeploy) return;

    const { noCache } = pendingDeploy;
    const mode = noCache ? "Full Rebuild" : "Quick Update";

    setDeploying(true);
    setShowLog(true);
    setLog("");
    setStatus({ status: "running", step: "init", message: "Starting deployment..." });

    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.DEPLOY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noCache }),
      });

      if (res.ok) {
        showToast(`${mode} started`, "success");
        startPolling();
      } else {
        const data = await res.json();
        const errorMessage = extractApiError(data, "Failed to start deployment");
        showToast(errorMessage, "error");
        setDeploying(false);
        setStatus({ status: "error", error: errorMessage });
      }
    } catch {
      showToast("Network error", "error");
      setDeploying(false);
      setStatus({ status: "error", error: "Network error" });
    }
  };

  const getStepLabel = (step?: string) => {
    switch (step) {
      case "init": return "Initializing...";
      case "git": return "Pulling latest code...";
      case "build": return "Building Docker image...";
      case "deploy": return "Deploying container...";
      case "health": return "Health check...";
      case "done": return "Complete!";
      default: return step || "Unknown";
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "running": return "text-blue-400";
      case "success":
      case "completed": return "text-green-400";
      case "error":
      case "failed": return "text-red-400";
      default: return "text-white/70";
    }
  };

  if (webhookConfigured === false) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Dashboard Deployment</h2>
          <p className="text-xs text-slate-400">Deploy the latest dashboard changes from the repository</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="text-sm font-medium text-amber-200">Webhook Not Configured</div>
            <p className="mt-1 text-xs text-slate-400">
              The deployment webhook is not set up. To enable dashboard deployments from the UI,
              you need to configure the webhook server on your host machine.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            <div className="font-medium text-slate-100">Setup Instructions:</div>
            <ol className="list-decimal list-inside space-y-2 text-slate-400">
              <li>Install webhook: <code className="rounded-sm bg-slate-800 px-1">apt install webhook</code></li>
              <li>Copy webhook config from <code className="rounded-sm bg-slate-800 px-1">infrastructure/webhook.yaml</code></li>
              <li>Set environment variables: <code className="rounded-sm bg-slate-800 px-1">WEBHOOK_HOST</code>, <code className="rounded-sm bg-slate-800 px-1">DEPLOY_SECRET</code></li>
              <li>Start webhook service: <code className="rounded-sm bg-slate-800 px-1">webhook -hooks /path/to/webhook.yaml -port 9000</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Dashboard Deployment</h2>
          <p className="text-xs text-slate-400">Deploy the latest dashboard changes from the repository</p>
        </div>
        <div className="flex items-center gap-2">
          {status.status === "running" && (
            <span className="rounded-sm border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300 animate-pulse">
              Deploying...
            </span>
          )}
          {(status.status === "success" || status.status === "completed") && (
            <span className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
              Success
            </span>
          )}
          {(status.status === "error" || status.status === "failed") && (
            <span className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
              Failed
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Quick Update uses Docker cache for faster builds. Full Rebuild rebuilds everything from scratch.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => handleDeploy(false)}
          disabled={deploying}
        >
          {deploying ? "Deploying..." : "Quick Update"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleDeploy(true)}
          disabled={deploying}
        >
          Full Rebuild (no-cache)
        </Button>
        <Button
          variant="ghost"
          onClick={fetchStatus}
          disabled={deploying}
        >
          Refresh Status
        </Button>
      </div>

      {status.status !== "idle" && (
        <div className="space-y-3 border-t border-slate-700/70 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getStatusColor(status.status)}`}>
                {status.status === "running" && (
                  <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-blue-400" />
                )}
                {getStepLabel(status.step)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLog(!showLog)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              {showLog ? "Hide Log" : "Show Log"}
            </button>
          </div>

          {status.message && (
            <div className="text-xs text-slate-400">{status.message}</div>
          )}

          {status.error && (
            <div className="rounded-sm border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {status.error}
            </div>
          )}

          {showLog && log && (
            <pre
              ref={logRef}
              className="max-h-64 overflow-auto rounded-sm border border-slate-700/70 bg-slate-900/40 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap"
            >
              {log}
            </pre>
          )}

          {status.completedAt && (
            <div className="text-xs text-slate-500">
              Completed: {new Date(status.completedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingDeploy(null);
        }}
        onConfirm={executeDeploy}
        title={pendingDeploy?.noCache ? "Full Rebuild" : "Quick Update"}
        message={`Start ${pendingDeploy?.noCache ? "Full Rebuild" : "Quick Update"}? The dashboard will restart after deployment.`}
        confirmLabel="Deploy"
        cancelLabel="Cancel"
        variant="warning"
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface DeployStatus {
  status: "idle" | "running" | "success" | "error";
  step?: string;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export function DeployDashboard() {
  const [status, setStatus] = useState<DeployStatus>({ status: "idle" });
  const [log, setLog] = useState<string>("");
  const [showLog, setShowLog] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState<boolean | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  const fetchStatus = useCallback(async (shouldStartPolling = false) => {
    try {
      const res = await fetch("/api/admin/deploy");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || { status: "idle" });
        setLog(data.log || "");
        setWebhookConfigured(data.webhookConfigured ?? null);
        
        if (data.status?.status === "running") {
          setDeploying(true);
          setShowLog(true);
          if (shouldStartPolling && !pollingRef.current) {
            pollingRef.current = setInterval(() => fetchStatus(false), 2000);
          }
        } else if (data.status?.status === "success" || data.status?.status === "error") {
          setDeploying(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch {
      console.error("Failed to fetch deploy status");
    }
  }, []);

  useEffect(() => {
    fetchStatus(true);
    return () => {
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

  const handleDeploy = async (noCache: boolean) => {
    const mode = noCache ? "Full Rebuild" : "Quick Update";
    if (!confirm(`Start ${mode}? The dashboard will restart after deployment.`)) {
      return;
    }

    setDeploying(true);
    setShowLog(true);
    setLog("");
    setStatus({ status: "running", step: "init", message: "Starting deployment..." });

    try {
      const res = await fetch("/api/admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noCache }),
      });

      if (res.ok) {
        showToast(`${mode} started`, "success");
        startPolling();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to start deployment", "error");
        setDeploying(false);
        setStatus({ status: "error", error: data.error });
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
      case "success": return "text-green-400";
      case "error": return "text-red-400";
      default: return "text-white/70";
    }
  };

  if (webhookConfigured === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-l-4 border-yellow-400/60 bg-yellow-500/10 p-4 rounded-r-xl">
              <div className="font-medium text-yellow-400 mb-2">Webhook Not Configured</div>
              <p className="text-sm text-white/70">
                The deployment webhook is not set up. To enable dashboard deployments from the UI,
                you need to configure the webhook server on your host machine.
              </p>
            </div>
            
            <div className="space-y-3 text-sm text-white/80">
              <div className="font-medium text-white">Setup Instructions:</div>
              <ol className="list-decimal list-inside space-y-2 text-white/70">
                <li>Install webhook: <code className="bg-white/10 px-1 rounded">apt install webhook</code></li>
                <li>Copy webhook config from <code className="bg-white/10 px-1 rounded">infrastructure/webhook.yaml</code></li>
                <li>Set environment variables: <code className="bg-white/10 px-1 rounded">WEBHOOK_HOST</code>, <code className="bg-white/10 px-1 rounded">DEPLOY_SECRET</code></li>
                <li>Start webhook service: <code className="bg-white/10 px-1 rounded">webhook -hooks /path/to/webhook.yaml -port 9000</code></li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Dashboard Deployment
          {status.status === "running" && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400 animate-pulse">
              Deploying...
            </span>
          )}
          {status.status === "success" && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
              Success
            </span>
          )}
          {status.status === "error" && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
              Failed
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/70">
          Deploy the latest dashboard changes from the repository. Quick Update uses Docker cache
          for faster builds. Full Rebuild rebuilds everything from scratch.
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
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${getStatusColor(status.status)}`}>
                  {status.status === "running" && (
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2" />
                  )}
                  {getStepLabel(status.step)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                className="text-xs text-white/50 hover:text-white/80"
              >
                {showLog ? "Hide Log" : "Show Log"}
              </button>
            </div>

            {status.message && (
              <div className="text-sm text-white/60">{status.message}</div>
            )}

            {status.error && (
              <div className="border-l-4 border-red-400/60 bg-red-500/10 p-3 rounded-r-xl text-sm text-red-300">
                {status.error}
              </div>
            )}

            {showLog && log && (
              <pre
                ref={logRef}
                className="max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs font-mono text-white/80 whitespace-pre-wrap"
              >
                {log}
              </pre>
            )}

            {status.completedAt && (
              <div className="text-xs text-white/50">
                Completed: {new Date(status.completedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

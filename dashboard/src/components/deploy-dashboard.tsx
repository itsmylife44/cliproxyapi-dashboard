"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useTranslations } from 'next-intl';

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
  const [deploying, setDeploying] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState<boolean | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeploy, setPendingDeploy] = useState<{ noCache: boolean } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fetchStatusRef = useRef<(shouldStartPolling?: boolean) => Promise<void>>(async () => {});
  const { showToast } = useToast();
  const t = useTranslations('deploy');

  const fetchStatus = useCallback(async (shouldStartPolling = false) => {
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.DEPLOY);
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeStatus(data.status ?? data);
        setStatus(normalized);
        setWebhookConfigured(data.webhookConfigured ?? null);
        
        const s = normalized.status;
        if (s === "running") {
          setDeploying(true);
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
    const mode = noCache ? t('confirmFullRebuildTitle') : t('confirmQuickUpdateTitle');

    setDeploying(true);
    setStatus({ status: "running", step: "init", message: t('startingDeployment') });

    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.DEPLOY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noCache }),
      });

      if (res.ok) {
        showToast(t('toastStarted', { mode }), "success");
        startPolling();
      } else {
        const data = await res.json();
        const errorMessage = extractApiError(data, t('toastStartFailed'));
        showToast(errorMessage, "error");
        setDeploying(false);
        setStatus({ status: "error", error: errorMessage });
      }
    } catch {
      showToast(t('toastNetworkError'), "error");
      setDeploying(false);
      setStatus({ status: "error", error: t('toastNetworkError') });
    }
  };

  const getStepLabel = (step?: string) => {
    switch (step) {
      case "init": return t('stepInit');
      case "git": return t('stepGit');
      case "build": return t('stepBuild');
      case "deploy": return t('stepDeploy');
      case "health": return t('stepHealth');
      case "done": return t('stepDone');
      default: return step || t('stepUnknown');
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "running": return "text-blue-600";
      case "success":
      case "completed": return "text-green-600";
      case "error":
      case "failed": return "text-red-500";
      default: return "text-[var(--text-secondary)]";
    }
  };

  if (webhookConfigured === false) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Dashboard Deployment</h2>
          <p className="text-xs text-[var(--text-muted)]">Deploy the latest dashboard changes from the repository</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="text-sm font-medium text-amber-700">Webhook Not Configured</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              The deployment webhook is not set up. To enable dashboard deployments from the UI,
              you need to configure the webhook server on your host machine.
            </p>
          </div>

          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">Setup Instructions:</div>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-muted)]">
              <li>Install webhook: <code className="rounded-sm bg-[var(--surface-muted)] px-1">apt install webhook</code></li>
              <li>Copy webhook config from <code className="rounded-sm bg-[var(--surface-muted)] px-1">infrastructure/webhook.yaml</code></li>
              <li>Set environment variables: <code className="rounded-sm bg-[var(--surface-muted)] px-1">WEBHOOK_HOST</code>, <code className="rounded-sm bg-[var(--surface-muted)] px-1">DEPLOY_SECRET</code></li>
              <li>Start webhook service: <code className="rounded-sm bg-[var(--surface-muted)] px-1">webhook -hooks /path/to/webhook.yaml -port 9000</code></li>
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
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Dashboard Deployment</h2>
          <p className="text-xs text-[var(--text-muted)]">Deploy the latest dashboard changes from the repository</p>
        </div>
        <div className="flex items-center gap-2">
          {status.status === "running" && (
            <span className="rounded-sm border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 animate-pulse">
              Deploying...
            </span>
          )}
          {(status.status === "success" || status.status === "completed") && (
            <span className="rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Success
            </span>
          )}
          {(status.status === "error" || status.status === "failed") && (
            <span className="rounded-sm border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600">
              Failed
            </span>
          )}
        </div>
      </div>

        <p className="text-xs text-[var(--text-muted)]">
        Quick Update uses Docker cache for faster builds. Full Rebuild rebuilds everything from scratch.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => handleDeploy(false)}
          disabled={deploying}
        >
          {deploying ? t('buttonDeploying') : t('buttonQuickUpdate')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleDeploy(true)}
          disabled={deploying}
        >
          {t('buttonFullRebuild')}
        </Button>
        <Button
          variant="ghost"
          onClick={fetchStatus}
          disabled={deploying}
        >
          {t('buttonRefreshStatus')}
        </Button>
      </div>

      {status.status !== "idle" && (
        <div className="space-y-3 border-t border-[var(--surface-border)] pt-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getStatusColor(status.status)}`}>
              {status.status === "running" && (
                <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-blue-400" />
              )}
              {getStepLabel(status.step)}
            </span>
          </div>

          {status.message && (
            <div className="text-xs text-[var(--text-muted)]">{status.message}</div>
          )}

          {status.error && (
            <div role="alert" className="rounded-sm border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600">
              {status.error}
            </div>
          )}

          {status.completedAt && (
            <div className="text-xs text-[var(--text-muted)]">
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
        title={pendingDeploy?.noCache ? t('confirmFullRebuildTitle') : t('confirmQuickUpdateTitle')}
        message={t('confirmMessage', { mode: pendingDeploy?.noCache ? t('confirmFullRebuildTitle') : t('confirmQuickUpdateTitle') })}
        confirmLabel={t('confirmLabel')}
        cancelLabel={t('cancelLabel')}
        variant="warning"
      />
    </div>
  );
}

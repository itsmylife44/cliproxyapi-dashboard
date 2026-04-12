"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useTranslations } from "next-intl";

interface SubscriptionStatus {
  templateName: string;
  publisherUsername: string;
  publisherId: string;
  isActive: boolean;
  subscribedAt: string;
  lastSyncedAt: string | null;
}

interface ConfigSubscriberProps {
  hasApiKey: boolean;
}

export function ConfigSubscriber({ hasApiKey }: ConfigSubscriberProps) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareCode, setShareCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();
  const t = useTranslations('configSharing');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.SUBSCRIBE);
      if (res.status === 404 || res.status === 204) {
        setStatus(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setStatus(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data === null) {
        setStatus(null);
      } else {
        setStatus(data);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSubscribe = async () => {
    if (!hasApiKey) {
      showToast(t('toastNoApiKey'), "error");
      return;
    }

    if (!shareCode.trim()) {
      showToast(t('toastEnterShareCode'), "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.SUBSCRIBE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: shareCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastSubscribeFailed'), "error");
        return;
      }
      setStatus(data);
      setShareCode("");
      showToast(t('toastSubscribed'), "success");
    } catch {
      showToast(t('toastNetworkError'), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!status) return;
    setActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.SUBSCRIBE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !status.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastToggleSubscribeFailed'), "error");
        return;
      }
      setStatus(data);
      showToast(
        data.isActive ? t('toastSubscriptionActivated') : t('toastSubscriptionPaused'),
        "success"
      );
    } catch {
      showToast(t('toastNetworkError'), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmUnsubscribe = () => {
    setShowConfirm(true);
  };

  const handleUnsubscribe = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.SUBSCRIBE, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastUnsubscribeFailed'), "error");
        return;
      }
      setStatus(null);
      showToast(t('toastUnsubscribed'), "success");
    } catch {
      showToast(t('toastNetworkError'), "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-3">
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] flex items-center justify-center text-sm" aria-hidden="true">
                &#9733;
              </span>
              {t('subscriberTitle')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--surface-border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="p-3">
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] flex items-center justify-center text-sm" aria-hidden="true">
                &#9733;
              </span>
              {t('subscriberTitle')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Subscribe to someone else&apos;s CLIProxyAPI configuration. Your model selection will be
              automatically controlled by the publisher until you unsubscribe.
            </p>

            {!hasApiKey && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-lg">⚠️</span>
                <p className="text-sm text-amber-700/90">
                  {t('noApiKeyWarning')}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="share-code-input" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Share Code
                </label>
                <Input
                  name="share-code-input"
                  value={shareCode}
                  onChange={setShareCode}
                  placeholder={t('shareCodeInputPlaceholder')}
                  disabled={actionLoading || !hasApiKey}
                />
              </div>
              <Button
                onClick={handleSubscribe}
                disabled={actionLoading || !hasApiKey || !shareCode.trim()}
                variant="primary"
                className="w-full"
              >
                {actionLoading ? t('subscribingButton') : t('subscribeButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] flex items-center justify-center text-sm" aria-hidden="true">
              &#9733;
            </span>
            {t('activeSubscriptionTitle')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('publisherLabel')}</div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">{status.publisherUsername}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('templateLabel')}</div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">{status.templateName}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('statusLabel')}</div>
              <div className={status.isActive ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>{status.isActive ? "Active" : "Paused"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('lastSyncedLabel')}</div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">{status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "Never"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)]">
            <span className="text-lg">🔒</span>
            <p className="text-sm text-[var(--text-secondary)]">
              While subscribed, model selection is controlled by <strong>{status.publisherUsername}</strong>. 
              Your previous preferences will be restored when you unsubscribe.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={handleToggleActive}
              disabled={actionLoading}
              variant="secondary"
              className="flex-1"
            >
              {actionLoading ? t('updatingButton') : status.isActive ? t('pauseSubscriptionButton') : t('activateSubscriptionButton')}
            </Button>
            <Button
              onClick={confirmUnsubscribe}
              disabled={actionLoading}
              variant="danger"
              className="flex-1"
            >
              {actionLoading ? t('unsubscribingButton') : t('unsubscribeButton')}
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleUnsubscribe}
        title={t('confirmUnsubscribeTitle')}
        message={t('confirmUnsubscribeMessage')}
        confirmLabel={t('confirmUnsubscribeLabel')}
        cancelLabel={t('cancelButton')}
        variant="warning"
      />
    </Card>
  );
}

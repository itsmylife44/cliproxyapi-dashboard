"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { CopyBlock } from "@/components/copy-block";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useTranslations } from "next-intl";

interface PublishStatus {
  id: string;
  shareCode: string;
  name: string;
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export function ConfigPublisher() {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();
  const t = useTranslations('configSharing');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.PUBLISH);
      if (res.status === 404) {
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
      setStatus(data);
      setTemplateName(data.name || "");
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handlePublish = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.PUBLISH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName || "My Config" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastPublishFailed'), "error");
        return;
      }
      setStatus(data);
      setTemplateName(data.name);
      showToast(t('toastPublished'), "success");
    } catch {
      showToast(t('toastNetworkError'), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!status || !templateName.trim()) {
      showToast(t('toastNameEmpty'), "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.PUBLISH, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastNameUpdateFailed'), "error");
        return;
      }
      setStatus(data);
      setIsEditing(false);
      showToast(t('toastNameUpdated'), "success");
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
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.PUBLISH, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !status.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastToggleFailed'), "error");
        return;
      }
      setStatus(data);
      showToast(
        data.isActive ? t('toastActivated') : t('toastDeactivated'),
        "success"
      );
    } catch {
      showToast(t('toastNetworkError'), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmUnpublish = () => {
    setShowConfirm(true);
  };

  const handleUnpublish = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SHARING.PUBLISH, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? t('toastUnpublishFailed'), "error");
        return;
      }
      setStatus(null);
      setTemplateName("");
      showToast(t('toastUnpublished'), "success");
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
              {t('publisherTitle')}
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
              {t('publisherTitle')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Share your CLIProxyAPI configuration with others. Generate a unique share code that
              others can use to automatically sync with your config settings.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="template-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Template Name (Optional)
                </label>
                <Input
                  name="template-name"
                  value={templateName}
                  onChange={setTemplateName}
                  placeholder={t('templateNamePlaceholder')}
                  disabled={actionLoading}
                />
              </div>
              <Button
                onClick={handlePublish}
                disabled={actionLoading}
                variant="primary"
                className="w-full"
              >
                {actionLoading ? t('publishingButton') : t('publishButton')}
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
            {t('publishedTitle')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('statusLabel')}</div>
              <div className={status.isActive ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>{status.isActive ? "Active" : "Inactive"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('subscribersLabel')}</div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">{status.subscriberCount}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('createdLabel')}</div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">{new Date(status.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div>
            <div className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Share Code
            </div>
            <CopyBlock code={status.shareCode} />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Others can use this code to subscribe to your config updates
            </p>
          </div>

          <div>
            <label htmlFor="edit-template-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Template Name
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  name="edit-template-name"
                  value={templateName}
                  onChange={setTemplateName}
                  disabled={actionLoading}
                />
                <Button
                  onClick={handleUpdateName}
                  disabled={actionLoading}
                  variant="primary"
                >
                  {t('saveButton')}
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setTemplateName(status.name);
                  }}
                  disabled={actionLoading}
                  variant="ghost"
                >
                  {t('cancelButton')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--text-primary)]">
                  {status.name}
                </div>
                <Button
                  onClick={() => setIsEditing(true)}
                  disabled={actionLoading}
                  variant="secondary"
                >
                  {t('editButton')}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={handleToggleActive}
              disabled={actionLoading}
              variant="secondary"
              className="flex-1"
            >
              {actionLoading ? t('updatingButton') : status.isActive ? t('deactivateButton') : t('activateButton')}
            </Button>
            <Button
              onClick={confirmUnpublish}
              disabled={actionLoading}
              variant="danger"
              className="flex-1"
            >
              {actionLoading ? t('unpublishingButton') : t('unpublishButton')}
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleUnpublish}
        title={t('confirmUnpublishTitle')}
        message={t('confirmUnpublishMessage')}
        confirmLabel={t('confirmUnpublishLabel')}
        cancelLabel={t('cancelButton')}
        variant="danger"
      />
    </Card>
  );
}

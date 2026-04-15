"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { DeployDashboard } from "@/components/deploy-dashboard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { TelegramSettings } from "@/components/settings/telegram-settings";
import { ProviderSettings } from "@/components/settings/provider-settings";
import { PasswordSettings } from "@/components/settings/password-settings";
import { BackupSettings } from "@/components/settings/backup-settings";
import { useTranslations } from 'next-intl';

type SettingsTab = "general" | "backup";

interface ProxyUpdateInfo {
  currentVersion: string;
  currentDigest: string;
  latestVersion: string;
  latestDigest: string;
  updateAvailable: boolean;
  availableVersions: string[];
}

interface DashboardUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

interface SyncToken {
  id: string;
  name: string;
  syncApiKeyId: string | null;
  syncApiKeyName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AvailableApiKey {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [cliProxyVersion, setCliProxyVersion] = useState<string | null>(null);
  const [cliProxyLoading, setCliProxyLoading] = useState(true);

  const [proxyUpdateInfo, setProxyUpdateInfo] = useState<ProxyUpdateInfo | null>(null);
  const [proxyUpdateLoading, setProxyUpdateLoading] = useState(true);
  const [proxyUpdating, setProxyUpdating] = useState(false);

  const [dashboardUpdateInfo, setDashboardUpdateInfo] = useState<DashboardUpdateInfo | null>(null);
  const [dashboardUpdateLoading, setDashboardUpdateLoading] = useState(true);
  const [dashboardUpdating, setDashboardUpdating] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  const [syncTokens, setSyncTokens] = useState<SyncToken[]>([]);
  const [syncTokensLoading, setSyncTokensLoading] = useState(true);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [availableApiKeys, setAvailableApiKeys] = useState<AvailableApiKey[]>([]);

  const [showConfirmProxyUpdate, setShowConfirmProxyUpdate] = useState(false);
  const [pendingProxyVersion, setPendingProxyVersion] = useState<string>("latest");
  const [showConfirmDashboardUpdate, setShowConfirmDashboardUpdate] = useState(false);
  const [showConfirmDeleteToken, setShowConfirmDeleteToken] = useState(false);
  const [pendingDeleteTokenId, setPendingDeleteTokenId] = useState<string | null>(null);
  const [showConfirmRevokeSessions, setShowConfirmRevokeSessions] = useState(false);

  const { showToast } = useToast();
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tb = useTranslations('backup');

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const fetchProxyUpdateInfo = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    setProxyUpdateLoading(true);
    try {
      const url = forceRefresh 
        ? `${API_ENDPOINTS.UPDATE.CHECK}?refresh=true`
        : API_ENDPOINTS.UPDATE.CHECK;
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        setProxyUpdateInfo(data);
      }
    } catch {
      if (signal?.aborted) return;
    } finally {
      if (!signal?.aborted) setProxyUpdateLoading(false);
    }
  }, []);

  const fetchDashboardUpdateInfo = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    setDashboardUpdateLoading(true);
    try {
      const url = forceRefresh 
        ? `${API_ENDPOINTS.UPDATE.DASHBOARD_CHECK}?refresh=true`
        : API_ENDPOINTS.UPDATE.DASHBOARD_CHECK;
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        setDashboardUpdateInfo(data);
      }
    } catch {
      if (signal?.aborted) return;
    } finally {
      if (!signal?.aborted) setDashboardUpdateLoading(false);
    }
  }, []);

  const fetchSyncTokens = useCallback(async (signal?: AbortSignal) => {
    setSyncTokensLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SYNC.TOKENS, { signal });
      if (res.ok) {
        const data = await res.json();
        setSyncTokens(data.tokens || []);
        if (Array.isArray(data.apiKeys)) {
          setAvailableApiKeys(data.apiKeys);
        }
      }
    } catch {
      if (signal?.aborted) return;
    } finally {
      if (!signal?.aborted) setSyncTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchVersion = async () => {
      setCliProxyLoading(true);
      try {
        const res = await fetch(API_ENDPOINTS.MANAGEMENT.LATEST_VERSION, { signal: controller.signal });
        if (!res.ok) {
          setCliProxyVersion(null);
          setCliProxyLoading(false);
          return;
        }

        const data = await res.json();
        const version = typeof data?.["latest-version"] === "string" ? data["latest-version"] : null;
        setCliProxyVersion(version);
        setCliProxyLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setCliProxyVersion(null);
        setCliProxyLoading(false);
      }
    };

    fetchVersion();
    fetchProxyUpdateInfo(controller.signal);
    fetchDashboardUpdateInfo(controller.signal);
    fetchSyncTokens(controller.signal);

    return () => controller.abort();
  }, [fetchProxyUpdateInfo, fetchDashboardUpdateInfo, fetchSyncTokens]);

  const confirmProxyUpdate = (version: string = "latest") => {
    setPendingProxyVersion(version);
    setShowConfirmProxyUpdate(true);
  };

  const handleRefreshDashboardUpdate = useCallback(() => {
    fetchDashboardUpdateInfo(undefined, true);
  }, [fetchDashboardUpdateInfo]);

  const handleRefreshProxyUpdate = useCallback(() => {
    fetchProxyUpdateInfo(undefined, true);
  }, [fetchProxyUpdateInfo]);

  const handleProxyUpdate = async () => {
    const version = pendingProxyVersion;
    setProxyUpdating(true);
    try {
      const res = await fetch(API_ENDPOINTS.UPDATE.BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, confirm: true }),
      });

      if (res.ok) {
        showToast(t('toastProxyUpdated', { version }), 'success');
        setTimeout(() => {
          fetchProxyUpdateInfo();
        }, 10000);
      } else {
        const data = await res.json();
        showToast(extractApiError(data, t('errorUpdateFailed')), "error");
      }
    } catch {
      showToast(t('toastNetworkErrorUpdate'), 'error');
    } finally {
      setProxyUpdating(false);
    }
  };

  const confirmDashboardUpdate = () => {
    setShowConfirmDashboardUpdate(true);
  };

  const handleDashboardUpdate = async () => {
    setDashboardUpdating(true);
    try {
      const res = await fetch(API_ENDPOINTS.UPDATE.DASHBOARD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        const msg = typeof data?.message === "string" ? data.message : t('toastDashboardUpdated');
        showToast(msg, "success");
        setTimeout(() => {
          fetchDashboardUpdateInfo();
        }, 10000);
      } else {
        const errMsg = extractApiError(data, t('errorUpdateFailed'));
        showToast(errMsg, "error");
      }
    } catch {
      showToast(t('toastNetworkErrorUpdate'), 'error');
    } finally {
      setDashboardUpdating(false);
    }
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONFIG_SYNC.TOKENS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, t('errorGenerateTokenFailed')), "error");
        setGeneratingToken(false);
        return;
      }

      const data = await res.json();
      setGeneratedToken(data.token);
      showToast(t('toastTokenGenerateSuccess'), 'success');
      fetchSyncTokens();
      setGeneratingToken(false);
    } catch {
      showToast(tc('networkError'), 'error');
      setGeneratingToken(false);
    }
  };

  const confirmDeleteToken = (id: string) => {
    setPendingDeleteTokenId(id);
    setShowConfirmDeleteToken(true);
  };

  const handleDeleteToken = async () => {
    if (!pendingDeleteTokenId) return;
    const id = pendingDeleteTokenId;

    try {
      const res = await fetch(`${API_ENDPOINTS.CONFIG_SYNC.TOKENS}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, t('errorDeleteTokenFailed')), "error");
        return;
      }

      showToast(t('toastTokenDeleted'), 'success');
      fetchSyncTokens();
    } catch {
      showToast(tc('networkError'), 'error');
    }
  };

  const handleUpdateTokenApiKey = async (tokenId: string, apiKeyId: string) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.CONFIG_SYNC.TOKENS}/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncApiKey: apiKeyId || null }),
      });

      if (res.ok) {
        showToast(t('toastApiKeyUpdated'), 'success');
        const selectedKey = availableApiKeys.find((k) => k.id === apiKeyId);
        setSyncTokens((prev) =>
          prev.map((t) => (t.id === tokenId ? { ...t, syncApiKeyId: apiKeyId || null, syncApiKeyName: selectedKey?.name || null } : t))
        );
      } else {
        const data = await res.json();
        showToast(extractApiError(data, t('errorUpdateApiKeyFailed')), "error");
      }
    } catch {
      showToast(tc('networkError'), 'error');
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast(t('toastTokenCopied'), 'success');
    } catch {
      showToast(t('toastTokenCopyFailed'), 'error');
    }
  };

  const confirmRevokeSessions = () => {
    setShowConfirmRevokeSessions(true);
  };

  const handleRevokeAllSessions = async () => {
    setRevokingSessions(true);
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.REVOKE_SESSIONS, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, t('errorRevokeSessionsFailed')), "error");
        setRevokingSessions(false);
        return;
      }

      const data = await res.json();
      showToast(data.message || t('toastSessionsRevoked'), 'success');
      setRevokingSessions(false);
    } catch {
      showToast(tc('networkError'), 'error');
      setRevokingSessions(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-4">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('pageDescription')}</p>
      </section>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "general"
              ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {tb('tabGeneral')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("backup")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "backup"
              ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {tb('tabBackup')}
        </button>
      </div>

      {activeTab === "general" && (
        <>
          <div className="flex flex-col lg:flex-row gap-6">
            <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6 flex flex-col gap-6 lg:flex-1 lg:min-w-0">
              <TelegramSettings
            syncTokens={syncTokens}
            syncTokensLoading={syncTokensLoading}
            generatingToken={generatingToken}
            generatedToken={generatedToken}
            showInstructions={showInstructions}
            availableApiKeys={availableApiKeys}
            onGenerateToken={handleGenerateToken}
            onClearGeneratedToken={() => setGeneratedToken(null)}
            onCopyToken={handleCopyToken}
            onToggleInstructions={() => setShowInstructions(!showInstructions)}
            onConfirmDeleteToken={confirmDeleteToken}
            onUpdateTokenApiKey={handleUpdateTokenApiKey}
          />
        </section>

        <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6 flex flex-col gap-6 lg:flex-1 lg:min-w-0 lg:self-start lg:sticky lg:top-4">
          <PasswordSettings
            cliProxyVersion={cliProxyVersion}
            cliProxyLoading={cliProxyLoading}
            dashboardUpdateInfo={dashboardUpdateInfo}
            revokingSessions={revokingSessions}
            onConfirmRevokeSessions={confirmRevokeSessions}
          />
        </section>
      </div>

      <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6 flex flex-col gap-6">
        <ProviderSettings
          proxyUpdateInfo={proxyUpdateInfo}
          proxyUpdateLoading={proxyUpdateLoading}
          proxyUpdating={proxyUpdating}
          dashboardUpdateInfo={dashboardUpdateInfo}
          dashboardUpdateLoading={dashboardUpdateLoading}
          dashboardUpdating={dashboardUpdating}
          onConfirmProxyUpdate={confirmProxyUpdate}
          onConfirmDashboardUpdate={confirmDashboardUpdate}
          onRefreshProxyUpdate={handleRefreshProxyUpdate}
          onRefreshDashboardUpdate={handleRefreshDashboardUpdate}
        />

        <div className="border-t border-[var(--surface-border)]/70 pt-6">
          <DeployDashboard />
        </div>
      </section>

      <ConfirmDialog
        isOpen={showConfirmProxyUpdate}
        onClose={() => {
          setShowConfirmProxyUpdate(false);
          setPendingProxyVersion("latest");
        }}
        onConfirm={handleProxyUpdate}
        title={t('confirmProxyUpdate.title')}
        message={t('confirmProxyUpdate.message', { version: pendingProxyVersion })}
        confirmLabel={t('confirmProxyUpdate.confirmLabel')}
        cancelLabel={tc('cancel')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={showConfirmDashboardUpdate}
        onClose={() => setShowConfirmDashboardUpdate(false)}
        onConfirm={handleDashboardUpdate}
        title={t('confirmDashboardUpdate.title')}
        message={t('confirmDashboardUpdate.message')}
        confirmLabel={t('confirmDashboardUpdate.confirmLabel')}
        cancelLabel={tc('cancel')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={showConfirmDeleteToken}
        onClose={() => {
          setShowConfirmDeleteToken(false);
          setPendingDeleteTokenId(null);
        }}
        onConfirm={handleDeleteToken}
        title={t('confirmDeleteToken.title')}
        message={t('confirmDeleteToken.message')}
        confirmLabel={t('confirmDeleteToken.confirmLabel')}
        cancelLabel={tc('cancel')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showConfirmRevokeSessions}
        onClose={() => setShowConfirmRevokeSessions(false)}
        onConfirm={handleRevokeAllSessions}
        title={t('confirmRevokeSessions.title')}
        message={t('confirmRevokeSessions.message')}
        confirmLabel={t('confirmRevokeSessions.confirmLabel')}
        cancelLabel={tc('cancel')}
        variant="danger"
      />
        </>
      )}

      {activeTab === "backup" && (
        <BackupSettings
          currentVersion={dashboardUpdateInfo?.currentVersion ?? "unknown"}
          showToast={showToast}
        />
      )}
    </div>
  );
}

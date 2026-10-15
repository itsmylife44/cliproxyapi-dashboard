"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { mergeConfigYaml, readAuthDir } from "@/lib/config-yaml";
import { planConfigSave } from "@/lib/config-save-plan";
import AgentConfigEditor from "@/components/config/agent-config-editor";
import ConfigPreview from "@/components/config/config-preview";
import { useTranslations } from 'next-intl';

export interface StreamingConfig {
  "keepalive-seconds": number;
  "bootstrap-retries": number;
}

export interface QuotaExceededConfig {
  "switch-project": boolean;
  "switch-preview-model": boolean;
}

export interface RoutingConfig {
  strategy: string;
}

export interface TlsConfig {
  enable: boolean;
  cert: string;
  key: string;
}

export interface PprofConfig {
  enable: boolean;
  addr: string;
}

export interface ClaudeHeaderDefaults {
  "user-agent": string;
  "package-version": string;
  "runtime-version": string;
  timeout: string;
}

export interface PayloadConfig {
  default: unknown;
  "default-raw": unknown;
  override: unknown;
  "override-raw": unknown;
  filter: unknown;
}

export interface OAuthModelAliasEntry {
  name: string;
  alias: string;
  fork?: boolean;
  /** Stable client-side key for React list rendering; stripped before saving. */
  _id?: string;
}

export interface Config {
  "proxy-url": string;
  "auth-dir": string;
  "force-model-prefix": boolean;
  streaming: StreamingConfig;
  "nonstream-keepalive-interval"?: number;
  debug: boolean;
  "commercial-mode": boolean;
  "logging-to-file": boolean;
  "logs-max-total-size-mb": number;
  "error-logs-max-files": number;
  "usage-statistics-enabled": boolean;
  "request-retry": number;
  "max-retry-interval": number;
  "quota-exceeded": QuotaExceededConfig;
  routing: RoutingConfig;
  "ws-auth": boolean;
  "disable-cooling": boolean;
  "request-log": boolean;
  "max-retry-credentials": number;
  "passthrough-headers": boolean;
  tls: TlsConfig;
  pprof: PprofConfig;
  "claude-header-defaults": ClaudeHeaderDefaults;
  payload: PayloadConfig;
  "oauth-model-alias": Record<string, OAuthModelAliasEntry[]>;
}

let idCounter = 0;
function nextStableId(): string {
  return `oauth-alias-${Date.now()}-${++idCounter}`;
}

/** Assign stable `_id` to every OAuth alias entry that lacks one. */
function stampOAuthIds(cfg: Config): Config {
  const aliases = cfg["oauth-model-alias"];
  if (!aliases || Object.keys(aliases).length === 0) return cfg;

  const stamped: Record<string, OAuthModelAliasEntry[]> = {};
  let changed = false;
  for (const [provider, entries] of Object.entries(aliases)) {
    stamped[provider] = entries.map((e) => {
      if (e._id) return e;
      changed = true;
      return { ...e, _id: nextStableId() };
    });
  }
  return changed ? { ...cfg, "oauth-model-alias": stamped } : cfg;
}

/** Strip client-only `_id` fields before sending config to the API. */
function stripOAuthIds(cfg: Config): Config {
  const aliases = cfg["oauth-model-alias"];
  if (!aliases || Object.keys(aliases).length === 0) return cfg;

  const cleaned: Record<string, OAuthModelAliasEntry[]> = {};
  for (const [provider, entries] of Object.entries(aliases)) {
    cleaned[provider] = entries.map((entry) => {
      const { _id, ...rest } = entry;
      void _id;
      return rest;
    });
  }
  return { ...cfg, "oauth-model-alias": cleaned };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [showProxyWarning, setShowProxyWarning] = useState(false);
  const [resettingProxy, setResettingProxy] = useState(false);
  const { showToast } = useToast();
  const t = useTranslations('config');

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return t('unknownError');
  };

  const hasUnsavedChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

  const fetchConfig = useCallback(async (retries = 3, delayMs = 1500) => {
    setLoading(true);
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG);
        if (!res.ok) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs * attempt));
            continue;
          }
          showToast(t('toastLoadFailed'), "error");
          setLoading(false);
          return;
        }

        const data = await res.json();
        // GET /config never returns auth-dir; read the real value from the raw YAML.
        data["auth-dir"] = "";
        try {
          const yamlRes = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML);
          if (yamlRes.ok) data["auth-dir"] = readAuthDir(await yamlRes.text());
        } catch {
          // leave empty: unchanged auth-dir is never written back
        }
        const stamped = stampOAuthIds(data as Config);
        setConfig(stamped);
        setOriginalConfig(stamped);
        setRawJson(JSON.stringify(data, null, 2));
        setLoading(false);
        return;
      } catch {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * attempt));
          continue;
        }
        showToast(t('toastNetworkError'), "error");
        setLoading(false);
      }
    }
  }, [showToast, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchConfig();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchConfig]);

  const VALID_PROXY_SCHEMES = ["socks5://", "socks5h://", "http://", "https://"];
  const VALID_PROXY_KEYWORDS = ["direct", "none"];

  const validateProxyUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (VALID_PROXY_KEYWORDS.includes(trimmed)) return null;
    if (!VALID_PROXY_SCHEMES.some((s) => trimmed.startsWith(s))) {
      return t('proxyValidationScheme');
    }
    try {
      new URL(trimmed);
    } catch {
      return t('proxyValidationFormat');
    }
    return null;
  };

  const handleSave = async () => {
    if (!config) return;

    const proxyUrl = config["proxy-url"];
    const proxyError = validateProxyUrl(proxyUrl);
    if (proxyError) {
      showToast(proxyError, "error");
      return;
    }

    if (proxyUrl.trim() && proxyUrl !== originalConfig?.["proxy-url"]) {
      setShowProxyWarning(true);
      return;
    }

    await executeSave();
  };

  const executeSave = async () => {
    if (!config || !originalConfig) return;

    setSaving(true);

    try {
      const errors: string[] = [];
      let successCount = 0;

      // At most one management write per save (see planConfigSave).
      for (const write of planConfigSave(stripOAuthIds(originalConfig), stripOAuthIds(config))) {
        try {
          if (write.kind === "endpoint") {
            const res = await fetch(write.endpoint, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(write.body),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              errors.push(`${write.endpoint}: ${errData.error || res.statusText}`);
            } else {
              successCount++;
            }
            continue;
          }

          const rawYamlRes = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML);
          if (!rawYamlRes.ok) {
            errors.push(t('failedToFetchYaml'));
            continue;
          }
          const mergedYaml = mergeConfigYaml(await rawYamlRes.text(), write.changes);
          const yamlRes = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML, {
            method: "PUT",
            headers: { "Content-Type": "text/yaml" },
            body: mergedYaml,
          });
          if (!yamlRes.ok) {
            errors.push(t('failedToSaveYaml'));
          } else {
            successCount += Object.keys(write.changes).length;
          }
        } catch (error) {
          errors.push(getErrorMessage(error));
        }
      }

      if (errors.length > 0) {
        showToast(t('toastSomeFieldsFailed', { errors: errors.join(", ") }), "error");
      } else if (successCount === 0) {
        showToast(t('toastNoChanges'), "info");
      } else {
        showToast(t('toastSaved', { count: successCount }), "success");
      }

      // Only mark config as "clean" when every change was persisted
      // successfully. Otherwise the form stays dirty so the user can retry.
      if (errors.length === 0) {
        setOriginalConfig(config);
        setRawJson(JSON.stringify(stripOAuthIds(config), null, 2));
      }
      setSaving(false);

      // Re-fetch after a short delay to confirm changes
      setTimeout(() => { void fetchConfig(3, 1000); }, 1500);
    } catch (error) {
      showToast(t('toastSaveFailedWithError', { error: getErrorMessage(error) }), "error");
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      setRawJson(JSON.stringify(stripOAuthIds(originalConfig), null, 2));
      showToast(t('toastChangesDiscarded'), "info");
    }
  };

  const updateConfig = <K extends keyof Config>(key: K, value: Config[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const updateStreamingConfig = (key: keyof StreamingConfig, value: number) => {
    if (!config) return;
    setConfig({
      ...config,
      streaming: {
        ...config.streaming,
        [key]: value,
      },
    });
  };

  const updateQuotaConfig = (key: keyof QuotaExceededConfig, value: boolean) => {
    if (!config) return;
    setConfig({
      ...config,
      "quota-exceeded": {
        ...config["quota-exceeded"],
        [key]: value,
      },
    });
  };

  const updateRoutingConfig = (key: keyof RoutingConfig, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      routing: {
        ...config.routing,
        [key]: value,
      },
    });
  };

  const updateTlsConfig = (key: keyof TlsConfig, value: string | boolean) => {
    if (!config) return;
    setConfig({ ...config, tls: { ...config.tls, [key]: value } });
  };

  const updatePprofConfig = (key: keyof PprofConfig, value: string | boolean) => {
    if (!config) return;
    setConfig({ ...config, pprof: { ...config.pprof, [key]: value } });
  };

  const updateClaudeHeaderDefaults = (key: keyof ClaudeHeaderDefaults, value: string) => {
    if (!config) return;
    setConfig({ ...config, "claude-header-defaults": { ...config["claude-header-defaults"], [key]: value } });
  };

  const updatePayloadConfig = (key: keyof PayloadConfig, value: unknown) => {
    if (!config) return;
    setConfig({ ...config, payload: { ...config.payload, [key]: value } });
  };

  const toggleProviderExpanded = (provider: string) => {
    setExpandedProviders((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const updateOAuthAliasEntry = (
    provider: string,
    index: number,
    field: keyof OAuthModelAliasEntry,
    value: string | boolean
  ) => {
    if (!config) return;
    const aliases = config["oauth-model-alias"] ?? {};
    const entries = [...(aliases[provider] ?? [])];
    const entry = entries[index];
    if (!entry) return;
    switch (field) {
      case "fork": {
        if (typeof value !== "boolean") return;
        entries[index] = { ...entry, fork: value };
        break;
      }
      case "name": {
        if (typeof value !== "string") return;
        entries[index] = { ...entry, name: value };
        break;
      }
      case "alias": {
        if (typeof value !== "string") return;
        entries[index] = { ...entry, alias: value };
        break;
      }
      case "_id": {
        if (typeof value !== "string") return;
        entries[index] = { ...entry, _id: value };
        break;
      }
      default: {
        // Exhaustiveness: adding a new field to OAuthModelAliasEntry must add a case here.
        const _exhaustive: never = field;
        void _exhaustive;
        return;
      }
    }
    setConfig({
      ...config,
      "oauth-model-alias": { ...aliases, [provider]: entries },
    });
  };

  const addOAuthAliasEntry = (provider: string) => {
    if (!config) return;
    const aliases = config["oauth-model-alias"] ?? {};
    const entries = [...(aliases[provider] ?? []), { name: "", alias: "", _id: nextStableId() }];
    setConfig({
      ...config,
      "oauth-model-alias": { ...aliases, [provider]: entries },
    });
  };

  const removeOAuthAliasEntry = (provider: string, index: number) => {
    if (!config) return;
    const aliases = config["oauth-model-alias"] ?? {};
    const entries = (aliases[provider] ?? []).filter((_, i) => i !== index);
    setConfig({
      ...config,
      "oauth-model-alias": { ...aliases, [provider]: entries },
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-4">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
        </section>
        <div className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6">
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="size-8 animate-spin rounded-full border-4 border-[#ddd] border-t-blue-500"></div>
              <p className="text-[var(--text-muted)]">{t('loadingConfigText')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    const handleEmergencyProxyReset = async () => {
      setResettingProxy(true);
      try {
        const res = await fetch(API_ENDPOINTS.MANAGEMENT.PROXY_URL, { method: "DELETE" });

        if (res.ok) {
          showToast(t('toastProxyCleared'), "success");
          setTimeout(() => {
            void fetchConfig();
          }, 2000);
        } else {
          showToast(t('toastResetProxyFailed'), "error");
        }
      } catch {
        showToast(t('toastNetworkErrorProxy'), "error");
      } finally {
        setResettingProxy(false);
      }
    };

    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-4">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
        </section>
        <div className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6 text-center space-y-4">
          <p className="text-[var(--text-secondary)]">{t('errorTitle')}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {t('failedToLoadDescription')}
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button onClick={fetchConfig} className="px-2.5 py-1 text-xs">
              {t('retryButton')}
            </Button>
            <Button
              variant="danger"
              onClick={handleEmergencyProxyReset}
              disabled={resettingProxy}
              className="px-2.5 py-1 text-xs"
            >
              {resettingProxy ? t('resetting') : t('emergencyClearProxy')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t('settingsDescription')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {hasUnsavedChanges && (
            <>
              <span className="flex items-center gap-2 rounded-sm border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
                <span className="size-1.5 rounded-full bg-amber-400"></span>
                {t('unsavedChanges')}
              </span>
              <Button variant="ghost" onClick={handleDiscard} disabled={saving} className="px-2.5 py-1 text-xs">
                {t('discardChanges')}
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving || !hasUnsavedChanges} className="px-2.5 py-1 text-xs">
            {saving ? t('saving') : t('saveChanges')}
          </Button>
          </div>
        </div>
      </section>

      <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700">
        <strong>{t('warning')}</strong>{" "}
        <span>
          {t('warningText')}
        </span>
      </div>

      <AgentConfigEditor
        config={config}
        expandedProviders={expandedProviders}
        updateConfig={updateConfig}
        updateStreamingConfig={updateStreamingConfig}
        updateQuotaConfig={updateQuotaConfig}
        updateRoutingConfig={updateRoutingConfig}
        updateTlsConfig={updateTlsConfig}
        updatePprofConfig={updatePprofConfig}
        updateClaudeHeaderDefaults={updateClaudeHeaderDefaults}
        updatePayloadConfig={updatePayloadConfig}
        toggleProviderExpanded={toggleProviderExpanded}
        updateOAuthAliasEntry={updateOAuthAliasEntry}
        addOAuthAliasEntry={addOAuthAliasEntry}
        removeOAuthAliasEntry={removeOAuthAliasEntry}
      />

      <ConfigPreview rawJson={rawJson} />

      <div className="rounded-sm border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-4 text-xs text-[var(--text-muted)]">
        <strong>{t('tip')}</strong> {t('tipText')}
      </div>

      <ConfirmDialog
        isOpen={showProxyWarning}
        onClose={() => setShowProxyWarning(false)}
        onConfirm={() => {
          setShowProxyWarning(false);
          void executeSave();
        }}
        title={t('proxyChangedTitle')}
        message={t('proxyChangedMessage', { url: config?.["proxy-url"] ?? "" })}
        confirmLabel={t('saveAnywayButton')}
        cancelLabel={t('cancelButton')}
        variant="warning"
      />
    </div>
  );
}

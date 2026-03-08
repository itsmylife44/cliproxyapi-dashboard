"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import AgentConfigEditor from "@/components/config/agent-config-editor";
import ConfigPreview from "@/components/config/config-preview";
import yaml from "js-yaml";

export interface StreamingConfig {
  "keepalive-seconds": number;
  "bootstrap-retries": number;
  "nonstream-keepalive-interval": number;
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

export interface AmpcodeConfig {
  "upstream-url": string;
  "upstream-api-key": string;
  "restrict-management-to-localhost": boolean;
  "model-mappings": unknown;
  "force-model-mappings": boolean;
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
  "incognito-browser": boolean;
  "kiro-preferred-endpoint": string;
  kiro: unknown;
  tls: TlsConfig;
  pprof: PprofConfig;
  "claude-header-defaults": ClaudeHeaderDefaults;
  ampcode: AmpcodeConfig;
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
    cleaned[provider] = entries.map(({ _id: _, ...rest }) => rest);
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
  const { showToast } = useToast();

  const hasUnsavedChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG);
      if (!res.ok) {
        showToast("Failed to load configuration", "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data["auth-dir"]) {
        data["auth-dir"] = "~/.cli-proxy-api";
      }
      const stamped = stampOAuthIds(data as Config);
      setConfig(stamped);
      setOriginalConfig(stamped);
      setRawJson(JSON.stringify(data, null, 2));
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchConfig();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);

    try {
      const cleanedConfig = stripOAuthIds(config);
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML, {
        method: "PUT",
        headers: { "Content-Type": "text/yaml" },
        body: yaml.dump(cleanedConfig, { lineWidth: -1, noRefs: true }),
      });

      if (!res.ok) {
        showToast("Failed to save configuration", "error");
        setSaving(false);
        return;
      }

      showToast("Configuration saved successfully", "success");
      setOriginalConfig(config);
      setRawJson(JSON.stringify(stripOAuthIds(config), null, 2));
      setSaving(false);
    } catch {
      showToast("Failed to save configuration", "error");
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      setRawJson(JSON.stringify(stripOAuthIds(originalConfig), null, 2));
      showToast("Changes discarded", "info");
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

  const updateAmpcodeConfig = (key: keyof AmpcodeConfig, value: string | boolean | unknown) => {
    if (!config) return;
    setConfig({ ...config, ampcode: { ...config.ampcode, [key]: value } });
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
    entries[index] = { ...entries[index], [field]: value };
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
        <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Configuration</h1>
        </section>
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-6">
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
              <p className="text-slate-400">Loading configuration...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Configuration</h1>
        </section>
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4 text-center">
          <p className="text-slate-300">Failed to load configuration</p>
          <Button onClick={fetchConfig} className="mt-4 px-2.5 py-1 text-xs">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Configuration</h1>
            <p className="mt-1 text-sm text-slate-400">
              Configure system settings, streaming, retry behavior, and logging.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {hasUnsavedChanges && (
            <>
              <span className="flex items-center gap-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                <span className="size-1.5 rounded-full bg-amber-400"></span>
                Unsaved changes
              </span>
              <Button variant="ghost" onClick={handleDiscard} disabled={saving} className="px-2.5 py-1 text-xs">
                Discard Changes
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving || !hasUnsavedChanges} className="px-2.5 py-1 text-xs">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          </div>
        </div>
      </section>

      <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
        <strong>Warning:</strong>{" "}
        <span>
          Invalid configuration may prevent the service from starting. Review changes carefully before saving.
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
        updateAmpcodeConfig={updateAmpcodeConfig}
        updatePayloadConfig={updatePayloadConfig}
        toggleProviderExpanded={toggleProviderExpanded}
        updateOAuthAliasEntry={updateOAuthAliasEntry}
        addOAuthAliasEntry={addOAuthAliasEntry}
        removeOAuthAliasEntry={removeOAuthAliasEntry}
      />

      <ConfigPreview rawJson={rawJson} />

      <div className="rounded-sm border border-slate-700/70 bg-slate-900/25 p-4 text-xs text-slate-400">
        <strong>TIP:</strong> Changes are saved immediately to the management API. The service may need to be
        restarted for some configuration changes to take effect.
      </div>
    </div>
  );
}

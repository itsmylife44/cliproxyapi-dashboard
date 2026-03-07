"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import yaml from "js-yaml";
import type {
  Config,
  StreamingConfig,
  QuotaExceededConfig,
  RoutingConfig,
  TlsConfig,
  PprofConfig,
  ClaudeHeaderDefaults,
  AmpcodeConfig,
  PayloadConfig,
  OAuthModelAliasEntry,
} from "./_components/config-types";
import { GeneralSettingsSection, StreamingSection, RetryResilienceSection, LoggingSection } from "./_components/core-settings";
import { TlsSection, KiroSection, ClaudeHeadersSection, AmpcodeSection, PprofSection } from "./_components/advanced-settings";
import { OAuthAliasesSection, PayloadSection, RawJsonSection } from "./_components/oauth-payload-settings";

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const hasUnsavedChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/management/config");
      if (!res.ok) {
        showToast("Failed to load configuration", "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data["auth-dir"]) {
        data["auth-dir"] = "~/.cli-proxy-api";
      }
      setConfig(data as Config);
      setOriginalConfig(data as Config);
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
    return () => { window.clearTimeout(timeoutId); };
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/management/config.yaml", {
        method: "PUT",
        headers: { "Content-Type": "text/yaml" },
        body: yaml.dump(config, { lineWidth: -1, noRefs: true }),
      });
      if (!res.ok) {
        showToast("Failed to save configuration", "error");
        setSaving(false);
        return;
      }
      showToast("Configuration saved successfully", "success");
      setOriginalConfig(config);
      setRawJson(JSON.stringify(config, null, 2));
      setSaving(false);
    } catch {
      showToast("Failed to save configuration", "error");
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!originalConfig) return;
    setConfig(originalConfig);
    setRawJson(JSON.stringify(originalConfig, null, 2));
    showToast("Changes discarded", "info");
  };

  const updateConfig = <K extends keyof Config>(key: K, value: Config[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const updateStreamingConfig = (key: keyof StreamingConfig, value: number) => {
    if (!config) return;
    setConfig({ ...config, streaming: { ...config.streaming, [key]: value } });
  };

  const updateQuotaConfig = (key: keyof QuotaExceededConfig, value: boolean) => {
    if (!config) return;
    setConfig({ ...config, "quota-exceeded": { ...config["quota-exceeded"], [key]: value } });
  };

  const updateRoutingConfig = (key: keyof RoutingConfig, value: string) => {
    if (!config) return;
    setConfig({ ...config, routing: { ...config.routing, [key]: value } });
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
    setConfig({ ...config, "oauth-model-alias": { ...aliases, [provider]: entries } });
  };

  const addOAuthAliasEntry = (provider: string) => {
    if (!config) return;
    const aliases = config["oauth-model-alias"] ?? {};
    const entries = [...(aliases[provider] ?? []), { name: "", alias: "" }];
    setConfig({ ...config, "oauth-model-alias": { ...aliases, [provider]: entries } });
  };

  const removeOAuthAliasEntry = (provider: string, index: number) => {
    if (!config) return;
    const aliases = config["oauth-model-alias"] ?? {};
    const entries = (aliases[provider] ?? []).filter((_, i) => i !== index);
    setConfig({ ...config, "oauth-model-alias": { ...aliases, [provider]: entries } });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Configuration</h1>
        </section>
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6">
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
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4 text-center">
          <p className="text-slate-300">Failed to load configuration</p>
          <Button onClick={fetchConfig} className="mt-4 px-2.5 py-1 text-xs">Retry</Button>
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
        <span>Invalid configuration may prevent the service from starting. Review changes carefully before saving.</span>
      </div>

      <GeneralSettingsSection config={config} updateConfig={updateConfig} />
      <StreamingSection config={config} updateStreamingConfig={updateStreamingConfig} />
      <RetryResilienceSection config={config} updateConfig={updateConfig} updateStreamingConfig={updateStreamingConfig} updateQuotaConfig={updateQuotaConfig} updateRoutingConfig={updateRoutingConfig} />
      <LoggingSection config={config} updateConfig={updateConfig} />
      <TlsSection config={config} updateTlsConfig={updateTlsConfig} />
      <KiroSection config={config} updateConfig={updateConfig} />
      <ClaudeHeadersSection config={config} updateClaudeHeaderDefaults={updateClaudeHeaderDefaults} />
      <AmpcodeSection config={config} updateAmpcodeConfig={updateAmpcodeConfig} />
      <PprofSection config={config} updatePprofConfig={updatePprofConfig} />
      <OAuthAliasesSection config={config} updateOAuthAliasEntry={updateOAuthAliasEntry} addOAuthAliasEntry={addOAuthAliasEntry} removeOAuthAliasEntry={removeOAuthAliasEntry} />
      <PayloadSection config={config} updatePayloadConfig={updatePayloadConfig} />
      <RawJsonSection rawJson={rawJson} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />

      <div className="rounded-sm border border-slate-700/70 bg-slate-900/25 p-4 text-xs text-slate-400">
        <strong>TIP:</strong> Changes are saved immediately to the management API. The service may need to be
        restarted for some configuration changes to take effect.
      </div>
    </div>
  );
}

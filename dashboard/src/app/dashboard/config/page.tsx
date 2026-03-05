"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import yaml from "js-yaml";

// Config shape (excluding fields managed elsewhere)
interface StreamingConfig {
  "keepalive-seconds": number;
  "bootstrap-retries": number;
  "nonstream-keepalive-interval": number;
}

interface QuotaExceededConfig {
  "switch-project": boolean;
  "switch-preview-model": boolean;
}

interface RoutingConfig {
  strategy: string;
}

interface TlsConfig {
  enable: boolean;
  cert: string;
  key: string;
}

interface PprofConfig {
  enable: boolean;
  addr: string;
}

interface ClaudeHeaderDefaults {
  "user-agent": string;
  "package-version": string;
  "runtime-version": string;
  timeout: string;
}

interface AmpcodeConfig {
  "upstream-url": string;
  "upstream-api-key": string;
  "restrict-management-to-localhost": boolean;
  "model-mappings": unknown;
  "force-model-mappings": boolean;
}

interface PayloadConfig {
  default: unknown;
  "default-raw": unknown;
  override: unknown;
  "override-raw": unknown;
  filter: unknown;
}

interface OAuthModelAliasEntry {
  name: string;
  alias: string;
  fork?: boolean;
}

interface Config {
  "proxy-url": string;
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

// Toggle Switch Component
function Toggle({ 
  enabled, 
  onChange, 
  disabled = false 
}: { 
  enabled: boolean; 
  onChange: (value: boolean) => void; 
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`
        relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent
        disabled:cursor-not-allowed disabled:opacity-50
        ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6 transform rounded-full
          bg-white shadow-lg ring-0 transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// Dropdown Select Component
function Select({
  value,
  onChange,
  options,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="
        w-full rounded-sm border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-sm
        text-slate-200
        focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
      "
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-[#0f172a] text-slate-100">
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Section Header Component
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-400">{title}</h3>
    </div>
  );
}

// Config Field Component
function ConfigField({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="block text-sm font-semibold text-slate-200">{label}</div>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      <div>{children}</div>
    </div>
  );
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
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

    return () => {
      window.clearTimeout(timeoutId);
    };
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
    if (originalConfig) {
      setConfig(originalConfig);
      setRawJson(JSON.stringify(originalConfig, null, 2));
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
    const entries = [...(aliases[provider] ?? []), { name: "", alias: "" }];
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

      {/* General Settings */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="General Settings" />
           <div className="grid gap-4 sm:grid-cols-2">
              <ConfigField
                label="Upstream Proxy"
               description="Optional SOCKS5/HTTP/HTTPS proxy for outbound requests to AI providers. Leave empty for direct connection."
             >
               <Input
                 type="text"
                 name="proxy-url"
                 value={config["proxy-url"]}
                 onChange={(value) => updateConfig("proxy-url", value)}
                 placeholder="socks5://proxy:1080 or http://proxy:8080"
                 className="font-mono"
               />
             </ConfigField>

             <ConfigField
               label="Force Model Prefix"
               description="Require model names to include a provider prefix"
             >
               <Toggle
                 enabled={config["force-model-prefix"]}
                 onChange={(value) => updateConfig("force-model-prefix", value)}
               />
             </ConfigField>

             <ConfigField
               label="Debug Mode"
               description="Enable verbose debug logging"
             >
               <Toggle
                 enabled={config.debug}
                 onChange={(value) => updateConfig("debug", value)}
               />
             </ConfigField>

            <ConfigField
              label="Commercial Mode"
              description="Enable commercial features and licensing"
            >
              <Toggle
                enabled={config["commercial-mode"]}
                onChange={(value) => updateConfig("commercial-mode", value)}
              />
            </ConfigField>

            <ConfigField
              label="WebSocket Authentication"
              description="Require authentication for WebSocket connections"
            >
              <Toggle
                enabled={config["ws-auth"]}
                onChange={(value) => updateConfig("ws-auth", value)}
              />
            </ConfigField>

            <ConfigField
              label="Disable Cooling"
              description="Disable cooldown between retry attempts"
            >
              <Toggle
                enabled={config["disable-cooling"] ?? false}
                onChange={(value) => updateConfig("disable-cooling", value)}
              />
            </ConfigField>

            <ConfigField
              label="Request Log"
              description="Log all incoming requests"
            >
              <Toggle
                enabled={config["request-log"] ?? false}
                onChange={(value) => updateConfig("request-log", value)}
              />
            </ConfigField>

            <ConfigField
              label="Passthrough Headers"
              description="Forward client headers to upstream providers"
            >
              <Toggle
                enabled={config["passthrough-headers"] ?? false}
                onChange={(value) => updateConfig("passthrough-headers", value)}
              />
            </ConfigField>

            <ConfigField
              label="Incognito Browser"
              description="Use incognito mode for browser-based OAuth flows"
            >
              <Toggle
                enabled={config["incognito-browser"] ?? false}
                onChange={(value) => updateConfig("incognito-browser", value)}
              />
            </ConfigField>
          </div>
      </section>

      {/* Streaming Settings */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Streaming" />
           <div className="grid gap-4 sm:grid-cols-2">
             <ConfigField
               label="Keepalive Seconds"
              description="SSE keepalive interval in seconds"
            >
              <Input
                type="number"
                name="keepalive-seconds"
                value={String(config.streaming["keepalive-seconds"])}
                onChange={(value) =>
                  updateStreamingConfig("keepalive-seconds", Number(value))
                }
                className="font-mono"
              />
            </ConfigField>

             <ConfigField
               label="Bootstrap Retries"
               description="Number of bootstrap retry attempts"
             >
               <Input
                 type="number"
                 name="bootstrap-retries"
                 value={String(config.streaming["bootstrap-retries"])}
                 onChange={(value) =>
                   updateStreamingConfig("bootstrap-retries", Number(value))
                 }
                 className="font-mono"
               />
             </ConfigField>

             <ConfigField
               label="Non-Stream Keepalive Interval"
               description="Emit blank lines every N seconds for non-streaming responses to prevent idle timeouts (0 = disabled)"
             >
               <Input
                 type="number"
                 name="nonstream-keepalive-interval"
                 value={String(config.streaming["nonstream-keepalive-interval"] ?? 0)}
                 onChange={(value) =>
                   updateStreamingConfig("nonstream-keepalive-interval", Number(value))
                 }
                 className="font-mono"
               />
             </ConfigField>
           </div>
      </section>

      {/* Retry & Resilience */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Retry & Resilience" />
           <div className="grid gap-4 sm:grid-cols-2">
             <ConfigField
               label="Request Retry Attempts"
              description="Maximum number of retry attempts for failed requests"
            >
              <Input
                type="number"
                name="request-retry"
                value={String(config["request-retry"])}
                onChange={(value) => updateConfig("request-retry", Number(value))}
                className="font-mono"
              />
            </ConfigField>

            <ConfigField
              label="Max Retry Interval (seconds)"
              description="Maximum interval between retry attempts"
            >
              <Input
                type="number"
                name="max-retry-interval"
                value={String(config["max-retry-interval"])}
                onChange={(value) => updateConfig("max-retry-interval", Number(value))}
                className="font-mono"
              />
            </ConfigField>

             <ConfigField
               label="Routing Strategy"
               description="Load balancing strategy for multiple providers"
             >
               <Select
                 value={config.routing.strategy}
                 onChange={(value) => updateRoutingConfig("strategy", value)}
                 options={[
                   { value: "round-robin", label: "Round Robin" },
                   { value: "random", label: "Random" },
                   { value: "least-loaded", label: "Least Loaded" },
                 ]}
               />
             </ConfigField>

             <ConfigField
               label="Switch Project on Quota Exceeded"
               description="Automatically switch to another project when quota is exceeded"
             >
               <Toggle
                 enabled={config["quota-exceeded"]["switch-project"]}
                 onChange={(value) =>
                   updateQuotaConfig("switch-project", value)
                 }
               />
             </ConfigField>

            <ConfigField
              label="Switch Preview Model on Quota Exceeded"
              description="Fall back to preview models when quota is exceeded"
            >
              <Toggle
                enabled={config["quota-exceeded"]["switch-preview-model"]}
                onChange={(value) =>
                  updateQuotaConfig("switch-preview-model", value)
                }
              />
            </ConfigField>

            <ConfigField
              label="Max Retry Credentials"
              description="Maximum credential rotation retries (0 = disabled)"
            >
              <Input
                type="number"
                name="max-retry-credentials"
                value={String(config["max-retry-credentials"] ?? 0)}
                onChange={(value) => updateConfig("max-retry-credentials", Number(value))}
                className="font-mono"
              />
            </ConfigField>
          </div>
      </section>

      {/* Logging */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Logging" />
           <div className="grid gap-4 sm:grid-cols-2">
             <ConfigField
               label="Logging to File"
              description="Enable persistent file-based logging"
            >
              <Toggle
                enabled={config["logging-to-file"]}
                onChange={(value) => updateConfig("logging-to-file", value)}
              />
            </ConfigField>

            <ConfigField
              label="Usage Statistics"
              description="Collect anonymous usage statistics"
            >
              <Toggle
                enabled={config["usage-statistics-enabled"]}
                onChange={(value) => updateConfig("usage-statistics-enabled", value)}
              />
            </ConfigField>

            <ConfigField
              label="Max Total Log Size (MB)"
              description="Maximum total size of all log files (0 = unlimited)"
            >
              <Input
                type="number"
                name="logs-max-total-size-mb"
                value={String(config["logs-max-total-size-mb"])}
                onChange={(value) => updateConfig("logs-max-total-size-mb", Number(value))}
                className="font-mono"
              />
            </ConfigField>

            <ConfigField
              label="Max Error Log Files"
              description="Maximum number of error log files to retain"
            >
              <Input
                type="number"
                name="error-logs-max-files"
                value={String(config["error-logs-max-files"])}
                onChange={(value) => updateConfig("error-logs-max-files", Number(value))}
                className="font-mono"
              />
            </ConfigField>
          </div>
      </section>

      {/* TLS / HTTPS */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="TLS / HTTPS" />
        <div className="rounded-sm border border-slate-600/40 bg-slate-800/30 p-3 text-xs text-slate-400">
          TLS is typically handled by Caddy reverse proxy. Only configure this for direct TLS termination.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField
            label="Enable TLS"
            description="Enable TLS"
          >
            <Toggle
              enabled={config.tls?.enable ?? false}
              onChange={(value) => updateTlsConfig("enable", value)}
            />
          </ConfigField>

          <ConfigField
            label="Certificate Path"
            description="Path to TLS certificate file"
          >
            <Input
              type="text"
              name="tls-cert"
              value={config.tls?.cert ?? ""}
              onChange={(value) => updateTlsConfig("cert", value)}
              placeholder="/path/to/cert.pem"
              className="font-mono"
            />
          </ConfigField>

          <ConfigField
            label="Private Key Path"
            description="Path to TLS private key file"
          >
            <Input
              type="text"
              name="tls-key"
              value={config.tls?.key ?? ""}
              onChange={(value) => updateTlsConfig("key", value)}
              placeholder="/path/to/key.pem"
              className="font-mono"
            />
          </ConfigField>
        </div>
      </section>

      {/* Kiro */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Kiro" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField
            label="Preferred Endpoint"
            description="Preferred Kiro API endpoint URL"
          >
            <Input
              type="text"
              name="kiro-preferred-endpoint"
              value={config["kiro-preferred-endpoint"] ?? ""}
              onChange={(value) => updateConfig("kiro-preferred-endpoint", value)}
              placeholder="https://..."
              className="font-mono"
            />
          </ConfigField>
        </div>
      </section>

      {/* Claude Header Defaults */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Claude Header Defaults" />
        <p className="text-xs text-slate-500">Custom headers sent with all Claude API requests</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField
            label="User-Agent"
            description="Custom User-Agent header"
          >
            <Input
              type="text"
              name="claude-header-user-agent"
              value={config["claude-header-defaults"]?.["user-agent"] ?? ""}
              onChange={(value) => updateClaudeHeaderDefaults("user-agent", value)}
              className="font-mono"
            />
          </ConfigField>

          <ConfigField
            label="Package Version"
            description="Package version header"
          >
            <Input
              type="text"
              name="claude-header-package-version"
              value={config["claude-header-defaults"]?.["package-version"] ?? ""}
              onChange={(value) => updateClaudeHeaderDefaults("package-version", value)}
              className="font-mono"
            />
          </ConfigField>

          <ConfigField
            label="Runtime Version"
            description="Runtime version header"
          >
            <Input
              type="text"
              name="claude-header-runtime-version"
              value={config["claude-header-defaults"]?.["runtime-version"] ?? ""}
              onChange={(value) => updateClaudeHeaderDefaults("runtime-version", value)}
              className="font-mono"
            />
          </ConfigField>

          <ConfigField
            label="Timeout"
            description="Request timeout header"
          >
            <Input
              type="text"
              name="claude-header-timeout"
              value={config["claude-header-defaults"]?.["timeout"] ?? ""}
              onChange={(value) => updateClaudeHeaderDefaults("timeout", value)}
              className="font-mono"
            />
          </ConfigField>
        </div>
      </section>

      {/* Amp Code */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Amp Code" />
        <p className="text-xs text-slate-500">Configuration for Amp Code upstream integration</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField
            label="Upstream URL"
            description="Upstream Amp Code URL"
          >
            <Input
              type="text"
              name="ampcode-upstream-url"
              value={config.ampcode?.["upstream-url"] ?? ""}
              onChange={(value) => updateAmpcodeConfig("upstream-url", value)}
              className="font-mono"
            />
          </ConfigField>

          <ConfigField
            label="Upstream API Key"
            description="Upstream API key"
          >
            <Input
              type="password"
              name="ampcode-upstream-api-key"
              value={config.ampcode?.["upstream-api-key"] ?? ""}
              onChange={(value) => updateAmpcodeConfig("upstream-api-key", value)}
              className="font-mono"
            />
          </ConfigField>

          <ConfigField
            label="Restrict Management to Localhost"
            description="Restrict management API to localhost only"
          >
            <Toggle
              enabled={config.ampcode?.["restrict-management-to-localhost"] ?? false}
              onChange={(value) => updateAmpcodeConfig("restrict-management-to-localhost", value)}
            />
          </ConfigField>

          <ConfigField
            label="Force Model Mappings"
            description="Force model mappings"
          >
            <Toggle
              enabled={config.ampcode?.["force-model-mappings"] ?? false}
              onChange={(value) => updateAmpcodeConfig("force-model-mappings", value)}
            />
          </ConfigField>
        </div>
      </section>

      {/* Profiling (pprof) */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Profiling (pprof)" />
        <div className="rounded-sm border border-slate-600/40 bg-slate-800/30 p-3 text-xs text-slate-400">
          Go runtime profiling. Only enable for debugging.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField
            label="Enable pprof"
            description="Enable pprof endpoint"
          >
            <Toggle
              enabled={config.pprof?.enable ?? false}
              onChange={(value) => updatePprofConfig("enable", value)}
            />
          </ConfigField>

          <ConfigField
            label="Listen Address"
            description="pprof listen address"
          >
            <Input
              type="text"
              name="pprof-addr"
              value={config.pprof?.addr ?? ""}
              onChange={(value) => updatePprofConfig("addr", value)}
              placeholder="127.0.0.1:8316"
              className="font-mono"
            />
          </ConfigField>
        </div>
      </section>

      {/* OAuth Model Aliases */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="OAuth Model Aliases" />
        <p className="text-xs text-slate-500">Override model names for OAuth providers. Each provider has a list of model name mappings.</p>
        <div className="space-y-3">
          {Object.keys(config["oauth-model-alias"] ?? {}).length === 0 && (
            <p className="text-xs text-slate-500 italic">No OAuth model aliases configured.</p>
          )}
          {Object.entries(config["oauth-model-alias"] ?? {}).map(([provider, entries]) => (
            <div key={provider} className="rounded-sm border border-slate-700/50 bg-slate-900/40">
              <button
                type="button"
                onClick={() => toggleProviderExpanded(provider)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800/30 transition-colors"
              >
                <span>{provider}</span>
                <span className="text-slate-400 text-xs">
                  {entries.length} {entries.length === 1 ? "alias" : "aliases"}
                  <span className="ml-2">{expandedProviders[provider] ? "▲" : "▼"}</span>
                </span>
              </button>
              {expandedProviders[provider] && (
                <div className="border-t border-slate-700/50 p-4 space-y-3">
                  {entries.length > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1 border-b border-slate-700/30">
                      <span>Name</span>
                      <span>Alias</span>
                      <span>Fork</span>
                      <span></span>
                    </div>
                  )}
                  {entries.map((entry, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateOAuthAliasEntry(provider, index, "name", e.target.value)}
                        placeholder="model-name"
                        className="rounded-sm border border-slate-700/70 bg-slate-900/50 px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                      />
                      <input
                        type="text"
                        value={entry.alias}
                        onChange={(e) => updateOAuthAliasEntry(provider, index, "alias", e.target.value)}
                        placeholder="alias-name"
                        className="rounded-sm border border-slate-700/70 bg-slate-900/50 px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                      />
                      <input
                        type="checkbox"
                        checked={entry.fork ?? false}
                        onChange={(e) => updateOAuthAliasEntry(provider, index, "fork", e.target.checked)}
                        className="size-4 rounded accent-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeOAuthAliasEntry(provider, index)}
                        className="flex size-6 items-center justify-center rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove entry"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOAuthAliasEntry(provider)}
                    className="mt-1 flex items-center gap-1.5 rounded-sm border border-dashed border-slate-600/60 px-3 py-1.5 text-xs text-slate-400 hover:border-blue-400/50 hover:text-blue-400 transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3">
                      <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
                    </svg>
                    Add entry
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Payload Manipulation */}
      <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
        <SectionHeader title="Payload Manipulation" />
        <p className="text-xs text-slate-500">Override or filter request payloads sent to upstream providers. Values are JSON.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["default", "default-raw", "override", "override-raw", "filter"] as const).map((key) => (
            <ConfigField
              key={key}
              label={key}
              description={
                key === "default" ? "Default payload fields merged into every request" :
                key === "default-raw" ? "Raw default payload (overrides default)" :
                key === "override" ? "Payload fields that override request values" :
                key === "override-raw" ? "Raw override payload (overrides override)" :
                "Fields to filter/remove from requests"
              }
            >
              <textarea
                value={
                  config.payload?.[key] == null
                    ? ""
                    : typeof config.payload[key] === "string"
                      ? (config.payload[key] as string)
                      : JSON.stringify(config.payload[key], null, 2)
                }
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    updatePayloadConfig(key, null);
                    return;
                  }
                  try {
                    updatePayloadConfig(key, JSON.parse(raw));
                  } catch {
                    // allow partial editing — update as raw string temporarily
                    updatePayloadConfig(key, raw);
                  }
                }}
                placeholder="null"
                spellCheck={false}
                className="h-28 w-full rounded-sm border border-slate-700/70 bg-slate-900/40 p-3 font-mono text-xs text-slate-200 focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors resize-y"
              />
            </ConfigField>
          ))}
        </div>
      </section>

      {/* Advanced: Raw JSON Editor */}
      <section className="space-y-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-4">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <SectionHeader title="Advanced: Raw JSON Editor" />
              <Button
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs"
              >
                {showAdvanced ? "Hide" : "Show"} Raw JSON
              </Button>
            </div>
        {showAdvanced && (
            <div className="space-y-4">
              <div className="rounded-sm border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                <strong>Warning:</strong>{" "}
                <span>
                  This section shows the complete configuration including fields managed on other pages.
                  Only edit this if you know what you&apos;re doing. Changes here will NOT be saved from this editor.
                </span>
              </div>
              <textarea
                value={rawJson}
                readOnly
                className="h-96 w-full rounded-sm border border-slate-700/70 bg-slate-900/40 p-4 font-mono text-xs text-slate-200 focus:border-blue-400/50 focus:outline-none"
                spellCheck={false}
              />
              <p className="text-xs text-slate-500">
                This is a read-only view of the full configuration. Use the structured forms above to make changes.
              </p>
            </div>
        )}
      </section>

      <div className="rounded-sm border border-slate-700/70 bg-slate-900/25 p-4 text-xs text-slate-400">
        <strong>TIP:</strong> Changes are saved immediately to the management API. The service may need to be
        restarted for some configuration changes to take effect.
      </div>
    </div>
  );
}

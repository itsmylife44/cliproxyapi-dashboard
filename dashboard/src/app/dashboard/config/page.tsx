"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

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
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent
        disabled:cursor-not-allowed disabled:opacity-50
        ${enabled ? 'bg-emerald-500' : 'bg-white/20'}
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
        w-full px-4 py-2 text-sm rounded-xl
        backdrop-blur-xl bg-white/5 border border-white/20
        text-white
        focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200
      "
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-[#0a0a12] text-white">
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Section Header Component
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-sm">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
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
      <div className="block text-sm font-semibold text-white">{label}</div>
      {description && <p className="text-xs text-white/50">{description}</p>}
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
    void fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);

    try {
      const res = await fetch("/api/management/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
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

   if (loading) {
     return (
       <div className="space-y-4">
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           Configuration
         </h1>
        <Card>
           <CardContent>
             <div className="flex items-center justify-center p-6">
               <div className="flex flex-col items-center gap-4">
                 <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-purple-500"></div>
                 <p className="text-white/80">Loading configuration...</p>
               </div>
             </div>
           </CardContent>
        </Card>
      </div>
    );
  }

   if (!config) {
     return (
       <div className="space-y-4">
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           Configuration
         </h1>
         <Card>
           <CardContent>
             <div className="p-4 text-center">
               <p className="text-white/80">Failed to load configuration</p>
               <Button onClick={fetchConfig} className="mt-4">
                 Retry
               </Button>
             </div>
           </CardContent>
         </Card>
      </div>
    );
  }

   return (
     <div className="space-y-4">
       <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
         <div>
           <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
             Configuration
           </h1>
          <p className="mt-2 text-sm text-white/60">
            Configure system settings, streaming, retry behavior, and logging
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnsavedChanges && (
            <>
              <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-sm font-medium text-amber-300">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse"></span>
                Unsaved changes
              </span>
              <Button variant="ghost" onClick={handleDiscard} disabled={saving}>
                Discard Changes
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="border-l-4 border-yellow-400/60 bg-yellow-500/20 backdrop-blur-xl p-3 text-sm rounded-r-xl">
        <strong className="text-white">Warning:</strong>{" "}
        <span className="text-white/90">
          Invalid configuration may prevent the service from starting. Review changes carefully before saving.
        </span>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SectionHeader icon="⚙️" title="General Settings" />
          </CardTitle>
        </CardHeader>
        <CardContent>
           <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Streaming Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SectionHeader icon="📡" title="Streaming" />
          </CardTitle>
        </CardHeader>
        <CardContent>
           <div className="grid gap-4 md:grid-cols-2">
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
         </CardContent>
       </Card>

      {/* Retry & Resilience */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SectionHeader icon="🔄" title="Retry & Resilience" />
          </CardTitle>
        </CardHeader>
        <CardContent>
           <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Logging */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SectionHeader icon="📝" title="Logging" />
          </CardTitle>
        </CardHeader>
        <CardContent>
           <div className="grid gap-4 md:grid-cols-2">
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
        </CardContent>
      </Card>

      {/* Advanced: Raw JSON Editor */}
      <Card className="border-2 border-red-500/30 bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5">
        <CardHeader>
          <CardTitle>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <SectionHeader icon="⚠️" title="Advanced: Raw JSON Editor" />
              <Button
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs"
              >
                {showAdvanced ? "Hide" : "Show"} Raw JSON
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        {showAdvanced && (
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-red-400/60 bg-red-500/20 backdrop-blur-xl p-3 text-sm rounded-r-xl">
                <strong className="text-white">Warning:</strong>{" "}
                <span className="text-white/90">
                  This section shows the complete configuration including fields managed on other pages.
                  Only edit this if you know what you&apos;re doing. Changes here will NOT be saved from this editor.
                </span>
              </div>
              <textarea
                value={rawJson}
                readOnly
                className="h-96 w-full backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all shadow-lg font-mono"
                spellCheck={false}
              />
              <p className="text-xs text-white/50">
                This is a read-only view of the full configuration. Use the structured forms above to make changes.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="border-l-4 border-blue-400/60 backdrop-blur-xl bg-white/10 p-4 text-xs text-white rounded-r-xl">
        <strong>TIP:</strong> Changes are saved immediately to the management API. The service may need to be
        restarted for some configuration changes to take effect.
      </div>
    </div>
  );
}

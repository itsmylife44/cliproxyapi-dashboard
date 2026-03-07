"use client";

import { Input } from "@/components/ui/input";
import { Toggle, Select, SectionHeader, ConfigField } from "./config-form-controls";
import type { Config, StreamingConfig, QuotaExceededConfig, RoutingConfig } from "./config-types";

interface CoreSettingsProps {
  config: Config;
  updateConfig: <K extends keyof Config>(key: K, value: Config[K]) => void;
  updateStreamingConfig: (key: keyof StreamingConfig, value: number) => void;
  updateQuotaConfig: (key: keyof QuotaExceededConfig, value: boolean) => void;
  updateRoutingConfig: (key: keyof RoutingConfig, value: string) => void;
}

export function GeneralSettingsSection({ config, updateConfig }: Pick<CoreSettingsProps, "config" | "updateConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="General Settings" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField label="Upstream Proxy" description="Optional SOCKS5/HTTP/HTTPS proxy for outbound requests to AI providers. Leave empty for direct connection.">
          <Input type="text" name="proxy-url" value={config["proxy-url"]} onChange={(value) => updateConfig("proxy-url", value)} placeholder="socks5://proxy:1080 or http://proxy:8080" className="font-mono" />
        </ConfigField>
        <ConfigField label="Force Model Prefix" description="Require model names to include a provider prefix">
          <Toggle enabled={config["force-model-prefix"]} onChange={(value) => updateConfig("force-model-prefix", value)} />
        </ConfigField>
        <ConfigField label="Debug Mode" description="Enable verbose debug logging">
          <Toggle enabled={config.debug} onChange={(value) => updateConfig("debug", value)} />
        </ConfigField>
        <ConfigField label="Commercial Mode" description="Enable commercial features and licensing">
          <Toggle enabled={config["commercial-mode"]} onChange={(value) => updateConfig("commercial-mode", value)} />
        </ConfigField>
        <ConfigField label="WebSocket Authentication" description="Require authentication for WebSocket connections">
          <Toggle enabled={config["ws-auth"]} onChange={(value) => updateConfig("ws-auth", value)} />
        </ConfigField>
        <ConfigField label="Disable Cooling" description="Disable cooldown between retry attempts">
          <Toggle enabled={config["disable-cooling"] ?? false} onChange={(value) => updateConfig("disable-cooling", value)} />
        </ConfigField>
        <ConfigField label="Request Log" description="Log all incoming requests">
          <Toggle enabled={config["request-log"] ?? false} onChange={(value) => updateConfig("request-log", value)} />
        </ConfigField>
        <ConfigField label="Passthrough Headers" description="Forward client headers to upstream providers">
          <Toggle enabled={config["passthrough-headers"] ?? false} onChange={(value) => updateConfig("passthrough-headers", value)} />
        </ConfigField>
        <ConfigField label="Incognito Browser" description="Use incognito mode for browser-based OAuth flows">
          <Toggle enabled={config["incognito-browser"] ?? false} onChange={(value) => updateConfig("incognito-browser", value)} />
        </ConfigField>
      </div>
    </section>
  );
}

export function StreamingSection({ config, updateStreamingConfig }: Pick<CoreSettingsProps, "config" | "updateStreamingConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Streaming" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField label="Keepalive Seconds" description="SSE keepalive interval in seconds">
          <Input type="number" name="keepalive-seconds" value={String(config.streaming["keepalive-seconds"])} onChange={(value) => updateStreamingConfig("keepalive-seconds", Number(value))} className="font-mono" />
        </ConfigField>
        <ConfigField label="Bootstrap Retries" description="Number of bootstrap retry attempts">
          <Input type="number" name="bootstrap-retries" value={String(config.streaming["bootstrap-retries"])} onChange={(value) => updateStreamingConfig("bootstrap-retries", Number(value))} className="font-mono" />
        </ConfigField>
        <ConfigField label="Non-Stream Keepalive Interval" description="Emit blank lines every N seconds for non-streaming responses to prevent idle timeouts (0 = disabled)">
          <Input type="number" name="nonstream-keepalive-interval" value={String(config.streaming["nonstream-keepalive-interval"] ?? 0)} onChange={(value) => updateStreamingConfig("nonstream-keepalive-interval", Number(value))} className="font-mono" />
        </ConfigField>
      </div>
    </section>
  );
}

export function RetryResilienceSection({ config, updateConfig, updateQuotaConfig, updateRoutingConfig }: CoreSettingsProps) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Retry & Resilience" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField label="Request Retry Attempts" description="Maximum number of retry attempts for failed requests">
          <Input type="number" name="request-retry" value={String(config["request-retry"])} onChange={(value) => updateConfig("request-retry", Number(value))} className="font-mono" />
        </ConfigField>
        <ConfigField label="Max Retry Interval (seconds)" description="Maximum interval between retry attempts">
          <Input type="number" name="max-retry-interval" value={String(config["max-retry-interval"])} onChange={(value) => updateConfig("max-retry-interval", Number(value))} className="font-mono" />
        </ConfigField>
        <ConfigField label="Routing Strategy" description="Load balancing strategy for multiple providers">
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
        <ConfigField label="Switch Project on Quota Exceeded" description="Automatically switch to another project when quota is exceeded">
          <Toggle enabled={config["quota-exceeded"]["switch-project"]} onChange={(value) => updateQuotaConfig("switch-project", value)} />
        </ConfigField>
        <ConfigField label="Switch Preview Model on Quota Exceeded" description="Fall back to preview models when quota is exceeded">
          <Toggle enabled={config["quota-exceeded"]["switch-preview-model"]} onChange={(value) => updateQuotaConfig("switch-preview-model", value)} />
        </ConfigField>
        <ConfigField label="Max Retry Credentials" description="Maximum credential rotation retries (0 = disabled)">
          <Input type="number" name="max-retry-credentials" value={String(config["max-retry-credentials"] ?? 0)} onChange={(value) => updateConfig("max-retry-credentials", Number(value))} className="font-mono" />
        </ConfigField>
      </div>
    </section>
  );
}

export function LoggingSection({ config, updateConfig }: Pick<CoreSettingsProps, "config" | "updateConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Logging" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField label="Logging to File" description="Enable persistent file-based logging">
          <Toggle enabled={config["logging-to-file"]} onChange={(value) => updateConfig("logging-to-file", value)} />
        </ConfigField>
        <ConfigField label="Usage Statistics" description="Collect anonymous usage statistics">
          <Toggle enabled={config["usage-statistics-enabled"]} onChange={(value) => updateConfig("usage-statistics-enabled", value)} />
        </ConfigField>
        <ConfigField label="Max Total Log Size (MB)" description="Maximum total size of all log files (0 = unlimited)">
          <Input type="number" name="logs-max-total-size-mb" value={String(config["logs-max-total-size-mb"])} onChange={(value) => updateConfig("logs-max-total-size-mb", Number(value))} className="font-mono" />
        </ConfigField>
        <ConfigField label="Max Error Log Files" description="Maximum number of error log files to retain">
          <Input type="number" name="error-logs-max-files" value={String(config["error-logs-max-files"])} onChange={(value) => updateConfig("error-logs-max-files", Number(value))} className="font-mono" />
        </ConfigField>
      </div>
    </section>
  );
}

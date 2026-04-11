"use client";

import { Input } from "@/components/ui/input";
import { Toggle, Select, SectionHeader, ConfigField } from "@/components/config/config-fields";
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
} from "@/app/dashboard/config/page";

interface AgentConfigEditorProps {
  config: Config;
  expandedProviders: Record<string, boolean>;
  updateConfig: <K extends keyof Config>(key: K, value: Config[K]) => void;
  updateStreamingConfig: (key: keyof StreamingConfig, value: number) => void;
  updateQuotaConfig: (key: keyof QuotaExceededConfig, value: boolean) => void;
  updateRoutingConfig: (key: keyof RoutingConfig, value: string) => void;
  updateTlsConfig: (key: keyof TlsConfig, value: string | boolean) => void;
  updatePprofConfig: (key: keyof PprofConfig, value: string | boolean) => void;
  updateClaudeHeaderDefaults: (key: keyof ClaudeHeaderDefaults, value: string) => void;
  updateAmpcodeConfig: (key: keyof AmpcodeConfig, value: string | boolean | unknown) => void;
  updatePayloadConfig: (key: keyof PayloadConfig, value: unknown) => void;
  toggleProviderExpanded: (provider: string) => void;
  updateOAuthAliasEntry: (provider: string, index: number, field: keyof OAuthModelAliasEntry, value: string | boolean) => void;
  addOAuthAliasEntry: (provider: string) => void;
  removeOAuthAliasEntry: (provider: string, index: number) => void;
}

export default function AgentConfigEditor({
  config,
  expandedProviders,
  updateConfig,
  updateStreamingConfig,
  updateQuotaConfig,
  updateRoutingConfig,
  updateTlsConfig,
  updatePprofConfig,
  updateClaudeHeaderDefaults,
  updateAmpcodeConfig,
  updatePayloadConfig,
  toggleProviderExpanded,
  updateOAuthAliasEntry,
  addOAuthAliasEntry,
  removeOAuthAliasEntry,
}: AgentConfigEditorProps) {
  return (
    <>
      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="General Settings" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="Upstream Proxy" description="Optional SOCKS5/HTTP/HTTPS proxy for outbound requests. Use 'direct' or 'none' to bypass. Leave empty for direct connection.">
            <Input type="text" name="proxy-url" value={config["proxy-url"]} onChange={(value) => updateConfig("proxy-url", value)} placeholder="socks5://user:pass@host:port" className="font-mono" />
          </ConfigField>
          <ConfigField label="Auth Directory" description="Directory where OAuth credential files are stored.">
            <Input type="text" name="auth-dir" value={config["auth-dir"]} onChange={(value) => updateConfig("auth-dir", value)} placeholder="~/.cli-proxy-api" className="font-mono" />
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

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
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

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="Retry & Resilience" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="Request Retry Attempts" description="Maximum number of retry attempts for failed requests">
            <Input type="number" name="request-retry" value={String(config["request-retry"])} onChange={(value) => updateConfig("request-retry", Number(value))} className="font-mono" />
          </ConfigField>
          <ConfigField label="Max Retry Interval (seconds)" description="Maximum interval between retry attempts">
            <Input type="number" name="max-retry-interval" value={String(config["max-retry-interval"])} onChange={(value) => updateConfig("max-retry-interval", Number(value))} className="font-mono" />
          </ConfigField>
          <ConfigField label="Routing Strategy" description="Load balancing strategy for multiple providers">
            <Select value={config.routing.strategy} onChange={(value) => updateRoutingConfig("strategy", value)} options={[{ value: "round-robin", label: "Round Robin" }, { value: "random", label: "Random" }, { value: "least-loaded", label: "Least Loaded" }]} />
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

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
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

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="TLS / HTTPS" />
        <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)]">
          TLS is typically handled by Caddy reverse proxy. Only configure this for direct TLS termination.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="Enable TLS" description="Enable TLS">
            <Toggle enabled={config.tls?.enable ?? false} onChange={(value) => updateTlsConfig("enable", value)} />
          </ConfigField>
          <ConfigField label="Certificate Path" description="Path to TLS certificate file">
            <Input type="text" name="tls-cert" value={config.tls?.cert ?? ""} onChange={(value) => updateTlsConfig("cert", value)} placeholder="/path/to/cert.pem" className="font-mono" />
          </ConfigField>
          <ConfigField label="Private Key Path" description="Path to TLS private key file">
            <Input type="text" name="tls-key" value={config.tls?.key ?? ""} onChange={(value) => updateTlsConfig("key", value)} placeholder="/path/to/key.pem" className="font-mono" />
          </ConfigField>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="Kiro" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="Preferred Endpoint" description="Preferred Kiro API endpoint URL">
            <Input type="text" name="kiro-preferred-endpoint" value={config["kiro-preferred-endpoint"] ?? ""} onChange={(value) => updateConfig("kiro-preferred-endpoint", value)} placeholder="https://..." className="font-mono" />
          </ConfigField>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="Claude Header Defaults" />
        <p className="text-xs text-[var(--text-muted)]">Custom headers sent with all Claude API requests</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="User-Agent" description="Custom User-Agent header">
            <Input type="text" name="claude-header-user-agent" value={config["claude-header-defaults"]?.["user-agent"] ?? ""} onChange={(value) => updateClaudeHeaderDefaults("user-agent", value)} className="font-mono" />
          </ConfigField>
          <ConfigField label="Package Version" description="Package version header">
            <Input type="text" name="claude-header-package-version" value={config["claude-header-defaults"]?.["package-version"] ?? ""} onChange={(value) => updateClaudeHeaderDefaults("package-version", value)} className="font-mono" />
          </ConfigField>
          <ConfigField label="Runtime Version" description="Runtime version header">
            <Input type="text" name="claude-header-runtime-version" value={config["claude-header-defaults"]?.["runtime-version"] ?? ""} onChange={(value) => updateClaudeHeaderDefaults("runtime-version", value)} className="font-mono" />
          </ConfigField>
          <ConfigField label="Timeout" description="Request timeout header">
            <Input type="text" name="claude-header-timeout" value={config["claude-header-defaults"]?.["timeout"] ?? ""} onChange={(value) => updateClaudeHeaderDefaults("timeout", value)} className="font-mono" />
          </ConfigField>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="Amp Code" />
        <p className="text-xs text-[var(--text-muted)]">Configuration for Amp Code upstream integration</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="Upstream URL" description="Upstream Amp Code URL">
            <Input type="text" name="ampcode-upstream-url" value={config.ampcode?.["upstream-url"] ?? ""} onChange={(value) => updateAmpcodeConfig("upstream-url", value)} className="font-mono" />
          </ConfigField>
          <ConfigField label="Upstream API Key" description="Upstream API key">
            <Input type="password" name="ampcode-upstream-api-key" value={config.ampcode?.["upstream-api-key"] ?? ""} onChange={(value) => updateAmpcodeConfig("upstream-api-key", value)} className="font-mono" />
          </ConfigField>
          <ConfigField label="Restrict Management to Localhost" description="Restrict management API to localhost only">
            <Toggle enabled={config.ampcode?.["restrict-management-to-localhost"] ?? false} onChange={(value) => updateAmpcodeConfig("restrict-management-to-localhost", value)} />
          </ConfigField>
          <ConfigField label="Force Model Mappings" description="Force model mappings">
            <Toggle enabled={config.ampcode?.["force-model-mappings"] ?? false} onChange={(value) => updateAmpcodeConfig("force-model-mappings", value)} />
          </ConfigField>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="Profiling (pprof)" />
        <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)]">
          Go runtime profiling. Only enable for debugging.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigField label="Enable pprof" description="Enable pprof endpoint">
            <Toggle enabled={config.pprof?.enable ?? false} onChange={(value) => updatePprofConfig("enable", value)} />
          </ConfigField>
          <ConfigField label="Listen Address" description="pprof listen address">
            <Input type="text" name="pprof-addr" value={config.pprof?.addr ?? ""} onChange={(value) => updatePprofConfig("addr", value)} placeholder="127.0.0.1:8316" className="font-mono" />
          </ConfigField>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="OAuth Model Aliases" />
        <p className="text-xs text-[var(--text-muted)]">Override model names for OAuth providers. Each provider has a list of model name mappings.</p>
        <div className="space-y-3">
          {Object.keys(config["oauth-model-alias"] ?? {}).length === 0 && (
            <p className="text-xs text-[var(--text-muted)] italic">No OAuth model aliases configured.</p>
          )}
          {Object.entries(config["oauth-model-alias"] ?? {}).map(([provider, entries]) => (
            <div key={provider} className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)]">
              <button
                type="button"
                onClick={() => toggleProviderExpanded(provider)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <span>{provider}</span>
                <span className="text-[var(--text-muted)] text-xs">
                  {entries.length} {entries.length === 1 ? "alias" : "aliases"}
                  <span className="ml-2">{expandedProviders[provider] ? "\u25B2" : "\u25BC"}</span>
                </span>
              </button>
              {expandedProviders[provider] && (
                <div className="border-t border-[var(--surface-border)] p-4 space-y-3">
                  {entries.length > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide pb-1 border-b border-[var(--surface-border)]/30">
                      <span>Name</span>
                      <span>Alias</span>
                      <span>Fork</span>
                      <span></span>
                    </div>
                  )}
                  {entries.map((entry, index) => (
                    <div key={entry._id ?? index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                      <input type="text" value={entry.name} onChange={(e) => updateOAuthAliasEntry(provider, index, "name", e.target.value)} placeholder="model-name" className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30" />
                      <input type="text" value={entry.alias} onChange={(e) => updateOAuthAliasEntry(provider, index, "alias", e.target.value)} placeholder="alias-name" className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30" />
                      <input type="checkbox" checked={entry.fork ?? false} onChange={(e) => updateOAuthAliasEntry(provider, index, "fork", e.target.checked)} className="size-4 rounded accent-emerald-500" />
                      <button
                        type="button"
                        onClick={() => removeOAuthAliasEntry(provider, index)}
                        className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
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
                    className="mt-1 flex items-center gap-1.5 rounded-sm border border-dashed border-[var(--surface-border)]/60 px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-blue-400/50 hover:text-blue-600 transition-colors"
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

      <section className="space-y-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <SectionHeader title="Payload Manipulation" />
        <p className="text-xs text-[var(--text-muted)]">Override or filter request payloads sent to upstream providers. Values are JSON.</p>
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
                  const raw = e.target.value;
                  if (raw.trim() === "") {
                    updatePayloadConfig(key, null);
                    return;
                  }
                  try {
                    updatePayloadConfig(key, JSON.parse(raw));
                  } catch {
                    updatePayloadConfig(key, raw);
                  }
                }}
                placeholder="null"
                spellCheck={false}
                className="h-28 w-full rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 font-mono text-xs text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors resize-y"
              />
            </ConfigField>
          ))}
        </div>
      </section>
    </>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Toggle, SectionHeader, ConfigField } from "./config-form-controls";
import type { Config, TlsConfig, PprofConfig, ClaudeHeaderDefaults, AmpcodeConfig } from "./config-types";

interface AdvancedSettingsProps {
  config: Config;
  updateTlsConfig: (key: keyof TlsConfig, value: string | boolean) => void;
  updatePprofConfig: (key: keyof PprofConfig, value: string | boolean) => void;
  updateClaudeHeaderDefaults: (key: keyof ClaudeHeaderDefaults, value: string) => void;
  updateAmpcodeConfig: (key: keyof AmpcodeConfig, value: string | boolean | unknown) => void;
  updateConfig: <K extends keyof Config>(key: K, value: Config[K]) => void;
}

export function TlsSection({ config, updateTlsConfig }: Pick<AdvancedSettingsProps, "config" | "updateTlsConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="TLS / HTTPS" />
      <div className="rounded-sm border border-slate-600/40 bg-slate-800/30 p-3 text-xs text-slate-400">
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
  );
}

export function KiroSection({ config, updateConfig }: Pick<AdvancedSettingsProps, "config" | "updateConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Kiro" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigField label="Preferred Endpoint" description="Preferred Kiro API endpoint URL">
          <Input type="text" name="kiro-preferred-endpoint" value={config["kiro-preferred-endpoint"] ?? ""} onChange={(value) => updateConfig("kiro-preferred-endpoint", value)} placeholder="https://..." className="font-mono" />
        </ConfigField>
      </div>
    </section>
  );
}

export function ClaudeHeadersSection({ config, updateClaudeHeaderDefaults }: Pick<AdvancedSettingsProps, "config" | "updateClaudeHeaderDefaults">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Claude Header Defaults" />
      <p className="text-xs text-slate-500">Custom headers sent with all Claude API requests</p>
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
  );
}

export function AmpcodeSection({ config, updateAmpcodeConfig }: Pick<AdvancedSettingsProps, "config" | "updateAmpcodeConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Amp Code" />
      <p className="text-xs text-slate-500">Configuration for Amp Code upstream integration</p>
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
  );
}

export function PprofSection({ config, updatePprofConfig }: Pick<AdvancedSettingsProps, "config" | "updatePprofConfig">) {
  return (
    <section className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <SectionHeader title="Profiling (pprof)" />
      <div className="rounded-sm border border-slate-600/40 bg-slate-800/30 p-3 text-xs text-slate-400">
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
  );
}

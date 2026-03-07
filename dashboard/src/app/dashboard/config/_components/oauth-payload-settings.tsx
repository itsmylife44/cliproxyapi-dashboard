"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeader, ConfigField } from "./config-form-controls";
import type { Config, OAuthModelAliasEntry, PayloadConfig } from "./config-types";

interface OAuthAliasProps {
  config: Config;
  updateOAuthAliasEntry: (provider: string, index: number, field: keyof OAuthModelAliasEntry, value: string | boolean) => void;
  addOAuthAliasEntry: (provider: string) => void;
  removeOAuthAliasEntry: (provider: string, index: number) => void;
}

export function OAuthAliasesSection({ config, updateOAuthAliasEntry, addOAuthAliasEntry, removeOAuthAliasEntry }: OAuthAliasProps) {
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const toggleProviderExpanded = (provider: string) => {
    setExpandedProviders((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  return (
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
  );
}

interface PayloadSectionProps {
  config: Config;
  updatePayloadConfig: (key: keyof PayloadConfig, value: unknown) => void;
}

export function PayloadSection({ config, updatePayloadConfig }: PayloadSectionProps) {
  return (
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
              className="h-28 w-full rounded-sm border border-slate-700/70 bg-slate-900/40 p-3 font-mono text-xs text-slate-200 focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors resize-y"
            />
          </ConfigField>
        ))}
      </div>
    </section>
  );
}

interface RawJsonSectionProps {
  rawJson: string;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
}

export function RawJsonSection({ rawJson, showAdvanced, setShowAdvanced }: RawJsonSectionProps) {
  return (
    <section className="space-y-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-4">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <SectionHeader title="Advanced: Raw JSON Editor" />
        <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs">
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
  );
}

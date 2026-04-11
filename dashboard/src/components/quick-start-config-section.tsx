"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ModelSelector } from "@/components/model-selector";
import { OpenCodeConfigGenerator, type OmoVariant } from "@/components/opencode-config-generator";
import { OhMyOpenCodeConfigGenerator } from "@/components/oh-my-opencode-config-generator";
import { OhMyOpenCodeSlimConfigGenerator } from "@/components/oh-my-opencode-slim-config-generator";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";

interface OAuthAccountEntry {
  id: string;
  name: string;
  type?: string;
  provider?: string;
  disabled?: boolean;
}

interface ConfigData {
  "gemini-api-key"?: unknown;
  "claude-api-key"?: unknown;
  "codex-api-key"?: unknown;
  "openai-compatibility"?: unknown;
  "oauth-model-alias"?: unknown;
}

interface ModelDefinitionLike {
  name: string;
  context: number;
  output: number;
  attachment: boolean;
  reasoning: boolean;
  modalities: { input: string[]; output: string[] };
  options?: Record<string, unknown>;
}

interface QuickStartConfigSectionProps {
   apiKeys: { key: string; name: string | null }[];
   config: unknown;
   oauthAccounts: OAuthAccountEntry[];
   availableModels: string[];
   allModels: Record<string, ModelDefinitionLike>;
   modelSourceMap: Map<string, string>;
   modelProvidersMap?: Map<string, string[]>;
   initialExcludedModels: string[];
   agentOverrides?: OhMyOpenCodeFullConfig;
   slimOverrides?: OhMyOpenCodeSlimFullConfig;
   hasSyncActive: boolean;
   isSubscribed?: boolean;
   proxyUrl: string;
 }

export function QuickStartConfigSection({
   apiKeys,
   config,
   oauthAccounts,
   availableModels,
   allModels,
   modelSourceMap,
   initialExcludedModels,
   agentOverrides,
   slimOverrides,
   modelProvidersMap,
   hasSyncActive,
   isSubscribed = false,
   proxyUrl,
 }: QuickStartConfigSectionProps) {
  const [excludedModels, setExcludedModels] = useState<string[]>(initialExcludedModels);
  const [omoVariant, setOmoVariant] = useState<OmoVariant>("normal");

  return (
    <>
      {availableModels.length > 0 && (
        <section id="model-selection" className="scroll-mt-24">
          <ModelSelector
            availableModels={availableModels}
            modelSourceMap={modelSourceMap}
            modelProvidersMap={modelProvidersMap}
            initialExcludedModels={initialExcludedModels}
            onSelectionChange={setExcludedModels}
            isLocked={isSubscribed}
          />
        </section>
      )}

      <section id="generate-config" className="scroll-mt-24">
        <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-3">
             <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)] text-sm text-[var(--text-secondary)]" aria-hidden="true">&#9654;</span>
               Using with OpenCode
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {hasSyncActive ? (
                <span>Config auto-syncs via <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs text-blue-600">opencode-cliproxyapi-sync@latest</code> plugin.</span>
              ) : (
                <span>Place at <code className="break-all rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs text-amber-700">~/.config/opencode/opencode.json</code> or project root.</span>
              )}
            </p>

            {omoVariant === "slim" && (
              <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-red-600 shrink-0">First-time setup:</span>
                  <code className="text-xs font-mono select-all truncate text-red-600">
                    bunx oh-my-opencode-slim@latest install --no-tui --skills=no
                  </code>
                  <span className="text-[10px] text-red-600/70 shrink-0">(run once)</span>
                </div>
                <p className="text-[10px] text-red-600/50">
                  Registers agents and hooks in OpenCode. Use <code className="text-red-600/60">--skills=yes</code> to also install recommended skills (simplify, cartography).
                </p>
              </div>
            )}

            <OpenCodeConfigGenerator
               apiKeys={apiKeys}
               config={config as ConfigData | null}
               oauthAccounts={oauthAccounts}
               models={allModels as Record<string, import("@/lib/config-generators/opencode").ModelDefinition>}
               excludedModels={excludedModels}
               proxyUrl={proxyUrl}
               onVariantChange={setOmoVariant}
              />

            <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
              <p className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)]">•</span>
                <span>Add providers via <Link href="/dashboard/providers" className="font-medium text-blue-600 underline decoration-blue-400/30 underline-offset-2 hover:text-blue-800">Providers</Link></span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)]">•</span>
                <span>Set default model: <code className="break-all rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs text-amber-700">cliproxyapi/model-name</code></span>
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Auto-sync: Get token in <Link href="/dashboard/settings" className="font-medium text-blue-600 underline decoration-blue-400/30 underline-offset-2 hover:text-blue-800">Settings</Link>, install <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs text-blue-600">opencode-cliproxyapi-sync@latest</code>
              </p>
            </div>
           </div>
         </CardContent>
       </Card>
      </section>

      {omoVariant === "normal" && (
        <>
          <section id="assignments" className="scroll-mt-24">
            <details className="group rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]" open={false}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)] text-sm text-[var(--text-secondary)]" aria-hidden="true">&#9654;</span>
                  Advanced Config: Oh-My-Open-Agent Assignments
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-180">&#8964;</span>
              </summary>
              <div className="border-t border-[var(--surface-border)] px-4 py-3">
                <OhMyOpenCodeConfigGenerator
                  apiKeys={apiKeys}
                  config={config as ConfigData | null}
                  oauthAccounts={oauthAccounts}
                  proxyModelIds={availableModels}
                  excludedModels={excludedModels}
                  agentOverrides={agentOverrides}
                  modelSourceMap={modelSourceMap}
                />
              </div>
            </details>
          </section>
        </>
      )}

      {omoVariant === "slim" && (
        <>
          <section id="assignments-slim" className="scroll-mt-24">
            <details className="group rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]" open={false}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)] text-sm text-[var(--text-secondary)]" aria-hidden="true">&#9654;</span>
                  Advanced Config: Oh-My-OpenCode Slim Assignments
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-180">&#8964;</span>
              </summary>
              <div className="border-t border-[var(--surface-border)] px-4 py-3">
                <OhMyOpenCodeSlimConfigGenerator
                  apiKeys={apiKeys}
                  config={config as ConfigData | null}
                  oauthAccounts={oauthAccounts}
                  proxyModelIds={availableModels}
                  excludedModels={excludedModels}
                  slimOverrides={slimOverrides}
                  modelSourceMap={modelSourceMap}
                />
              </div>
            </details>
          </section>
        </>
      )}
    </>
  );
}

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
             <span className="flex h-6 w-6 items-center justify-center rounded-md border border-orange-400/30 bg-orange-500/15 text-sm text-orange-300" aria-hidden="true">&#9654;</span>
               Using with OpenCode
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              {hasSyncActive ? (
                <span>Config auto-syncs via <code className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-blue-200">opencode-cliproxyapi-sync@latest</code> plugin.</span>
              ) : (
                <span>Place at <code className="break-all rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-orange-200">~/.config/opencode/opencode.json</code> or project root.</span>
              )}
            </p>

            <div className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-red-300 shrink-0">First-time setup:</span>
                <code className="text-xs font-mono select-all truncate text-red-200">
                  {omoVariant === "slim"
                    ? "bunx oh-my-opencode-slim@latest install --no-tui --skills=no"
                    : "bunx oh-my-opencode@latest install --no-tui --skills=no"}
                </code>
                <span className="text-[10px] text-red-400/70 shrink-0">(run once)</span>
              </div>
              <p className="text-[10px] text-red-300/50">
                Registers agents and hooks in OpenCode. Use <code className="text-red-200/60">--skills=yes</code> to also install recommended skills (simplify, cartography).
              </p>
            </div>

            <OpenCodeConfigGenerator
               apiKeys={apiKeys}
               config={config as ConfigData | null}
               oauthAccounts={oauthAccounts}
               models={allModels as Record<string, import("@/lib/config-generators/opencode").ModelDefinition>}
               excludedModels={excludedModels}
               proxyUrl={proxyUrl}
               onVariantChange={setOmoVariant}
              />

            <div className="space-y-1.5 text-sm text-slate-300">
              <p className="flex items-start gap-2">
                <span className="text-orange-300">•</span>
                <span>Add providers via <Link href="/dashboard/providers" className="font-medium text-blue-300 underline decoration-blue-400/30 underline-offset-2 hover:text-blue-200">Providers</Link></span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-orange-300">•</span>
                <span>Set default model: <code className="break-all rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-orange-200">cliproxyapi/model-name</code></span>
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-slate-700/80 bg-slate-900/40 p-3">
              <p className="text-sm text-slate-300">
                Auto-sync: Get token in <Link href="/dashboard/settings" className="font-medium text-blue-300 underline decoration-blue-400/30 underline-offset-2 hover:text-blue-200">Settings</Link>, install <code className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-blue-200">opencode-cliproxyapi-sync@latest</code>
              </p>
            </div>
           </div>
         </CardContent>
       </Card>
      </section>

      {omoVariant === "normal" && (
        <>
          <section id="assignments" className="scroll-mt-24">
            <details className="group rounded-lg border border-slate-700/70 bg-slate-900/40" open={false}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 text-sm font-semibold text-slate-100">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-fuchsia-400/30 bg-fuchsia-500/15 text-sm text-fuchsia-300" aria-hidden="true">&#9654;</span>
                  Advanced Config: Oh-My-OpenCode Assignments
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400 transition-transform duration-200 group-open:rotate-180">&#8964;</span>
              </summary>
              <div className="border-t border-slate-700/70 px-4 py-3">
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
            <details className="group rounded-lg border border-slate-700/70 bg-slate-900/40" open={false}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 text-sm font-semibold text-slate-100">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-teal-400/30 bg-teal-500/15 text-sm text-teal-300" aria-hidden="true">&#9654;</span>
                  Advanced Config: Oh-My-OpenCode Slim Assignments
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400 transition-transform duration-200 group-open:rotate-180">&#8964;</span>
              </summary>
              <div className="border-t border-slate-700/70 px-4 py-3">
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

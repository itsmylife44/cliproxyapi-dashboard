"use client";

import { useState } from "react";
import { ModelSelector } from "@/components/model-selector";
import { ClientConfigGenerator } from "@/components/client-config-generator";
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
  isSubscribed = false,
  proxyUrl,
}: QuickStartConfigSectionProps) {
  const [excludedModels, setExcludedModels] = useState<string[]>(initialExcludedModels);

  return (
    <>
      {availableModels.length > 0 && (
        <div className="border-t border-[var(--surface-border)] pt-6">
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
        </div>
      )}

      <div className="border-t border-[var(--surface-border)] pt-6">
        <ClientConfigGenerator
          apiKeys={apiKeys}
          config={config as ConfigData | null}
          oauthAccounts={oauthAccounts}
          availableModels={availableModels}
          allModels={allModels as Record<string, import("@/lib/config-generators/opencode").ModelDefinition>}
          modelSourceMap={modelSourceMap}
          excludedModels={excludedModels}
          agentOverrides={agentOverrides}
          slimOverrides={slimOverrides}
          proxyUrl={proxyUrl}
        />
      </div>
    </>
  );
}

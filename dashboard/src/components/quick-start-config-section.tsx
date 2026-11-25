"use client";

import { useState } from "react";
import { ModelSelector } from "@/components/model-selector";
import { ClientConfigGenerator } from "@/components/client-config-generator";
import type { ModelDefinition } from "@/lib/config-generators/opencode";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";

interface QuickStartConfigSectionProps {
  apiKeys: { key: string; name: string | null }[];
  hasConfiguredProvider: boolean;
  availableModels: string[];
  allModels: Record<string, ModelDefinition>;
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
  hasConfiguredProvider,
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
          hasConfiguredProvider={hasConfiguredProvider}
          availableModels={availableModels}
          allModels={allModels}
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

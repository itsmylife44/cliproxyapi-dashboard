"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { OpenCodeConfigGenerator, type OmoVariant } from "@/components/opencode-config-generator";
import { OhMyOpenCodeConfigGenerator } from "@/components/oh-my-opencode-config-generator";
import { OhMyOpenCodeSlimConfigGenerator } from "@/components/oh-my-opencode-slim-config-generator";
import {
  CLIENT_HARNESSES,
  buildClientConfigFiles,
  downloadTextFile,
  type ClientHarnessId,
} from "@/lib/config-generators/client-configs";
import type { ConfigData, ModelDefinition, OAuthAccount } from "@/lib/config-generators/opencode";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";

interface ClientConfigGeneratorProps {
  apiKeys: { key: string; name: string | null }[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  availableModels: string[];
  allModels: Record<string, ModelDefinition>;
  modelSourceMap: Map<string, string>;
  excludedModels: string[];
  agentOverrides?: OhMyOpenCodeFullConfig;
  slimOverrides?: OhMyOpenCodeSlimFullConfig;
  proxyUrl: string;
}

export function ClientConfigGenerator({
  apiKeys,
  config,
  oauthAccounts,
  availableModels,
  allModels,
  modelSourceMap,
  excludedModels,
  agentOverrides,
  slimOverrides,
  proxyUrl,
}: ClientConfigGeneratorProps) {
  const t = useTranslations("quickStartConfig");
  const [harness, setHarness] = useState<ClientHarnessId>("opencode");
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
  const [omoVariant, setOmoVariant] = useState<OmoVariant>("normal");
  const [showAgentAssignments, setShowAgentAssignments] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const activeApiKey = apiKeys[selectedKeyIndex]?.key ?? apiKeys[0]?.key ?? "";
  const activeHarnessInfo = CLIENT_HARNESSES.find((h) => h.id === harness);

  const generatedFiles = useMemo(() => {
    if (harness === "opencode") return [];
    const excludedSet = new Set(excludedModels);
    const filteredModels = availableModels.filter((m) => !excludedSet.has(m));
    return buildClientConfigFiles({
      harness,
      proxyUrl,
      apiKey: activeApiKey,
      availableModels: filteredModels.length > 0 ? filteredModels : availableModels,
    });
  }, [harness, proxyUrl, activeApiKey, availableModels, excludedModels]);

  const handleCopy = async (key: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(key);
      window.setTimeout(() => setCopiedFile((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <section id="generate-config" className="scroll-mt-24 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {t("clientConfigTitle")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{activeHarnessInfo?.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {harness !== "opencode" && apiKeys.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="client-key-select" className="text-[11px] font-medium text-[var(--text-muted)]">
                API Key
              </label>
              <select
                id="client-key-select"
                value={selectedKeyIndex}
                onChange={(e) => setSelectedKeyIndex(Number(e.target.value))}
                className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:outline-none"
              >
                {apiKeys.map((entry, index) => (
                  <option key={entry.key} value={index}>
                    {entry.name || entry.key.slice(0, 12)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="client-harness-select" className="text-[11px] font-medium text-[var(--text-muted)]">
              {t("targetClientLabel")}
            </label>
            <select
              id="client-harness-select"
              value={harness}
              onChange={(e) => setHarness(e.target.value as ClientHarnessId)}
              className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:outline-none"
            >
              {CLIENT_HARNESSES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {harness === "opencode" ? (
        <div className="space-y-4">
          {omoVariant === "slim" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              <span className="font-semibold">{t("firstTimeSetup")}</span>
              <code className="select-all font-mono">bunx oh-my-opencode-slim@latest install --no-tui</code>
              <span className="opacity-75">{t("runOnce")}</span>
            </div>
          )}

          <OpenCodeConfigGenerator
            apiKeys={apiKeys}
            config={config}
            oauthAccounts={oauthAccounts}
            models={allModels}
            excludedModels={excludedModels}
            proxyUrl={proxyUrl}
            onVariantChange={setOmoVariant}
          />

          <div className="border-t border-[var(--surface-border)] pt-4">
            <button
              type="button"
              aria-expanded={showAgentAssignments}
              onClick={() => setShowAgentAssignments((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between py-1 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <span>
                {omoVariant === "slim" ? t("advancedConfigSlim") : t("advancedConfigNormal")}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className={`h-3.5 w-3.5 transition-transform duration-200 ${showAgentAssignments ? "rotate-180" : ""}`}
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showAgentAssignments && (
              <div className="mt-4">
                {omoVariant === "slim" ? (
                  <OhMyOpenCodeSlimConfigGenerator
                    apiKeys={apiKeys}
                    config={config}
                    oauthAccounts={oauthAccounts}
                    proxyModelIds={availableModels}
                    excludedModels={excludedModels}
                    slimOverrides={slimOverrides}
                    modelSourceMap={modelSourceMap}
                  />
                ) : (
                  <OhMyOpenCodeConfigGenerator
                    apiKeys={apiKeys}
                    config={config}
                    oauthAccounts={oauthAccounts}
                    proxyModelIds={availableModels}
                    excludedModels={excludedModels}
                    agentOverrides={agentOverrides}
                    modelSourceMap={modelSourceMap}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--surface-border)] border-t border-b border-[var(--surface-border)]">
          {generatedFiles.map((file) => {
            const fileKey = `${harness}:${file.targetPath}`;
            const isCopied = copiedFile === fileKey;
            return (
              <div key={fileKey} className="space-y-2.5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {file.filename}
                    </span>
                    <span className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                      {file.targetPath}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void handleCopy(fileKey, file.content)}
                      className="px-2.5 py-1 text-xs"
                    >
                      {isCopied ? t("copiedButton") : t("copyButton")}
                    </Button>
                    <Button
                      onClick={() => downloadTextFile(file.content, file.filename, file.mimeType)}
                      className="px-2.5 py-1 text-xs"
                    >
                      {t("downloadButton")}
                    </Button>
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-3 font-mono text-xs text-[var(--text-primary)]">
                  <code>{file.content}</code>
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

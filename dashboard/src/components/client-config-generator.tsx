"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
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
import type { ModelDefinition } from "@/lib/config-generators/opencode";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { OhMyOpenCodeSlimFullConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";

interface ClientConfigGeneratorProps {
  apiKeys: { key: string; name: string | null }[];
  hasConfiguredProvider: boolean;
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
  hasConfiguredProvider,
  availableModels,
  allModels,
  modelSourceMap,
  excludedModels,
  agentOverrides,
  slimOverrides,
  proxyUrl,
}: ClientConfigGeneratorProps) {
  const t = useTranslations("quickStartConfig");
  const tConfig = useTranslations("openCodeConfig");
  const tCommon = useTranslations("common");
  const { showToast } = useToast();
  const [harness, setHarness] = useState<ClientHarnessId>("opencode");
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
  const [omoVariant, setOmoVariant] = useState<OmoVariant>("normal");
  const [showAgentAssignments, setShowAgentAssignments] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const keyIndex = selectedKeyIndex < apiKeys.length ? selectedKeyIndex : 0;
  const activeApiKey = apiKeys[keyIndex]?.key;
  const selectedModels = useMemo(() => {
    const excluded = new Set(excludedModels);
    return availableModels.filter((model) => !excluded.has(model));
  }, [availableModels, excludedModels]);
  const generatedFiles = useMemo(() => {
    if (harness === "opencode" || !activeApiKey || !selectedModels.length) return [];
    return buildClientConfigFiles({ harness, proxyUrl, apiKey: activeApiKey, availableModels: selectedModels, models: allModels });
  }, [harness, proxyUrl, activeApiKey, selectedModels, allModels]);

  const handleCopy = async (key: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(key);
      window.setTimeout(() => setCopiedFile((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      showToast(t("copyFailed"), "error");
    }
  };

  const blocker = !hasConfiguredProvider
    ? { title: tConfig("noProvidersTitle"), link: "/dashboard/providers", action: tConfig("noProvidersLink") }
    : !activeApiKey
      ? { title: tConfig("apiKeyRequiredTitle"), link: "/dashboard/api-keys", action: tConfig("createApiKeyLink") }
      : selectedModels.length === 0
        ? { title: tConfig("noModelsTitle"), link: availableModels.length ? "#model-selection" : "/dashboard/providers", action: availableModels.length ? t("selectModels") : tConfig("noProvidersLink") }
        : null;

  return (
    <section id="generate-config" className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("clientConfigTitle")}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!blocker && apiKeys.length > 1 && (
            <select
              aria-label={tConfig("selectApiKeyLabel")}
              value={keyIndex}
              onChange={(e) => setSelectedKeyIndex(Number(e.target.value))}
              className="max-w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
            >
              {apiKeys.map((entry, index) => (
                <option key={index} value={index}>{entry.name || tConfig("unnamedKey")}</option>
              ))}
            </select>
          )}
          <div>
            <label htmlFor="client-harness-select" className="sr-only">{t("targetClientLabel")}</label>
            <select
              id="client-harness-select"
              value={harness}
              onChange={(e) => setHarness(e.target.value as ClientHarnessId)}
              className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
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

      {blocker ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--surface-border)] px-4 py-3">
          <p className="text-sm text-[var(--text-secondary)]">{blocker.title}</p>
          <Link href={blocker.link} className="text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">
            {blocker.action}
          </Link>
        </div>
      ) : harness === "opencode" && activeApiKey ? (
        <div className="space-y-4">
          {omoVariant === "slim" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              <span className="font-semibold">{t("firstTimeSetup")}</span>
              <code className="select-all font-mono">bunx oh-my-opencode-slim@latest install --no-tui</code>
            </div>
          )}

          <OpenCodeConfigGenerator
            apiKey={activeApiKey}
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
                    proxyModelIds={availableModels}
                    excludedModels={excludedModels}
                    slimOverrides={slimOverrides}
                    modelSourceMap={modelSourceMap}
                  />
                ) : (
                  <OhMyOpenCodeConfigGenerator
                    apiKeys={apiKeys}
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
                      {isCopied ? tCommon("copied") : tCommon("copy")}
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

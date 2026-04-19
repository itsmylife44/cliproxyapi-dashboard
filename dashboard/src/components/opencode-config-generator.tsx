"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { PluginSection } from "@/components/opencode/plugin-section";
import { McpSection } from "@/components/opencode/mcp-section";
import { ConfigPreview } from "@/components/opencode/config-preview";
import { extractApiError } from "@/lib/utils";
import { HelpTooltip } from "@/components/ui/tooltip";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import {
  type OAuthAccount,
  type ConfigData,
  type McpEntry,
  type ModelDefinition,
  generateConfigJson,
} from "@/lib/config-generators/opencode";

interface ApiKeyEntry {
  key: string;
  name: string | null;
}

export type OmoVariant = "normal" | "slim";

interface OpenCodeConfigGeneratorProps {
   apiKeys: ApiKeyEntry[];
   config: ConfigData | null;
   oauthAccounts: OAuthAccount[];
   models: Record<string, ModelDefinition>;
   excludedModels?: string[];
   proxyUrl: string;
   onVariantChange?: (variant: OmoVariant) => void;
 }

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const PLUGIN_OH_MY_OPENAGENT = "oh-my-openagent@latest";
const PLUGIN_OH_MY_OPENCODE_SLIM = "oh-my-opencode-slim@latest";

const DEFAULT_PLUGINS = [
  "opencode-cliproxyapi-sync@latest",
  PLUGIN_OH_MY_OPENAGENT,
];

export function OpenCodeConfigGenerator(props: OpenCodeConfigGeneratorProps) {
  const { apiKeys, config, oauthAccounts, models: allModels, excludedModels, proxyUrl, onVariantChange } = props;
   const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
   const [isExpanded, setIsExpanded] = useState(false);
   const [plugins, setPlugins] = useState<string[]>(DEFAULT_PLUGINS);
   const [pluginInput, setPluginInput] = useState("");
   const omoVariant: "normal" | "slim" = plugins.includes(PLUGIN_OH_MY_OPENCODE_SLIM) ? "slim" : "normal";
  const [mcps, setMcps] = useState<McpEntry[]>([]);
  const [mcpName, setMcpName] = useState("");
  const [mcpType, setMcpType] = useState<"local" | "remote">("local");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState("");
  const [envRows, setEnvRows] = useState<Array<{ id: number; key: string; value: string }>>([]);
  const envIdCounter = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<{ mcps: McpEntry[]; plugins: string[]; defaultModel: string } | null>(null);
  const t = useTranslations("openCodeConfig");

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch(API_ENDPOINTS.USER.CONFIG);
        if (!response.ok) {
          if (response.status === 401) {
            return;
          }
          return;
        }
        const data = await response.json();
        if (data.mcpServers && Array.isArray(data.mcpServers)) {
          setMcps(data.mcpServers);
        }
        if (data.customPlugins && Array.isArray(data.customPlugins) && data.customPlugins.length > 0) {
          const normalizedPlugins = data.customPlugins.map((p: string) =>
            p === "opencode-cliproxyapi-sync" ? "opencode-cliproxyapi-sync@latest" : p
          );
          setPlugins(normalizedPlugins);
          // Sync variant with parent based on loaded plugins
          const loadedVariant = normalizedPlugins.includes(PLUGIN_OH_MY_OPENCODE_SLIM) ? "slim" : "normal";
          onVariantChange?.(loadedVariant);
        } else {
          setPlugins(DEFAULT_PLUGINS);
          onVariantChange?.("normal");
        }
        if (typeof data.defaultModel === "string") {
          setDefaultModel(data.defaultModel);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [onVariantChange]);

  useEffect(() => {
    if (isLoading) return;

    pendingDataRef.current = { mcps, plugins, defaultModel };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      pendingDataRef.current = null;
      try {
        setSaveError(null);
        const response = await fetch(API_ENDPOINTS.USER.CONFIG, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mcpServers: mcps,
            customPlugins: plugins,
            defaultModel,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          setSaveError(extractApiError(errorData, t("errorSaveConfigFailed")));
        }
      } catch {
        setSaveError(t("networkError"));
      }
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mcps, plugins, defaultModel, isLoading, t]);

  useEffect(() => {
    return () => {
      if (pendingDataRef.current) {
        const { mcps: m, plugins: p, defaultModel: d } = pendingDataRef.current;
        fetch(API_ENDPOINTS.USER.CONFIG, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mcpServers: m, customPlugins: p, defaultModel: d }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  const availableModels = excludedModels
    ? Object.fromEntries(
        Object.entries(allModels).filter(([id]) => !excludedModels.includes(id))
      )
    : allModels;
  const hasModels = Object.keys(availableModels).length > 0;
  const hasKeys = apiKeys.length > 0;
  const hasActiveOAuth = oauthAccounts.some((a) => !a.disabled);
  const providerKeys = [
    "gemini-api-key",
    "claude-api-key",
    "codex-api-key",
    "vertex-api-key",
    "openai-compatibility",
  ] as const;
  const hasConfiguredProviderKey = providerKeys.some((key) => {
    const value = (config as Record<string, unknown> | null)?.[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
  const hasAnyProviderConfigured = hasConfiguredProviderKey || hasActiveOAuth;

  const selectedEntry = hasKeys
    ? apiKeys[selectedKeyIndex] ?? apiKeys[0]
    : null;
  const activeKey = selectedEntry?.key ?? "your-api-key-from-dashboard";
  const availableModelOptions = Object.keys(availableModels).map((modelId) => ({
    id: modelId,
    value: `cliproxyapi/${modelId}`,
    label: availableModels[modelId]?.name ?? modelId,
  }));
  const fallbackModel = availableModelOptions[0]?.value ?? "cliproxyapi/gemini-2.5-flash";
  const hasCustomDefaultModel = Boolean(defaultModel.trim())
    && !availableModelOptions.some((option) => option.value === defaultModel.trim());
  const resolvedDefaultModel = defaultModel.trim() || fallbackModel;

   const configJson = generateConfigJson(activeKey, availableModels, proxyUrl, {
      plugins,
      mcps,
      defaultModel: resolvedDefaultModel,
    });

  const handleOmoVariantChange = (variant: OmoVariant) => {
    const removePlugin = variant === "slim" ? PLUGIN_OH_MY_OPENAGENT : PLUGIN_OH_MY_OPENCODE_SLIM;
    const addPlugin = variant === "slim" ? PLUGIN_OH_MY_OPENCODE_SLIM : PLUGIN_OH_MY_OPENAGENT;
    const filtered = plugins.filter((p) => p !== removePlugin && p !== addPlugin);
    const insertIdx = Math.min(1, filtered.length);
    const newPlugins = [...filtered.slice(0, insertIdx), addPlugin, ...filtered.slice(insertIdx)];
    setPlugins(newPlugins);
    onVariantChange?.(variant);
  };

  const handleAddPlugin = () => {
    const trimmed = pluginInput.trim();
    if (trimmed && !plugins.includes(trimmed)) {
      setPlugins([...plugins, trimmed]);
      setPluginInput("");
    }
  };

  const handleRemovePlugin = (plugin: string) => {
    setPlugins(plugins.filter((p) => p !== plugin));
  };

  const handleAddMcp = () => {
    const trimmedName = mcpName.trim();
    if (!trimmedName || mcps.some((m) => m.name === trimmedName)) {
      return;
    }

    const environment = envRows.reduce<Record<string, string>>((acc, row) => {
      const key = row.key.trim();
      if (key) acc[key] = row.value;
      return acc;
    }, {});
    const envSpread = Object.keys(environment).length > 0 ? { environment } : {};

    if (mcpType === "remote") {
      const trimmedUrl = mcpUrl.trim();
      if (!trimmedUrl) return;
      setMcps([...mcps, {
        name: trimmedName,
        type: "remote",
        url: trimmedUrl,
        enabled: true,
        ...envSpread,
      }]);
      setMcpUrl("");
    } else {
      const trimmedCommand = mcpCommand.trim();
      if (!trimmedCommand) return;
      setMcps([...mcps, {
        name: trimmedName,
        type: "local",
        command: trimmedCommand.split(/\s+/),
        enabled: true,
        ...envSpread,
      }]);
      setMcpCommand("");
    }

    setMcpName("");
    setEnvRows([]);
  };

  const handleRemoveMcp = (name: string) => {
    setMcps(mcps.filter((m) => m.name !== name));
  };

  const handleToggleMcpEnabled = (name: string) => {
    setMcps(mcps.map((m) =>
      m.name === name
        ? { ...m, enabled: m.enabled === false ? true : false }
        : m
    ));
  };

  const handleAddEnvRow = () => {
    envIdCounter.current += 1;
    setEnvRows([...envRows, { id: envIdCounter.current, key: "", value: "" }]);
  };

  const handleUpdateEnvRow = (index: number, field: "key" | "value", value: string) => {
    const newRows = [...envRows];
    const row = newRows[index];
    if (!row) return;
    row[field] = value;
    setEnvRows(newRows);
  };

  const handleRemoveEnvRow = (index: number) => {
    setEnvRows(envRows.filter((_, i) => i !== index));
  };

  const handleDownload = () => {
    downloadFile(configJson, "opencode.json");
  };

  if (!hasAnyProviderConfigured) {
    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-300 bg-amber-500/10 p-4 text-sm rounded-r-xl">
          <p className="text-[var(--text-primary)] font-medium mb-1">{t("noProvidersTitle")}</p>
          <p className="text-[var(--text-muted)] text-xs">
            {t("noProvidersDesc")}{" "}
            <Link href="/dashboard/providers" className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] underline underline-offset-2 decoration-[#ccc]">
              {t("noProvidersLink")}
            </Link>{" "}
            {t("noProvidersDescMid")}{" "}
            <Link href="/dashboard/providers" className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] underline underline-offset-2 decoration-[#ccc]">
              {t("noProvidersLink")}
            </Link>.
          </p>
        </div>
      </div>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <div className="space-y-3">
        <div className="border-l-4 border-amber-300 bg-amber-500/10 p-4 rounded-r-xl">
          <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t("apiKeyRequiredTitle")}</div>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("apiKeyRequiredDesc")}
          </p>
          <Link
            href="/dashboard/api-keys"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
          >
            {t("createApiKeyLink")}
          </Link>
        </div>
      </div>
    );
  }

  if (!hasModels) {
    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-300 bg-amber-500/10 p-4 text-sm rounded-r-xl">
          <p className="text-[var(--text-primary)] font-medium mb-1">{t("noModelsTitle")}</p>
          <p className="text-[var(--text-muted)] text-xs">
            {t("noModelsDesc")}{" "}
            <Link href="/dashboard/providers" className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] underline underline-offset-2 decoration-[#ccc]">
              {t("noModelsLink")}
            </Link>{" "}
            {t("noModelsDescSuffix")}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="h-5 w-5 rounded-full border-2 border-[var(--surface-border)] border-t-black animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">{t("loadingConfig")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {saveError && (
        <div className="border-l-4 border-red-300 bg-red-500/10 p-3 text-sm rounded-r-xl">
          <p className="text-red-600 text-xs">{saveError}</p>
        </div>
      )}
      {hasKeys ? (
        apiKeys.length > 1 ? (
          <div className="space-y-2">
            <label htmlFor="api-key-select" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {t("selectApiKeyLabel")}
            </label>
            <select
              id="api-key-select"
              value={selectedKeyIndex}
              onChange={(e) => setSelectedKeyIndex(Number(e.target.value))}
              className="w-full bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] font-mono focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
            >
              {apiKeys.map((apiKey, index) => (
                <option key={apiKey.key} value={index} className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                  {apiKey.name || t("unnamedKey")}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            <span>
              {t("usingApiKeyPrefix")} <strong className="text-[var(--text-secondary)]">{selectedEntry?.name || t("unnamedKey")}</strong>
            </span>
          </div>
        )
      ) : hasActiveOAuth ? (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <span>
            {t("oauthConnected")} <code className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-amber-700 font-mono">your-api-key-from-dashboard</code>
          </span>
        </div>
      ) : (
        <div className="border-l-4 border-amber-300 bg-amber-500/10 p-4 text-sm rounded-r-xl">
          <p className="text-[var(--text-primary)] font-medium mb-1">{t("noApiKeysTitle")}</p>
          <p className="text-[var(--text-muted)] text-xs">
            {t("noApiKeysDesc")}{" "}
            <Link href="/dashboard/api-keys" className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] underline underline-offset-2 decoration-[#ccc]">
              {t("noApiKeysApiKeysLink")}
            </Link>{" "}
            {t("noApiKeysDescMid")}{" "}
            <Link href="/dashboard/providers" className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] underline underline-offset-2 decoration-[#ccc]">
              {t("noApiKeysProvidersLink")}
            </Link>{" "}
            {t("noApiKeysDescSuffix")}
          </p>
        </div>
       )}

        <div className="space-y-4 border-t border-[var(--surface-border)] pt-4">
          <div className="space-y-2">
            <label htmlFor="default-model-select" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {t("defaultModelLabel")} <HelpTooltip content={t("defaultModelTooltip")} />
            </label>
            <select
              id="default-model-select"
              value={hasCustomDefaultModel ? defaultModel.trim() : (defaultModel.trim() || "")}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] font-mono focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-all"
            >
              <option value="" className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                {t("autoFallback", { model: fallbackModel })}
              </option>
              {hasCustomDefaultModel ? (
                <option value={defaultModel.trim()} className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                  {t("customSavedValue", { model: defaultModel.trim() })}
                </option>
              ) : null}
              {availableModelOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--text-muted)]">
              {t("defaultModelHint")} <span className="font-mono text-[var(--text-muted)]">{fallbackModel}</span>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t("variantLabel")} <HelpTooltip content={t("variantTooltip")} /></p>
           <div className="flex gap-2">
             <button
               type="button"
               onClick={() => handleOmoVariantChange("normal")}
               className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                 omoVariant === "normal"
                   ? "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-primary)]"
                   : "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--surface-border)]"
               }`}
             >
                <div className="font-semibold">{t("variantNormalTitle")}</div>
               <div className="mt-0.5 text-[10px] opacity-70">{t("variantNormalSubtitle")}</div>
             </button>
             <button
               type="button"
               onClick={() => handleOmoVariantChange("slim")}
               className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                 omoVariant === "slim"
                   ? "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-primary)]"
                   : "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--surface-border)]"
               }`}
             >
                <div className="font-semibold">{t("variantSlimTitle")}</div>
               <div className="mt-0.5 text-[10px] opacity-70">{t("variantSlimSubtitle")}</div>
             </button>
           </div>
         </div>

         <PluginSection
           plugins={plugins}
           pluginInput={pluginInput}
           onPluginInputChange={setPluginInput}
           onAddPlugin={handleAddPlugin}
           onRemovePlugin={handleRemovePlugin}
         />

         <McpSection
           mcps={mcps}
           mcpName={mcpName}
           mcpType={mcpType}
           mcpCommand={mcpCommand}
           mcpUrl={mcpUrl}
           envRows={envRows}
           onMcpNameChange={setMcpName}
           onMcpTypeChange={setMcpType}
           onMcpCommandChange={setMcpCommand}
           onMcpUrlChange={setMcpUrl}
           onAddMcp={handleAddMcp}
           onRemoveMcp={handleRemoveMcp}
           onToggleMcpEnabled={handleToggleMcpEnabled}
           onAddEnvRow={handleAddEnvRow}
           onUpdateEnvRow={handleUpdateEnvRow}
           onRemoveEnvRow={handleRemoveEnvRow}
         />
       </div>

      <ConfigPreview
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        configJson={configJson}
        onDownload={handleDownload}
        downloadFilename="opencode.json"
      />
    </div>
  );
}

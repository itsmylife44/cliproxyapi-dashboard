"use client";

import { useState, useEffect, useRef } from "react";
import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";
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

interface OpenCodeConfigGeneratorProps {
   apiKeys: ApiKeyEntry[];
   config: ConfigData | null;
   oauthAccounts: OAuthAccount[];
   models: Record<string, ModelDefinition>;
   excludedModels?: string[];
   proxyUrl: string;
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

const DEFAULT_PLUGINS = [
  "opencode-cliproxyapi-sync@latest",
  "oh-my-opencode@latest",
  "opencode-anthropic-auth@latest",
];

export function OpenCodeConfigGenerator(props: OpenCodeConfigGeneratorProps) {
  const { apiKeys, config, oauthAccounts, models: allModels, excludedModels, proxyUrl } = props;
   const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
   const [isExpanded, setIsExpanded] = useState(false);
   const [isModelsExpanded, setIsModelsExpanded] = useState(false);
   const [plugins, setPlugins] = useState<string[]>(DEFAULT_PLUGINS);
   const [pluginInput, setPluginInput] = useState("");
  const [mcps, setMcps] = useState<McpEntry[]>([]);
  const [mcpName, setMcpName] = useState("");
  const [mcpType, setMcpType] = useState<"local" | "remote">("local");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [envRows, setEnvRows] = useState<Array<{ key: string; value: string }>>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<{ mcps: McpEntry[]; plugins: string[] } | null>(null);

  // Load persisted config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/user/config");
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
        } else {
          setPlugins(DEFAULT_PLUGINS);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Auto-save config changes with debounce
  useEffect(() => {
    if (isLoading) return;

    pendingDataRef.current = { mcps, plugins };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      pendingDataRef.current = null;
      try {
        setSaveError(null);
        const response = await fetch("/api/user/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mcpServers: mcps,
            customPlugins: plugins,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          setSaveError(errorData.error || "Failed to save config");
        }
      } catch {
        setSaveError("Network error while saving config");
      }
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mcps, plugins, isLoading]);

  // Flush pending save on unmount to prevent data loss
  useEffect(() => {
    return () => {
      if (pendingDataRef.current) {
        const { mcps: m, plugins: p } = pendingDataRef.current;
        fetch("/api/user/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mcpServers: m, customPlugins: p }),
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

   const configJson = generateConfigJson(activeKey, availableModels, proxyUrl, {
     plugins,
     mcps,
   });

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

    if (mcpType === "remote") {
      const trimmedUrl = mcpUrl.trim();
      if (!trimmedUrl) return;
      const environment = envRows.reduce((acc, row) => {
        const key = row.key.trim();
        if (key) acc[key] = row.value;
        return acc;
      }, {} as Record<string, string>);
      setMcps([...mcps, { 
        name: trimmedName, 
        type: "remote", 
        url: trimmedUrl,
        enabled: true,
        ...(Object.keys(environment).length > 0 ? { environment } : {})
      }]);
      setMcpName("");
      setMcpUrl("");
      setEnvRows([]);
    } else {
      const trimmedCommand = mcpCommand.trim();
      if (!trimmedCommand) return;
      const commandArray = trimmedCommand.split(/\s+/);
      const environment = envRows.reduce((acc, row) => {
        const key = row.key.trim();
        if (key) acc[key] = row.value;
        return acc;
      }, {} as Record<string, string>);
      setMcps([
        ...mcps,
        {
          name: trimmedName,
          type: "local",
          command: commandArray,
          enabled: true,
          ...(Object.keys(environment).length > 0 ? { environment } : {})
        },
      ]);
      setMcpName("");
      setMcpCommand("");
      setEnvRows([]);
    }
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
    setEnvRows([...envRows, { key: "", value: "" }]);
  };

  const handleUpdateEnvRow = (index: number, field: "key" | "value", value: string) => {
    const newRows = [...envRows];
    newRows[index][field] = value;
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
        <div className="border-l-4 border-amber-400/60 bg-amber-500/10 backdrop-blur-xl p-4 text-sm rounded-r-xl">
          <p className="text-white/90 font-medium mb-1">No providers configured</p>
          <p className="text-white/60 text-xs">
            You need to configure at least one AI provider before generating an OpenCode config.
            Head to the{" "}
            <a href="/dashboard/providers" className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30">
              Providers
            </a>{" "}
            page to add Gemini, Claude, Codex, or OpenAI Compatible keys, or set up{" "}
            <a href="/dashboard/providers" className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30">
              Providers
            </a>.
          </p>
        </div>
      </div>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <div className="space-y-3">
        <div className="border-l-4 border-amber-400/60 backdrop-blur-xl bg-amber-500/10 p-4 rounded-r-xl">
          <div className="text-sm font-medium text-white mb-1">API Key Required</div>
          <p className="text-sm text-white/70">
            Create an API key to generate your configuration.
          </p>
          <a
            href="/dashboard/api-keys"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors"
          >
            Create API Key →
          </a>
        </div>
      </div>
    );
  }

  if (!hasModels) {
    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-400/60 bg-amber-500/10 backdrop-blur-xl p-4 text-sm rounded-r-xl">
          <p className="text-white/90 font-medium mb-1">No models available yet</p>
          <p className="text-white/60 text-xs">
            Providers are configured, but no models were discovered yet. If you just added providers,
            wait a moment and refresh. If the issue persists, verify provider credentials on the{" "}
            <a href="/dashboard/providers" className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30">
              Providers
            </a>{" "}
            page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-purple-400 animate-spin" />
          <span className="text-sm text-white/60">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {saveError && (
        <div className="border-l-4 border-red-400/60 bg-red-500/10 backdrop-blur-xl p-3 text-sm rounded-r-xl">
          <p className="text-red-300 text-xs">{saveError}</p>
        </div>
      )}
      {hasKeys ? (
        apiKeys.length > 1 ? (
          <div className="space-y-2">
            <label htmlFor="api-key-select" className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Select API Key
            </label>
            <select
              id="api-key-select"
              value={selectedKeyIndex}
              onChange={(e) => setSelectedKeyIndex(Number(e.target.value))}
              className="w-full backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white/90 font-mono focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
            >
              {apiKeys.map((apiKey, index) => (
                <option key={apiKey.key} value={index} className="bg-[#1a1a2e] text-white">
                  {apiKey.name || "Unnamed Key"}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            <span>
              Using API key: <strong className="text-white/70">{apiKeys[0].name || "Unnamed Key"}</strong>
            </span>
          </div>
        )
      ) : hasActiveOAuth ? (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <span>
            OAuth providers connected — using placeholder key <code className="px-1.5 py-0.5 rounded bg-white/10 text-orange-300 font-mono">your-api-key-from-dashboard</code>
          </span>
        </div>
      ) : (
        <div className="border-l-4 border-amber-400/60 bg-amber-500/10 backdrop-blur-xl p-4 text-sm rounded-r-xl">
          <p className="text-white/90 font-medium mb-1">No API keys found</p>
          <p className="text-white/60 text-xs">
            Create an API key on the{" "}
            <a href="/dashboard/api-keys" className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30">
              API Keys
            </a>{" "}
            page or connect an OAuth provider on the{" "}
            <a href="/dashboard/providers" className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30">
              Providers
            </a>{" "}
            page. The config below uses a placeholder.
          </p>
        </div>
       )}

       <div className="space-y-2">
         <button
           type="button"
           onClick={() => setIsModelsExpanded(!isModelsExpanded)}
           className="flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
         >
           <svg
             width="12"
             height="12"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             strokeWidth="2"
             strokeLinecap="round"
             strokeLinejoin="round"
             className={`transition-transform duration-200 ${isModelsExpanded ? "rotate-90" : ""}`}
             aria-hidden="true"
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           {isModelsExpanded ? "Hide" : "Show"} available models ({Object.keys(availableModels).length})
         </button>

         {isModelsExpanded && (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
             {Object.keys(availableModels).map((id) => (
               <span
                 key={id}
                 className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 font-mono truncate"
                 title={id}
               >
                 {id}
               </span>
             ))}
           </div>
         )}
       </div>

       <div className="space-y-4 border-t border-white/10 pt-4">
         <div className="space-y-2">
           <label htmlFor="plugin-input" className="text-xs font-medium text-white/50 uppercase tracking-wider">
             Plugins
           </label>
           <div className="flex gap-2">
             <input
               id="plugin-input"
               type="text"
               value={pluginInput}
               onChange={(e) => setPluginInput(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && handleAddPlugin()}
               placeholder="plugin-name@version"
               className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
             />
             <button
               type="button"
               onClick={handleAddPlugin}
               className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 hover:border-purple-400/50 transition-all"
             >
               Add
             </button>
           </div>
           <div className="flex flex-wrap gap-1.5">
             {plugins.map((plugin) => (
               <span
                 key={plugin}
                 className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-400/20 text-xs text-purple-300 font-mono"
               >
                 {plugin}
                 <button
                   type="button"
                   onClick={() => handleRemovePlugin(plugin)}
                   className="hover:text-red-400 transition-colors"
                   aria-label={`Remove ${plugin}`}
                 >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                     <title>Remove</title>
                     <line x1="18" y1="6" x2="6" y2="18" />
                     <line x1="6" y1="6" x2="18" y2="18" />
                   </svg>
                 </button>
               </span>
             ))}
           </div>
         </div>

          <div className="space-y-2">
            <label htmlFor="mcp-name-input" className="text-xs font-medium text-white/50 uppercase tracking-wider">
              MCP Servers
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  id="mcp-name-input"
                  type="text"
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value)}
                  placeholder="server-name"
                  className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                />
                <select
                  value={mcpType}
                  onChange={(e) => setMcpType(e.target.value as "local" | "remote")}
                  className="backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                >
                  <option value="local" className="bg-[#1a1a2e] text-white">Local</option>
                  <option value="remote" className="bg-[#1a1a2e] text-white">Remote</option>
                </select>
              </div>
              {mcpType === "remote" ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMcp()}
                    placeholder="https://mcp.example.com/mcp"
                    className="w-full backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={mcpCommand}
                    onChange={(e) => setMcpCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMcp()}
                    placeholder="npx -y @modelcontextprotocol/server-everything"
                    className="w-full backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                  />
                </div>
              )}
              
              {/* Environment Variables Editor */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    Environment Variables
                  </label>
                  <button
                    type="button"
                    onClick={handleAddEnvRow}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Env Var
                  </button>
                </div>
                
                {envRows.length > 0 && (
                  <div className="space-y-2">
                    {envRows.map((row, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => handleUpdateEnvRow(index, "key", e.target.value)}
                          placeholder="KEY"
                          className="w-1/3 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                        />
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => handleUpdateEnvRow(index, "value", e.target.value)}
                          placeholder="Value"
                          className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEnvRow(index)}
                          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleAddMcp}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 hover:border-blue-400/50 transition-all"
                  >
                    Add MCP Server
                  </button>
                </div>
              </div>
            </div>
            {mcps.length > 0 && (
              <div className="space-y-1.5">
                {mcps.map((mcp) => {
                  const isEnabled = mcp.enabled !== false;
                  const envCount = mcp.environment ? Object.keys(mcp.environment).length : 0;
                  return (
                    <div
                      key={mcp.name}
                      className={`flex items-start justify-between px-3 py-3 rounded-lg border transition-all ${
                        isEnabled
                          ? "bg-blue-500/10 border-blue-400/20"
                          : "bg-white/5 border-white/10 opacity-60"
                      }`}
                    >
                      <div className="flex-1 space-y-2 overflow-hidden mr-4">
                        <div className="flex items-center gap-2 text-sm font-mono">
                          <span className={isEnabled ? "text-blue-300" : "text-white/50"}>{mcp.name}</span>
                          <span className="text-white/30">→</span>
                          {mcp.type === "remote" ? (
                            <>
                              <span className={isEnabled ? "text-purple-400 text-xs" : "text-white/40 text-xs"}>Remote</span>
                              <span className="text-white/60 text-xs truncate" title={mcp.url}>{mcp.url}</span>
                            </>
                          ) : (
                            <>
                              <span className={isEnabled ? "text-emerald-400 text-xs" : "text-white/40 text-xs"}>Local</span>
                              <div className="flex flex-wrap gap-1">
                                {mcp.command.map((cmd, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-white/5 rounded text-white/70 text-[10px] whitespace-nowrap">
                                    {cmd}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        {envCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                              {envCount} Env Var{envCount !== 1 ? "s" : ""}
                            </span>
                            <div className="flex gap-1 overflow-x-auto pb-1">
                              {Object.entries(mcp.environment!).map(([k, v]) => (
                                <span key={k} className="text-[10px] font-mono text-white/40 whitespace-nowrap" title={`${k}=${v}`}>
                                  <span className="text-white/60">{k}</span>={v}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleMcpEnabled(mcp.name)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                          }`}
                          aria-label={`Toggle ${mcp.name}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                              isEnabled ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMcp(mcp.name)}
                          className="text-white/40 hover:text-red-400 transition-colors"
                          aria-label={`Remove ${mcp.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <title>Remove</title>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      <button
         type="button"
         onClick={() => setIsExpanded(!isExpanded)}
         className="flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
       >
         <svg
           width="12"
           height="12"
           viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           strokeWidth="2"
           strokeLinecap="round"
           strokeLinejoin="round"
           className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
           aria-hidden="true"
         >
           <polyline points="9 18 15 12 9 6" />
         </svg>
         {isExpanded ? "Hide config" : "Show config"}
       </button>

       {isExpanded && (
         <div className="space-y-4">
           <CopyBlock code={configJson} />

           <div className="flex gap-3">
             <Button onClick={handleDownload} variant="secondary" className="flex items-center gap-2">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                 <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                 <polyline points="7 10 12 15 17 10" />
                 <line x1="12" y1="15" x2="12" y2="3" />
               </svg>
               Download opencode.json
             </Button>
           </div>
         </div>
       )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";
import {
  type OAuthAccount,
  type ConfigData,
  type ModelsDevData,
  type McpEntry,
  buildAvailableModels,
  generateConfigJson,
} from "@/lib/config-generators/opencode";

interface OpenCodeConfigGeneratorProps {
  apiKeys: string[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  modelsDevData: ModelsDevData | null;
  excludedModels?: string[];
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

export function OpenCodeConfigGenerator({ apiKeys, config, oauthAccounts, modelsDevData, excludedModels }: OpenCodeConfigGeneratorProps) {
   const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
   const [isExpanded, setIsExpanded] = useState(false);
   const [isModelsExpanded, setIsModelsExpanded] = useState(false);
   const [plugins, setPlugins] = useState<string[]>(DEFAULT_PLUGINS);
   const [pluginInput, setPluginInput] = useState("");
  const [mcps, setMcps] = useState<McpEntry[]>([]);
  const [mcpName, setMcpName] = useState("");
  const [mcpType, setMcpType] = useState<"stdio" | "http">("stdio");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpArgs, setMcpArgs] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/user/config");
        if (!response.ok) {
          if (response.status !== 401) {
            console.error("Failed to load config:", response.status);
          }
          return;
        }
        const data = await response.json();
        if (data.mcpServers && Array.isArray(data.mcpServers)) {
          setMcps(data.mcpServers);
        }
        if (data.customPlugins && Array.isArray(data.customPlugins)) {
          setPlugins(data.customPlugins);
        }
      } catch (error) {
        console.error("Failed to load config:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Auto-save config changes with debounce
  useEffect(() => {
    if (isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
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
      } catch (error) {
        setSaveError("Network error while saving config");
        console.error("Failed to save config:", error);
      }
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mcps, plugins, isLoading]);

  const allModels = buildAvailableModels(config, oauthAccounts, modelsDevData);
  const availableModels = excludedModels
    ? Object.fromEntries(
        Object.entries(allModels).filter(([id]) => !excludedModels.includes(id))
      )
    : allModels;
  const hasModels = Object.keys(availableModels).length > 0;
  const hasKeys = apiKeys.length > 0;
  const hasActiveOAuth = oauthAccounts.some((a) => !a.disabled);

  const activeKey = hasKeys
    ? apiKeys[selectedKeyIndex] ?? apiKeys[0]
    : "your-api-key-from-dashboard";

  const configJson = generateConfigJson(activeKey, availableModels, {
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

    if (mcpType === "http") {
      const trimmedUrl = mcpUrl.trim();
      if (!trimmedUrl) return;
      setMcps([...mcps, { name: trimmedName, type: "http", url: trimmedUrl }]);
      setMcpName("");
      setMcpUrl("");
    } else {
      const trimmedCommand = mcpCommand.trim();
      if (!trimmedCommand) return;
      const argsArray = mcpArgs.trim() ? mcpArgs.trim().split(/\s+/) : undefined;
      setMcps([
        ...mcps,
        {
          name: trimmedName,
          type: "stdio",
          command: trimmedCommand,
          ...(argsArray && { args: argsArray }),
        },
      ]);
      setMcpName("");
      setMcpCommand("");
      setMcpArgs("");
    }
  };

  const handleRemoveMcp = (name: string) => {
    setMcps(mcps.filter((m) => m.name !== name));
  };

  const handleDownload = () => {
    downloadFile(configJson, "opencode.json");
  };

  if (!hasModels) {
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
              {apiKeys.map((key, index) => (
                <option key={key} value={index} className="bg-[#1a1a2e] text-white">
                  {key.length > 20 ? `${key.slice(0, 8)}...${key.slice(-4)}` : key}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            <span>
              Using API key: <code className="px-1.5 py-0.5 rounded bg-white/10 text-orange-300 font-mono">{apiKeys[0].slice(0, 8)}...{apiKeys[0].slice(-4)}</code>
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
                  onChange={(e) => setMcpType(e.target.value as "stdio" | "http")}
                  className="backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                >
                  <option value="stdio" className="bg-[#1a1a2e] text-white">STDIO</option>
                  <option value="http" className="bg-[#1a1a2e] text-white">HTTP</option>
                </select>
              </div>
              {mcpType === "http" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMcp()}
                    placeholder="http://127.0.0.1:13337/mcp"
                    className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddMcp}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 hover:border-blue-400/50 transition-all"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mcpCommand}
                    onChange={(e) => setMcpCommand(e.target.value)}
                    placeholder="command (e.g., python)"
                    className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                  />
                  <input
                    type="text"
                    value={mcpArgs}
                    onChange={(e) => setMcpArgs(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMcp()}
                    placeholder="args (optional, space-separated)"
                    className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 font-mono placeholder:text-white/30 focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddMcp}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 hover:border-blue-400/50 transition-all"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
            {mcps.length > 0 && (
              <div className="space-y-1.5">
                {mcps.map((mcp) => (
                  <div
                    key={mcp.name}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-400/20"
                  >
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-blue-300">{mcp.name}</span>
                      <span className="text-white/30">→</span>
                      {mcp.type === "http" ? (
                        <>
                          <span className="text-purple-400">HTTP</span>
                          <span className="text-white/60">{mcp.url}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-emerald-400">STDIO</span>
                          <span className="text-white/60">{mcp.command}</span>
                          {mcp.args && mcp.args.length > 0 && (
                            <>
                              <span className="text-white/30">+</span>
                              <span className="text-white/50">{mcp.args.join(" ")}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
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
                ))}
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

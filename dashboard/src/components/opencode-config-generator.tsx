"use client";

import { useState } from "react";
import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";
import {
  type OAuthAccount,
  type ConfigData,
  type ModelsDevData,
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

export function OpenCodeConfigGenerator({ apiKeys, config, oauthAccounts, modelsDevData, excludedModels }: OpenCodeConfigGeneratorProps) {
   const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
   const [isExpanded, setIsExpanded] = useState(false);

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

  const configJson = generateConfigJson(activeKey, availableModels);

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

  return (
    <div className="space-y-4">
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

       <div className="flex flex-wrap gap-1.5">
         {Object.keys(availableModels).map((id) => (
           <span
             key={id}
             className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 font-mono"
           >
             {id}
           </span>
         ))}
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

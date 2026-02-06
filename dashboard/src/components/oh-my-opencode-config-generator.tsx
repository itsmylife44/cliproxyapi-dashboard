"use client";

import { useState } from "react";
import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";
import {
  type OAuthAccount,
  type ConfigData,
  type ModelsDevData,
  type ModelMeta,
  AGENT_ROLES,
  CATEGORY_ROLES,
  buildAvailableModelIds,
  buildOhMyOpenCodeConfig,
  enrichTierForRole,
  formatContextWindow,
  getModelMeta,
  pickBestModel,
} from "@/lib/config-generators/oh-my-opencode";

interface OhMyOpenCodeConfigGeneratorProps {
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

export function OhMyOpenCodeConfigGenerator({
   config,
   oauthAccounts,
   modelsDevData,
   excludedModels,
 }: OhMyOpenCodeConfigGeneratorProps) {
   const [isExpanded, setIsExpanded] = useState(false);
   const allModelIds = buildAvailableModelIds(config, oauthAccounts, modelsDevData);
   const availableModelIds = excludedModels
     ? allModelIds.filter((id) => !excludedModels.includes(id))
     : allModelIds;
  const hasModels = availableModelIds.length > 0;

  const ohMyConfig = hasModels ? buildOhMyOpenCodeConfig(availableModelIds, modelsDevData) : null;
  const configJson = ohMyConfig ? JSON.stringify(ohMyConfig, null, 2) : "";

  const handleDownload = () => {
    if (configJson) {
      downloadFile(configJson, "oh-my-opencode.json");
    }
  };

  if (!hasModels || !ohMyConfig) {
    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-400/60 bg-amber-500/10 backdrop-blur-xl p-4 text-sm rounded-r-xl">
          <p className="text-white/90 font-medium mb-1">No providers configured</p>
          <p className="text-white/60 text-xs">
            You need to configure at least one AI provider before generating an Oh My OpenCode config.
            Head to the{" "}
            <a
              href="/dashboard/providers"
              className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30"
            >
              Providers
            </a>{" "}
            page to add Gemini, Claude, Codex, or OpenAI Compatible keys, or set up OAuth providers.
          </p>
        </div>
      </div>
    );
  }

  const agentAssignments: { name: string; model: string; meta: ModelMeta | null }[] = [];
  for (const [agent, role] of Object.entries(AGENT_ROLES)) {
    const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
    const model = pickBestModel(availableModelIds, enrichedTier);
    if (model) {
      agentAssignments.push({ name: agent, model, meta: getModelMeta(model, modelsDevData) });
    }
  }

  const categoryAssignments: { name: string; model: string; meta: ModelMeta | null }[] = [];
  for (const [category, role] of Object.entries(CATEGORY_ROLES)) {
    const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
    const model = pickBestModel(availableModelIds, enrichedTier);
    if (model) {
      categoryAssignments.push({ name: category, model, meta: getModelMeta(model, modelsDevData) });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Optimal agent and category model assignments based on your configured providers.
        Place this file at{" "}
        <code className="px-1.5 py-0.5 rounded bg-white/10 text-pink-300 text-xs font-mono break-all">
          ~/.config/opencode/oh-my-opencode.json
        </code>
      </p>

      {agentAssignments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Agent Assignments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {agentAssignments.map(({ name, model, meta }) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 font-mono"
              >
                <span className="text-pink-300">{name}</span>
                <span className="text-white/30">&rarr;</span>
                <span>{model}</span>
                {meta?.reasoning && (
                  <span className="px-1 py-0.5 rounded bg-violet-500/15 text-violet-300/80 text-[10px] leading-none font-sans font-medium">
                    reasoning
                  </span>
                )}
                {meta?.context && (
                  <span className="text-white/30 text-[10px] font-sans">
                    {formatContextWindow(meta.context)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

       {categoryAssignments.length > 0 && (
         <div className="space-y-1.5">
           <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
             Category Assignments
           </p>
           <div className="flex flex-wrap gap-1.5">
             {categoryAssignments.map(({ name, model, meta }) => (
               <span
                 key={name}
                 className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 font-mono"
               >
                 <span className="text-pink-300">{name}</span>
                 <span className="text-white/30">&rarr;</span>
                 <span>{model}</span>
                 {meta?.reasoning && (
                   <span className="px-1 py-0.5 rounded bg-violet-500/15 text-violet-300/80 text-[10px] leading-none font-sans font-medium">
                     reasoning
                   </span>
                 )}
                 {meta?.context && (
                   <span className="text-white/30 text-[10px] font-sans">
                     {formatContextWindow(meta.context)}
                   </span>
                 )}
               </span>
             ))}
           </div>
         </div>
       )}

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
               <svg
                 width="16"
                 height="16"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="2"
                 strokeLinecap="round"
                 strokeLinejoin="round"
                 aria-hidden="true"
               >
                 <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                 <polyline points="7 10 12 15 17 10" />
                 <line x1="12" y1="15" x2="12" y2="3" />
               </svg>
               Download oh-my-opencode.json
             </Button>
           </div>
         </div>
       )}
    </div>
  );
}

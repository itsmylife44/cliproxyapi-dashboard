"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
import {
  type OhMyOpenCodeFullConfig,
  type TmuxConfig,
  type BackgroundTaskConfig,
  type SisyphusAgentConfig,
  type GitMasterConfig,
  type BrowserAutomationConfig,
  type HookGroupName,
  AVAILABLE_AGENTS,
  AVAILABLE_SKILLS,
  AVAILABLE_COMMANDS,
  HOOK_GROUPS,
  TMUX_LAYOUTS,
  BROWSER_PROVIDERS,
} from "@/lib/config-generators/oh-my-opencode-types";

interface OhMyOpenCodeConfigGeneratorProps {
  apiKeys: string[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  modelsDevData: ModelsDevData | null;
  excludedModels?: string[];
  agentOverrides?: OhMyOpenCodeFullConfig;
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

function ModelBadge({
  name,
  model,
  meta,
  isOverride,
  availableModels,
  modelsDevData,
  onSelect,
}: {
  name: string;
  model: string;
  meta: ModelMeta | null;
  isOverride: boolean;
  availableModels: string[];
  modelsDevData: ModelsDevData | null;
  onSelect: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setPos({
        top: openUp ? rect.top - dropdownHeight : rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 296),
        openUp,
      });
    }
    setOpen(!open);
    setSearch("");
  };

  const filtered = search
    ? availableModels.filter((m) => m.toLowerCase().includes(search.toLowerCase()))
    : availableModels;

  return (
    <div className="inline-block" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono cursor-pointer transition-all hover:bg-white/10 ${
          isOverride
            ? "bg-violet-500/10 border border-violet-400/20 text-white/80"
            : "bg-white/5 border border-white/10 text-white/70"
        }`}
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
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-72 max-h-64 overflow-hidden rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-2xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="p-2 border-b border-white/10">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/40"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            <button
              type="button"
              onClick={() => { onSelect(undefined); setOpen(false); setSearch(""); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors hover:bg-white/10 ${
                !isOverride ? "text-violet-300 bg-violet-500/10" : "text-white/60"
              }`}
            >
              Auto (default)
            </button>
            {filtered.map((m) => {
              const mMeta = getModelMeta(m, modelsDevData);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onSelect(m); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors hover:bg-white/10 flex items-center gap-1.5 ${
                    isOverride && model === m ? "text-violet-300 bg-violet-500/10" : "text-white/70"
                  }`}
                >
                  <span className="flex-1">{m}</span>
                  {mMeta?.reasoning && (
                    <span className="px-1 py-0.5 rounded bg-violet-500/15 text-violet-300/80 text-[9px] leading-none font-sans shrink-0">
                      reasoning
                    </span>
                  )}
                  {mMeta?.context && (
                    <span className="text-white/30 text-[9px] font-sans shrink-0">
                      {formatContextWindow(mMeta.context)}
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/30">No models found</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function OhMyOpenCodeConfigGenerator({
   config,
   oauthAccounts,
   modelsDevData,
   excludedModels,
   agentOverrides: initialOverrides,
 }: OhMyOpenCodeConfigGeneratorProps) {
   const [isExpanded, setIsExpanded] = useState(false);
   const [overrides, setOverrides] = useState<OhMyOpenCodeFullConfig>(initialOverrides ?? { agents: {}, categories: {} });
   const [saving, setSaving] = useState(false);
   const { showToast } = useToast();

   const [showAgents, setShowAgents] = useState(false);
   const [showSkills, setShowSkills] = useState(false);
   const [showCommands, setShowCommands] = useState(false);
   const [showHooks, setShowHooks] = useState(false);
   const [expandedHookGroups, setExpandedHookGroups] = useState<Set<HookGroupName>>(new Set());
   const [showTmux, setShowTmux] = useState(false);
   const [showBgTask, setShowBgTask] = useState(false);
   const [showSisyphus, setShowSisyphus] = useState(false);
   const [showGitMaster, setShowGitMaster] = useState(false);
   const [showBrowser, setShowBrowser] = useState(false);
   const [showMcps, setShowMcps] = useState(false);
   const [mcpInput, setMcpInput] = useState("");
   const [providerConcurrencyRows, setProviderConcurrencyRows] = useState<Array<{ key: string; value: number }>>([]);
   const [modelConcurrencyRows, setModelConcurrencyRows] = useState<Array<{ key: string; value: number }>>([]);
   const tmuxDebounceRef = useRef<NodeJS.Timeout | null>(null);

   const allModelIds = buildAvailableModelIds(config, oauthAccounts, modelsDevData);
   const availableModelIds = excludedModels
     ? allModelIds.filter((id) => !excludedModels.includes(id))
     : allModelIds;
  const hasModels = availableModelIds.length > 0;

  const ohMyConfig = hasModels ? buildOhMyOpenCodeConfig(availableModelIds, modelsDevData, overrides) : null;
  const configJson = ohMyConfig ? JSON.stringify(ohMyConfig, null, 2) : "";

   useEffect(() => {
     if (initialOverrides?.background_task?.providerConcurrency) {
       const entries = Object.entries(initialOverrides.background_task.providerConcurrency);
       setProviderConcurrencyRows(entries.map(([key, value]) => ({ key, value })));
     }
     if (initialOverrides?.background_task?.modelConcurrency) {
       const entries = Object.entries(initialOverrides.background_task.modelConcurrency);
       setModelConcurrencyRows(entries.map(([key, value]) => ({ key, value })));
     }
   }, [initialOverrides]);

   const saveOverrides = useCallback(async (newOverrides: OhMyOpenCodeFullConfig) => {
     setSaving(true);
     try {
       const res = await fetch("/api/agent-config", {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ overrides: newOverrides }),
       });
       if (!res.ok) {
         showToast("Failed to save", "error");
         return;
       }
       showToast("Assignment saved", "success");
     } catch {
       showToast("Network error", "error");
     } finally {
       setSaving(false);
     }
   }, [showToast]);

  const handleAgentChange = (agent: string, value: string | undefined) => {
    const newAgents = { ...overrides.agents };
    if (value === undefined) {
      delete newAgents[agent];
    } else {
      newAgents[agent] = value;
    }
    const newOverrides = { ...overrides, agents: newAgents };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleCategoryChange = (category: string, value: string | undefined) => {
    const newCategories = { ...overrides.categories };
    if (value === undefined) {
      delete newCategories[category];
    } else {
      newCategories[category] = value;
    }
    const newOverrides = { ...overrides, categories: newCategories };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

   const handleDownload = () => {
     if (configJson) {
       downloadFile(configJson, "oh-my-opencode.json");
     }
   };

   const handleDisabledAgentToggle = (agent: string) => {
     const current = overrides.disabled_agents ?? [];
     const newDisabled = current.includes(agent)
       ? current.filter((a) => a !== agent)
       : [...current, agent];
     const newOverrides = { ...overrides, disabled_agents: newDisabled.length > 0 ? newDisabled : undefined };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleDisabledSkillToggle = (skill: string) => {
     const current = overrides.disabled_skills ?? [];
     const newDisabled = current.includes(skill)
       ? current.filter((s) => s !== skill)
       : [...current, skill];
     const newOverrides = { ...overrides, disabled_skills: newDisabled.length > 0 ? newDisabled : undefined };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleDisabledCommandToggle = (command: string) => {
     const current = overrides.disabled_commands ?? [];
     const newDisabled = current.includes(command)
       ? current.filter((c) => c !== command)
       : [...current, command];
     const newOverrides = { ...overrides, disabled_commands: newDisabled.length > 0 ? newDisabled : undefined };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleDisabledHookToggle = (hook: string) => {
     const current = overrides.disabled_hooks ?? [];
     const newDisabled = current.includes(hook)
       ? current.filter((h) => h !== hook)
       : [...current, hook];
     const newOverrides = { ...overrides, disabled_hooks: newDisabled.length > 0 ? newDisabled : undefined };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleTmuxEnabledToggle = () => {
     const currentTmux = overrides.tmux ?? {};
     const newEnabled = !currentTmux.enabled;
     const newTmux = newEnabled ? { ...currentTmux, enabled: true } : undefined;
     const newOverrides = { ...overrides, tmux: newTmux };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleTmuxLayoutChange = (layout: string) => {
     const currentTmux = overrides.tmux ?? { enabled: true };
     const newTmux = { ...currentTmux, layout };
     const newOverrides = { ...overrides, tmux: newTmux };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleTmuxNumberChange = (field: keyof TmuxConfig, value: number) => {
     if (tmuxDebounceRef.current) clearTimeout(tmuxDebounceRef.current);
     tmuxDebounceRef.current = setTimeout(() => {
       const currentTmux = overrides.tmux ?? { enabled: true };
       const newTmux = { ...currentTmux, [field]: value };
       const newOverrides = { ...overrides, tmux: newTmux };
       setOverrides(newOverrides);
       saveOverrides(newOverrides);
     }, 500);
   };

   const handleBgTaskNumberChange = (field: keyof BackgroundTaskConfig, value: number) => {
     const currentBg = overrides.background_task ?? {};
     const newBg = { ...currentBg, [field]: value };
     const newOverrides = { ...overrides, background_task: newBg };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleProviderConcurrencyChange = (index: number, field: "key" | "value", newValue: string | number) => {
     const newRows = [...providerConcurrencyRows];
     if (field === "key") {
       newRows[index].key = newValue as string;
     } else {
       newRows[index].value = newValue as number;
     }
     setProviderConcurrencyRows(newRows);
     const providerConcurrency = Object.fromEntries(newRows.map((row) => [row.key, row.value]));
     const newBg = { ...overrides.background_task, providerConcurrency };
     const newOverrides = { ...overrides, background_task: newBg };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleProviderConcurrencyAdd = () => {
     setProviderConcurrencyRows([...providerConcurrencyRows, { key: "", value: 1 }]);
   };

   const handleProviderConcurrencyRemove = (index: number) => {
     const newRows = providerConcurrencyRows.filter((_, i) => i !== index);
     setProviderConcurrencyRows(newRows);
     const providerConcurrency = Object.fromEntries(newRows.map((row) => [row.key, row.value]));
     const newBg = { ...overrides.background_task, providerConcurrency };
     const newOverrides = { ...overrides, background_task: newBg };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleModelConcurrencyChange = (index: number, field: "key" | "value", newValue: string | number) => {
     const newRows = [...modelConcurrencyRows];
     if (field === "key") {
       newRows[index].key = newValue as string;
     } else {
       newRows[index].value = newValue as number;
     }
     setModelConcurrencyRows(newRows);
     const modelConcurrency = Object.fromEntries(newRows.map((row) => [row.key, row.value]));
     const newBg = { ...overrides.background_task, modelConcurrency };
     const newOverrides = { ...overrides, background_task: newBg };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleModelConcurrencyAdd = () => {
     setModelConcurrencyRows([...modelConcurrencyRows, { key: "", value: 1 }]);
   };

   const handleModelConcurrencyRemove = (index: number) => {
     const newRows = modelConcurrencyRows.filter((_, i) => i !== index);
     setModelConcurrencyRows(newRows);
     const modelConcurrency = Object.fromEntries(newRows.map((row) => [row.key, row.value]));
     const newBg = { ...overrides.background_task, modelConcurrency };
     const newOverrides = { ...overrides, background_task: newBg };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleSisyphusToggle = (field: keyof SisyphusAgentConfig) => {
     const currentSisyphus = overrides.sisyphus_agent ?? {};
     const newSisyphus = { ...currentSisyphus, [field]: !currentSisyphus[field] };
     const newOverrides = { ...overrides, sisyphus_agent: newSisyphus };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleGitMasterToggle = (field: keyof GitMasterConfig) => {
     const currentGit = overrides.git_master ?? {};
     const newGit = { ...currentGit, [field]: !currentGit[field] };
     const newOverrides = { ...overrides, git_master: newGit };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleBrowserProviderChange = (provider: string) => {
     const newBrowser: BrowserAutomationConfig = { provider };
     const newOverrides = { ...overrides, browser_automation_engine: newBrowser };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const handleMcpAdd = () => {
     const trimmed = mcpInput.trim();
     if (!trimmed) return;
     const current = overrides.disabled_mcps ?? [];
     if (current.includes(trimmed)) {
       setMcpInput("");
       return;
     }
     const newDisabled = [...current, trimmed];
     const newOverrides = { ...overrides, disabled_mcps: newDisabled };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
     setMcpInput("");
   };

   const handleMcpRemove = (mcp: string) => {
     const current = overrides.disabled_mcps ?? [];
     const newDisabled = current.filter((m) => m !== mcp);
     const newOverrides = { ...overrides, disabled_mcps: newDisabled.length > 0 ? newDisabled : undefined };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
   };

   const toggleHookGroup = (group: HookGroupName) => {
     const newExpanded = new Set(expandedHookGroups);
     if (newExpanded.has(group)) {
       newExpanded.delete(group);
     } else {
       newExpanded.add(group);
     }
     setExpandedHookGroups(newExpanded);
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

  const agentAssignments: { name: string; model: string; meta: ModelMeta | null; isOverride: boolean }[] = [];
  for (const [agent, role] of Object.entries(AGENT_ROLES)) {
    const overrideModel = overrides?.agents?.[agent];
    if (overrideModel && availableModelIds.includes(overrideModel)) {
      agentAssignments.push({ name: agent, model: overrideModel, meta: getModelMeta(overrideModel, modelsDevData), isOverride: true });
    } else {
      const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
      const model = pickBestModel(availableModelIds, enrichedTier);
      if (model) {
        agentAssignments.push({ name: agent, model, meta: getModelMeta(model, modelsDevData), isOverride: false });
      }
    }
  }

  const categoryAssignments: { name: string; model: string; meta: ModelMeta | null; isOverride: boolean }[] = [];
  for (const [category, role] of Object.entries(CATEGORY_ROLES)) {
    const overrideModel = overrides?.categories?.[category];
    if (overrideModel && availableModelIds.includes(overrideModel)) {
      categoryAssignments.push({ name: category, model: overrideModel, meta: getModelMeta(overrideModel, modelsDevData), isOverride: true });
    } else {
      const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
      const model = pickBestModel(availableModelIds, enrichedTier);
      if (model) {
        categoryAssignments.push({ name: category, model, meta: getModelMeta(model, modelsDevData), isOverride: false });
      }
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Click any assignment to change the model. Changes are saved automatically and sync via Config Sync.
        {saving && <span className="ml-2 text-amber-300/70 text-xs">Saving...</span>}
      </p>

      {agentAssignments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Agent Assignments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {agentAssignments.map(({ name, model, meta, isOverride }) => (
              <ModelBadge
                key={name}
                name={name}
                model={model}
                meta={meta}
                isOverride={isOverride}
                availableModels={availableModelIds}
                modelsDevData={modelsDevData}
                onSelect={(value) => handleAgentChange(name, value)}
              />
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
             {categoryAssignments.map(({ name, model, meta, isOverride }) => (
               <ModelBadge
                 key={name}
                 name={name}
                 model={model}
                 meta={meta}
                 isOverride={isOverride}
                 availableModels={availableModelIds}
                 modelsDevData={modelsDevData}
                 onSelect={(value) => handleCategoryChange(name, value)}
               />
             ))}
           </div>
         </div>
       )}

       <div className="border-t border-white/5 pt-4 space-y-3">
         <button
           type="button"
           onClick={() => setShowAgents(!showAgents)}
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
             className={`transition-transform duration-200 ${showAgents ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Agents ({(overrides.disabled_agents ?? []).length} disabled)
         </button>

         {showAgents && (
           <div className="space-y-1 pl-5">
             {AVAILABLE_AGENTS.map((agent) => {
               const isEnabled = !(overrides.disabled_agents ?? []).includes(agent);
               return (
                 <div key={agent} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                   <span className="text-xs text-white/70 font-mono">{agent}</span>
                   <button
                     type="button"
                     onClick={() => handleDisabledAgentToggle(agent)}
                     className={`w-9 h-5 rounded-full transition-colors relative ${
                       isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                     }`}
                   >
                     <span
                       className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                         isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                       }`}
                     />
                   </button>
                 </div>
               );
             })}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowSkills(!showSkills)}
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
             className={`transition-transform duration-200 ${showSkills ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Skills ({(overrides.disabled_skills ?? []).length} disabled)
         </button>

         {showSkills && (
           <div className="space-y-1 pl-5">
             {AVAILABLE_SKILLS.map((skill) => {
               const isEnabled = !(overrides.disabled_skills ?? []).includes(skill);
               return (
                 <div key={skill} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                   <span className="text-xs text-white/70 font-mono">{skill}</span>
                   <button
                     type="button"
                     onClick={() => handleDisabledSkillToggle(skill)}
                     className={`w-9 h-5 rounded-full transition-colors relative ${
                       isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                     }`}
                   >
                     <span
                       className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                         isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                       }`}
                     />
                   </button>
                 </div>
               );
             })}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowCommands(!showCommands)}
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
             className={`transition-transform duration-200 ${showCommands ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Commands ({(overrides.disabled_commands ?? []).length} disabled)
         </button>

         {showCommands && (
           <div className="space-y-1 pl-5">
             {AVAILABLE_COMMANDS.map((command) => {
               const isEnabled = !(overrides.disabled_commands ?? []).includes(command);
               return (
                 <div key={command} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                   <span className="text-xs text-white/70 font-mono">{command}</span>
                   <button
                     type="button"
                     onClick={() => handleDisabledCommandToggle(command)}
                     className={`w-9 h-5 rounded-full transition-colors relative ${
                       isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                     }`}
                   >
                     <span
                       className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                         isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                       }`}
                     />
                   </button>
                 </div>
               );
             })}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowHooks(!showHooks)}
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
             className={`transition-transform duration-200 ${showHooks ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Hooks ({(overrides.disabled_hooks ?? []).length} disabled)
         </button>

         {showHooks && (
           <div className="space-y-2 pl-5">
             {(Object.entries(HOOK_GROUPS) as [HookGroupName, readonly string[]][]).map(([groupName, hooks]) => {
               const disabledCount = hooks.filter((h) => (overrides.disabled_hooks ?? []).includes(h)).length;
               const isGroupExpanded = expandedHookGroups.has(groupName);
               return (
                 <div key={groupName}>
                   <button
                     type="button"
                     onClick={() => toggleHookGroup(groupName)}
                     className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
                   >
                     <svg
                       width="10"
                       height="10"
                       viewBox="0 0 24 24"
                       fill="none"
                       stroke="currentColor"
                       strokeWidth="2"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       className={`transition-transform duration-200 ${isGroupExpanded ? "rotate-90" : ""}`}
                     >
                       <polyline points="9 18 15 12 9 6" />
                     </svg>
                     {groupName} ({disabledCount}/{hooks.length} disabled)
                   </button>
                   {isGroupExpanded && (
                     <div className="space-y-1 pl-4 mt-1">
                       {hooks.map((hook) => {
                         const isEnabled = !(overrides.disabled_hooks ?? []).includes(hook);
                         return (
                           <div key={hook} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                             <span className="text-xs text-white/70 font-mono">{hook}</span>
                             <button
                               type="button"
                               onClick={() => handleDisabledHookToggle(hook)}
                               className={`w-9 h-5 rounded-full transition-colors relative ${
                                 isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                               }`}
                             >
                               <span
                                 className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                                   isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                                 }`}
                               />
                             </button>
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>
               );
             })}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowTmux(!showTmux)}
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
             className={`transition-transform duration-200 ${showTmux ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Tmux {overrides.tmux?.enabled && "(enabled)"}
         </button>

         {showTmux && (
           <div className="space-y-2 pl-5">
             <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
               <span className="text-xs text-white/70 font-mono">Enabled</span>
               <button
                 type="button"
                 onClick={handleTmuxEnabledToggle}
                 className={`w-9 h-5 rounded-full transition-colors relative ${
                   overrides.tmux?.enabled ? "bg-emerald-500/60" : "bg-white/10"
                 }`}
               >
                 <span
                   className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                     overrides.tmux?.enabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                   }`}
                 />
               </button>
             </div>
             {overrides.tmux?.enabled && (
               <>
                 <div className="space-y-1">
                   <label className="text-xs text-white/50">Layout</label>
                   <select
                     value={overrides.tmux.layout ?? "main-vertical"}
                     onChange={(e) => handleTmuxLayoutChange(e.target.value)}
                     className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   >
                     {TMUX_LAYOUTS.map((layout) => (
                       <option key={layout} value={layout}>
                         {layout}
                       </option>
                     ))}
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-white/50">Main Pane Size (20-80)</label>
                   <input
                     type="number"
                     min={20}
                     max={80}
                     defaultValue={overrides.tmux.main_pane_size ?? 60}
                     onChange={(e) => handleTmuxNumberChange("main_pane_size", Number(e.target.value))}
                     className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-white/50">Main Pane Min Width</label>
                   <input
                     type="number"
                     min={0}
                     defaultValue={overrides.tmux.main_pane_min_width ?? 120}
                     onChange={(e) => handleTmuxNumberChange("main_pane_min_width", Number(e.target.value))}
                     className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-white/50">Agent Pane Min Width</label>
                   <input
                     type="number"
                     min={0}
                     defaultValue={overrides.tmux.agent_pane_min_width ?? 40}
                     onChange={(e) => handleTmuxNumberChange("agent_pane_min_width", Number(e.target.value))}
                     className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                 </div>
               </>
             )}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowBgTask(!showBgTask)}
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
             className={`transition-transform duration-200 ${showBgTask ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Background Tasks
         </button>

         {showBgTask && (
           <div className="space-y-2 pl-5">
             <div className="space-y-1">
               <label className="text-xs text-white/50">Default Concurrency</label>
               <input
                 type="number"
                 min={1}
                 defaultValue={overrides.background_task?.defaultConcurrency ?? 5}
                 onChange={(e) => handleBgTaskNumberChange("defaultConcurrency", Number(e.target.value))}
                 className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
               />
             </div>
             <div className="space-y-1">
               <label className="text-xs text-white/50">Stale Timeout (ms)</label>
               <input
                 type="number"
                 min={60000}
                 defaultValue={overrides.background_task?.staleTimeoutMs ?? 180000}
                 onChange={(e) => handleBgTaskNumberChange("staleTimeoutMs", Number(e.target.value))}
                 className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
               />
             </div>
             <div className="space-y-1">
               <div className="flex items-center justify-between">
                 <label className="text-xs text-white/50">Provider Concurrency</label>
                 <button
                   type="button"
                   onClick={handleProviderConcurrencyAdd}
                   className="text-xs text-violet-400 hover:text-violet-300"
                 >
                   + Add
                 </button>
               </div>
               {providerConcurrencyRows.map((row, idx) => (
                 <div key={idx} className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Provider"
                     value={row.key}
                     onChange={(e) => handleProviderConcurrencyChange(idx, "key", e.target.value)}
                     className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                   <input
                     type="number"
                     min={1}
                     value={row.value}
                     onChange={(e) => handleProviderConcurrencyChange(idx, "value", Number(e.target.value))}
                     className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                   <button
                     type="button"
                     onClick={() => handleProviderConcurrencyRemove(idx)}
                     className="text-xs text-red-400 hover:text-red-300"
                   >
                     Remove
                   </button>
                 </div>
               ))}
             </div>
             <div className="space-y-1">
               <div className="flex items-center justify-between">
                 <label className="text-xs text-white/50">Model Concurrency</label>
                 <button
                   type="button"
                   onClick={handleModelConcurrencyAdd}
                   className="text-xs text-violet-400 hover:text-violet-300"
                 >
                   + Add
                 </button>
               </div>
               {modelConcurrencyRows.map((row, idx) => (
                 <div key={idx} className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Model"
                     value={row.key}
                     onChange={(e) => handleModelConcurrencyChange(idx, "key", e.target.value)}
                     className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                   <input
                     type="number"
                     min={1}
                     value={row.value}
                     onChange={(e) => handleModelConcurrencyChange(idx, "value", Number(e.target.value))}
                     className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                   />
                   <button
                     type="button"
                     onClick={() => handleModelConcurrencyRemove(idx)}
                     className="text-xs text-red-400 hover:text-red-300"
                   >
                     Remove
                   </button>
                 </div>
               ))}
             </div>
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowSisyphus(!showSisyphus)}
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
             className={`transition-transform duration-200 ${showSisyphus ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Sisyphus Agent
         </button>

         {showSisyphus && (
           <div className="space-y-1 pl-5">
             {[
               { field: "disabled" as const, label: "Disabled", defaultValue: false },
               { field: "default_builder_enabled" as const, label: "Default Builder Enabled", defaultValue: false },
               { field: "planner_enabled" as const, label: "Planner Enabled", defaultValue: true },
               { field: "replace_plan" as const, label: "Replace Plan", defaultValue: true },
             ].map(({ field, label, defaultValue }) => {
               const isEnabled = overrides.sisyphus_agent?.[field] ?? defaultValue;
               return (
                 <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                   <span className="text-xs text-white/70 font-mono">{label}</span>
                   <button
                     type="button"
                     onClick={() => handleSisyphusToggle(field)}
                     className={`w-9 h-5 rounded-full transition-colors relative ${
                       isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                     }`}
                   >
                     <span
                       className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                         isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                       }`}
                     />
                   </button>
                 </div>
               );
             })}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowGitMaster(!showGitMaster)}
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
             className={`transition-transform duration-200 ${showGitMaster ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Git Master
         </button>

         {showGitMaster && (
           <div className="space-y-1 pl-5">
             {[
               { field: "commit_footer" as const, label: "Commit Footer", defaultValue: false },
               { field: "include_co_authored_by" as const, label: "Include Co-Authored-By", defaultValue: false },
             ].map(({ field, label, defaultValue }) => {
               const isEnabled = overrides.git_master?.[field] ?? defaultValue;
               return (
                 <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                   <span className="text-xs text-white/70 font-mono">{label}</span>
                   <button
                     type="button"
                     onClick={() => handleGitMasterToggle(field)}
                     className={`w-9 h-5 rounded-full transition-colors relative ${
                       isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                     }`}
                   >
                     <span
                       className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                         isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                       }`}
                     />
                   </button>
                 </div>
               );
             })}
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowBrowser(!showBrowser)}
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
             className={`transition-transform duration-200 ${showBrowser ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Browser Automation
         </button>

         {showBrowser && (
           <div className="space-y-1 pl-5">
             <label className="text-xs text-white/50">Provider</label>
             <select
               value={overrides.browser_automation_engine?.provider ?? "playwright"}
               onChange={(e) => handleBrowserProviderChange(e.target.value)}
               className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
             >
               {BROWSER_PROVIDERS.map((provider) => (
                 <option key={provider} value={provider}>
                   {provider}
                 </option>
               ))}
             </select>
           </div>
         )}

         <button
           type="button"
           onClick={() => setShowMcps(!showMcps)}
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
             className={`transition-transform duration-200 ${showMcps ? "rotate-90" : ""}`}
           >
             <polyline points="9 18 15 12 9 6" />
           </svg>
           Disabled MCPs ({(overrides.disabled_mcps ?? []).length})
         </button>

         {showMcps && (
           <div className="space-y-2 pl-5">
             <div className="flex gap-2">
               <input
                 type="text"
                 placeholder="MCP name"
                 value={mcpInput}
                 onChange={(e) => setMcpInput(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") {
                     e.preventDefault();
                     handleMcpAdd();
                   }
                 }}
                 className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/40"
               />
               <button
                 type="button"
                 onClick={handleMcpAdd}
                 className="px-3 py-1.5 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30"
               >
                 Add
               </button>
             </div>
             <div className="flex flex-wrap gap-1.5">
               {(overrides.disabled_mcps ?? []).map((mcp) => (
                 <div
                   key={mcp}
                   className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-red-500/10 border border-red-400/20 text-red-300"
                 >
                   <span className="font-mono">{mcp}</span>
                   <button
                     type="button"
                     onClick={() => handleMcpRemove(mcp)}
                     className="text-red-400 hover:text-red-200"
                   >
                     ×
                   </button>
                 </div>
               ))}
             </div>
           </div>
         )}
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  type OAuthAccount,
  type ConfigData,
  AGENT_ROLES,
  CATEGORY_ROLES,
  buildOhMyOpenCodeConfig,
  pickBestModel,
} from "@/lib/config-generators/oh-my-opencode";
import {
  type OhMyOpenCodeFullConfig,
  type AgentConfigEntry,
  type CategoryConfigEntry,
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
  apiKeys: { key: string; name: string | null }[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  proxyModelIds?: string[];
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

interface ExtraFieldConfig {
  variant?: string;
  temperature?: number;
  thirdField?: string;
  thirdFieldKey: string;
  thirdFieldPlaceholder: string;
}

const PROVIDER_ORDER = [
  "Claude",
  "Gemini",
  "OpenAI/Codex",
  "OpenAI-Compatible",
  "Other",
] as const;

type ProviderName = (typeof PROVIDER_ORDER)[number];

interface ModelGroup {
  provider: ProviderName;
  models: string[];
}

const TIER_META: Record<1 | 2 | 3 | 4, { label: string; hint: string }> = {
  1: { label: "Tier 1", hint: "Critical reasoning" },
  2: { label: "Tier 2", hint: "Planning and review" },
  3: { label: "Tier 3", hint: "Fast execution" },
  4: { label: "Tier 4", hint: "Visual and creative" },
};

function detectProvider(modelId: string): ProviderName {
  const lower = modelId.toLowerCase();

  if (lower.startsWith("claude-")) return "Claude";
  if (lower.startsWith("gemini-")) return "Gemini";
  if (
    lower.startsWith("gpt-") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("o4") ||
    lower.includes("codex")
  ) {
    return "OpenAI/Codex";
  }
  if (
    lower.startsWith("openrouter/") ||
    lower.startsWith("groq/") ||
    lower.startsWith("xai/") ||
    lower.startsWith("deepseek/") ||
    lower.startsWith("anthropic/") ||
    lower.startsWith("google/")
  ) {
    return "OpenAI-Compatible";
  }

  return "Other";
}

function groupModelsByProvider(models: string[]): ModelGroup[] {
  const grouped = new Map<ProviderName, string[]>();

  for (const model of models) {
    const provider = detectProvider(model);
    const existing = grouped.get(provider) ?? [];
    existing.push(model);
    grouped.set(provider, existing);
  }

  for (const providerModels of grouped.values()) {
    providerModels.sort((a, b) => a.localeCompare(b));
  }

  return PROVIDER_ORDER.map((provider) => ({
    provider,
    models: grouped.get(provider) ?? [],
  })).filter((group) => group.models.length > 0);
}

function ModelBadge({
  name,
  model,
  isOverride,
  showName = true,
  availableModels,
  onSelect,
  extraFields,
  onFieldChange,
}: {
  name: string;
  model: string;
  isOverride: boolean;
  showName?: boolean;
  availableModels: string[];
  onSelect: (value: string | undefined) => void;
  extraFields?: ExtraFieldConfig;
  onFieldChange?: (field: string, value: string | number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasExtraValues = extraFields && (
    extraFields.variant || extraFields.temperature !== undefined || extraFields.thirdField
  );

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    }
    setOpen(!open);
    setSearch("");
  };

  const filteredModels = search
    ? availableModels.filter((m) => m.toLowerCase().includes(search.toLowerCase()))
    : availableModels;
  const groupedFilteredModels = groupModelsByProvider(filteredModels);

  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex items-center gap-0">
        <button
          ref={btnRef}
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-l-lg text-xs font-mono cursor-pointer transition-all hover:bg-white/10 ${
            isOverride
              ? "bg-violet-500/10 border border-violet-400/20 text-white/80"
              : "bg-white/5 border border-white/10 text-white/70"
          }`}
        >
          {showName && (
            <>
              <span className="text-pink-300">{name}</span>
              <span className="text-white/30">&rarr;</span>
            </>
          )}
          <span>{model}</span>
          {hasExtraValues && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          )}
        </button>
        {onFieldChange && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowExtra(!showExtra); }}
            className={`px-1.5 py-1 border border-l-0 rounded-r-lg text-[10px] transition-all cursor-pointer ${
              showExtra || hasExtraValues
                ? "bg-amber-500/10 border-amber-400/20 text-amber-300/80 hover:bg-amber-500/20"
                : "bg-white/5 border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10"
            }`}
            title="Configure variant, temperature, and more"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        )}
      </div>

      {showExtra && onFieldChange && (
        <div className="flex items-center gap-1.5 mt-1 ml-0.5">
          <input
            type="text"
            placeholder="variant"
            value={extraFields?.variant ?? ""}
            onChange={(e) => onFieldChange("variant", e.target.value || undefined)}
            className="w-16 px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/30"
          />
          <input
            type="number"
            placeholder="temp"
            step={0.1}
            min={0}
            max={2}
            value={extraFields?.temperature ?? ""}
            onChange={(e) => onFieldChange("temperature", e.target.value ? Number(e.target.value) : undefined)}
            className="w-14 px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/30"
          />
          <input
            type="text"
            placeholder={extraFields?.thirdFieldPlaceholder ?? ""}
            value={extraFields?.thirdField ?? ""}
            onChange={(e) => onFieldChange(extraFields?.thirdFieldKey ?? "", e.target.value || undefined)}
            className="flex-1 min-w-0 w-24 px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/30"
          />
        </div>
      )}

      {open && (
        <div
          className={`absolute z-[9999] w-72 max-h-64 overflow-hidden rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-2xl ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          } left-0`}
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
            {groupedFilteredModels.map((group) => (
              <div key={group.provider} className="border-t border-white/5 first:border-t-0">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  {group.provider}
                </div>
                {group.models.map((providerModel) => (
                  <button
                    key={providerModel}
                    type="button"
                    onClick={() => { onSelect(providerModel); setOpen(false); setSearch(""); }}
                    className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-mono transition-colors hover:bg-white/10 ${
                      isOverride && model === providerModel ? "text-violet-300 bg-violet-500/10" : "text-white/70"
                    }`}
                  >
                    <span className="flex-1">{providerModel}</span>
                  </button>
                ))}
              </div>
            ))}
            {groupedFilteredModels.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/30">No models found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OhMyOpenCodeConfigGenerator(props: OhMyOpenCodeConfigGeneratorProps) {
   const {
     apiKeys,
     proxyModelIds,
     excludedModels,
     agentOverrides: initialOverrides,
   } = props;
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
   const [lspLanguage, setLspLanguage] = useState("");
   const [lspCommand, setLspCommand] = useState("");
   const [lspExtensions, setLspExtensions] = useState("");
   const [providerConcurrencyRows, setProviderConcurrencyRows] = useState<Array<{ key: string; value: number }>>([]);
   const [modelConcurrencyRows, setModelConcurrencyRows] = useState<Array<{ key: string; value: number }>>([]);
   const tmuxDebounceRef = useRef<NodeJS.Timeout | null>(null);

   const allModelIds = proxyModelIds ?? [];
   const availableModelIds = excludedModels
     ? allModelIds.filter((id: string) => !excludedModels.includes(id))
     : allModelIds;
  const hasModels = availableModelIds.length > 0;

  const ohMyConfig = hasModels ? buildOhMyOpenCodeConfig(availableModelIds, overrides) : null;
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

  const handleAgentModelChange = (agent: string, model: string | undefined) => {
    const existing = overrides.agents?.[agent] ?? {};
    const newAgents = { ...overrides.agents };
    if (model === undefined) {
      const rest = { ...existing };
      delete rest.model;
      if (Object.keys(rest).length === 0) {
        delete newAgents[agent];
      } else {
        newAgents[agent] = rest;
      }
    } else {
      newAgents[agent] = { ...existing, model };
    }
    const newOverrides = { ...overrides, agents: newAgents };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleAgentFieldChange = (agent: string, field: string, value: string | number | undefined) => {
    const existing = overrides.agents?.[agent] ?? {};
    const newAgents = { ...overrides.agents };
    if (value === undefined || value === "") {
      const updated = { ...existing } as Record<string, unknown>;
      delete updated[field];
      if (Object.keys(updated).length === 0) {
        delete newAgents[agent];
      } else {
        newAgents[agent] = updated as AgentConfigEntry;
      }
    } else {
      newAgents[agent] = { ...existing, [field]: value } as AgentConfigEntry;
    }
    const newOverrides = { ...overrides, agents: newAgents };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleCategoryModelChange = (category: string, model: string | undefined) => {
    const existing = overrides.categories?.[category] ?? {};
    const newCategories = { ...overrides.categories };
    if (model === undefined) {
      const rest = { ...existing };
      delete rest.model;
      if (Object.keys(rest).length === 0) {
        delete newCategories[category];
      } else {
        newCategories[category] = rest;
      }
    } else {
      newCategories[category] = { ...existing, model };
    }
    const newOverrides = { ...overrides, categories: newCategories };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleCategoryFieldChange = (category: string, field: string, value: string | number | undefined) => {
    const existing = overrides.categories?.[category] ?? {};
    const newCategories = { ...overrides.categories };
    if (value === undefined || value === "") {
      const updated = { ...existing } as Record<string, unknown>;
      delete updated[field];
      if (Object.keys(updated).length === 0) {
        delete newCategories[category];
      } else {
        newCategories[category] = updated as CategoryConfigEntry;
      }
    } else {
      newCategories[category] = { ...existing, [field]: value } as CategoryConfigEntry;
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
     const newTmux = newEnabled
       ? {
           enabled: true,
           layout: currentTmux.layout ?? "main-vertical",
           main_pane_size: currentTmux.main_pane_size ?? 60,
           main_pane_min_width: currentTmux.main_pane_min_width ?? 120,
           agent_pane_min_width: currentTmux.agent_pane_min_width ?? 40,
         }
       : undefined;
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

   const handleLspAdd = () => {
     const trimmedLanguage = lspLanguage.trim();
     const trimmedCommand = lspCommand.trim();
     if (!trimmedLanguage || !trimmedCommand) return;
     const currentLsp = overrides.lsp ?? {};
     if (currentLsp[trimmedLanguage]) {
       setLspLanguage("");
       setLspCommand("");
       setLspExtensions("");
       return;
     }
     const commandArray = trimmedCommand.split(/\s+/);
     const extensionsArray = lspExtensions
       .split(",")
       .map((ext) => ext.trim())
       .filter((ext) => ext.length > 0);
     const newLsp = {
       ...currentLsp,
       [trimmedLanguage]: {
         command: commandArray,
         ...(extensionsArray.length > 0 ? { extensions: extensionsArray } : {}),
       },
     };
     const newOverrides = { ...overrides, lsp: newLsp };
     setOverrides(newOverrides);
     saveOverrides(newOverrides);
     setLspLanguage("");
     setLspCommand("");
     setLspExtensions("");
   };

   const handleLspRemove = (language: string) => {
     const currentLsp = overrides.lsp ?? {};
     const newLsp = { ...currentLsp };
     delete newLsp[language];
     const newOverrides = { ...overrides, lsp: Object.keys(newLsp).length > 0 ? newLsp : undefined };
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

  const agentAssignments: {
    name: string;
    model: string;
    isOverride: boolean;
    config: AgentConfigEntry;
    tier: 1 | 2 | 3 | 4;
    label: string;
  }[] = [];
  for (const [agent, role] of Object.entries(AGENT_ROLES)) {
    const agentConfig = overrides?.agents?.[agent] ?? {};
    const overrideModel = agentConfig.model;
    if (overrideModel && availableModelIds.includes(overrideModel)) {
      agentAssignments.push({ name: agent, model: overrideModel, isOverride: true, config: agentConfig, tier: role.tier, label: role.label });
    } else {
      const model = pickBestModel(availableModelIds, role.tier);
      if (model) {
        agentAssignments.push({ name: agent, model, isOverride: !!overrideModel, config: agentConfig, tier: role.tier, label: role.label });
      }
    }
  }
  agentAssignments.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const categoryAssignments: {
    name: string;
    model: string;
    isOverride: boolean;
    config: CategoryConfigEntry;
    tier: 1 | 2 | 3 | 4;
    label: string;
  }[] = [];
  for (const [category, role] of Object.entries(CATEGORY_ROLES)) {
    const categoryConfig = overrides?.categories?.[category] ?? {};
    const overrideModel = categoryConfig.model;
    if (overrideModel && availableModelIds.includes(overrideModel)) {
      categoryAssignments.push({ name: category, model: overrideModel, isOverride: true, config: categoryConfig, tier: role.tier, label: role.label });
    } else {
      const model = pickBestModel(availableModelIds, role.tier);
      if (model) {
        categoryAssignments.push({ name: category, model, isOverride: !!overrideModel, config: categoryConfig, tier: role.tier, label: role.label });
      }
    }
  }
  categoryAssignments.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  const agentOverrideCount = agentAssignments.filter((item) => item.isOverride).length;
  const categoryOverrideCount = categoryAssignments.filter((item) => item.isOverride).length;

   return (
     <div className="space-y-4">
       <p className="text-sm text-white/70">
         Assignments are grouped by tier so core agents stay separated from fast and creative workflows.
         Click any model to override it. Changes save automatically and sync via Config Sync.
         {saving && <span className="ml-2 text-amber-300/70 text-xs">Saving...</span>}
       </p>

       <div className="grid gap-4 xl:grid-cols-2">
         {agentAssignments.length > 0 && (
           <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
             <div className="flex items-center justify-between">
               <p className="text-xs font-medium uppercase tracking-wider text-white/50">Agent Assignments</p>
               <p className="text-[11px] text-white/40">{agentOverrideCount}/{agentAssignments.length} custom</p>
             </div>
             {[1, 2, 3, 4].map((tier) => {
               const tierAssignments = agentAssignments.filter((item) => item.tier === tier);
               if (tierAssignments.length === 0) {
                 return null;
               }
               const tierMeta = TIER_META[tier as 1 | 2 | 3 | 4];

               return (
                 <div key={`agent-tier-${tier}`} className="space-y-2">
                   <div className="flex items-center justify-between">
                     <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{tierMeta.label}</p>
                     <p className="text-[11px] text-white/35">{tierMeta.hint}</p>
                   </div>
                   <div className="space-y-1.5">
                     {tierAssignments.map(({ name, model, isOverride, config, label }) => (
                       <div key={name} className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/15 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                         <div className="min-w-0">
                           <p className="truncate text-xs font-semibold text-white/90 font-mono">{name}</p>
                           <p className="truncate text-[11px] text-white/45">{label}</p>
                         </div>
                         <ModelBadge
                           name={name}
                           model={model}
                           isOverride={isOverride}
                           showName={false}
                           availableModels={availableModelIds}
                           onSelect={(value) => handleAgentModelChange(name, value)}
                           extraFields={{
                             variant: config.variant,
                             temperature: config.temperature,
                             thirdField: config.prompt_append,
                             thirdFieldKey: "prompt_append",
                             thirdFieldPlaceholder: "prompt append",
                           }}
                           onFieldChange={(field, value) => handleAgentFieldChange(name, field, value)}
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               );
             })}
           </div>
         )}

         {categoryAssignments.length > 0 && (
           <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
             <div className="flex items-center justify-between">
               <p className="text-xs font-medium uppercase tracking-wider text-white/50">Category Assignments</p>
               <p className="text-[11px] text-white/40">{categoryOverrideCount}/{categoryAssignments.length} custom</p>
             </div>
             {[1, 2, 3, 4].map((tier) => {
               const tierAssignments = categoryAssignments.filter((item) => item.tier === tier);
               if (tierAssignments.length === 0) {
                 return null;
               }
               const tierMeta = TIER_META[tier as 1 | 2 | 3 | 4];

               return (
                 <div key={`category-tier-${tier}`} className="space-y-2">
                   <div className="flex items-center justify-between">
                     <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{tierMeta.label}</p>
                     <p className="text-[11px] text-white/35">{tierMeta.hint}</p>
                   </div>
                   <div className="space-y-1.5">
                     {tierAssignments.map(({ name, model, isOverride, config, label }) => (
                       <div key={name} className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/15 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                         <div className="min-w-0">
                           <p className="truncate text-xs font-semibold text-white/90 font-mono">{name}</p>
                           <p className="truncate text-[11px] text-white/45">{label}</p>
                         </div>
                         <ModelBadge
                           name={name}
                           model={model}
                           isOverride={isOverride}
                           showName={false}
                           availableModels={availableModelIds}
                           onSelect={(value) => handleCategoryModelChange(name, value)}
                           extraFields={{
                             variant: config.variant,
                             temperature: config.temperature,
                             thirdField: config.description,
                             thirdFieldKey: "description",
                             thirdFieldPlaceholder: "description",
                           }}
                           onFieldChange={(field, value) => handleCategoryFieldChange(name, field, value)}
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               );
             })}
           </div>
         )}
       </div>

        {/* Dedicated LSP Card */}
         <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                LSP Servers
              </h3>
              <p className="text-xs text-white/50 mt-1">Configure Language Server Protocol for code intelligence</p>
              <code className="text-[10px] text-emerald-300/60 font-mono block mt-1.5 bg-black/20 px-2 py-1 rounded">
                {`"lsp": { "typescript": { "command": ["typescript-language-server", "--stdio"] } }`}
              </code>
            </div>
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-mono shrink-0">
              {Object.keys(overrides.lsp ?? {}).length} configured
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setLspLanguage("typescript");
                setLspCommand("typescript-language-server --stdio");
                setLspExtensions(".ts,.tsx");
              }}
              className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 hover:border-emerald-400/40 transition-all"
            >
              TypeScript
            </button>
            <button
              type="button"
              onClick={() => {
                setLspLanguage("tailwindcss");
                setLspCommand("tailwindcss-language-server --stdio");
                setLspExtensions("");
              }}
              className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-medium hover:bg-cyan-500/20 hover:border-cyan-400/40 transition-all"
            >
              Tailwind
            </button>
            <button
              type="button"
              onClick={() => {
                setLspLanguage("prisma");
                setLspCommand("npx -y @prisma/language-server --stdio");
                setLspExtensions(".prisma");
              }}
              className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-400/20 text-teal-300 text-xs font-medium hover:bg-teal-500/20 hover:border-teal-400/40 transition-all"
            >
              Prisma
            </button>
            <button
              type="button"
              onClick={() => {
                setLspLanguage("markdown");
                setLspCommand("npx -y remark-language-server --stdio");
                setLspExtensions(".md");
              }}
              className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium hover:bg-blue-500/20 hover:border-blue-400/40 transition-all"
            >
              Markdown
            </button>
          </div>

          <div className="grid grid-cols-[1fr,2fr,1.5fr,auto] gap-2">
            <input
              type="text"
              placeholder="language"
              value={lspLanguage}
              onChange={(e) => setLspLanguage(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
            />
            <input
              type="text"
              placeholder="command"
              value={lspCommand}
              onChange={(e) => setLspCommand(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
            />
            <input
              type="text"
              placeholder=".ts,.tsx (optional)"
              value={lspExtensions}
              onChange={(e) => setLspExtensions(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLspAdd(); }}}
              className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
            />
            <button
              type="button"
              onClick={handleLspAdd}
              className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30"
            >
              Add
            </button>
          </div>

          {Object.keys(overrides.lsp ?? {}).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(overrides.lsp ?? {}).map(([language, entry]) => (
                <div
                  key={language}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20"
                >
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-emerald-300">{language}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-white/60">{entry.command.join(" ")}</span>
                    {entry.extensions && entry.extensions.length > 0 && (
                      <>
                        <span className="text-white/30">|</span>
                        <span className="text-white/50">{entry.extensions.join(", ")}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLspRemove(language)}
                    className="text-white/40 hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Left column */}
            <div className="flex-1 space-y-3">
              {/* Agents */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowAgents(!showAgents)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showAgents ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Agents</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                    {(overrides.disabled_agents ?? []).length} disabled
                  </span>
                </button>
                {showAgents && (
                  <div className="px-3 pb-3 space-y-1">
                    {AVAILABLE_AGENTS.map((agent) => {
                      const isEnabled = !(overrides.disabled_agents ?? []).includes(agent);
                      return (
                        <div key={agent} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                          <span className="text-xs text-white/70 font-mono">{agent}</span>
                          <button
                            type="button"
                            onClick={() => handleDisabledAgentToggle(agent)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Commands */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowCommands(!showCommands)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showCommands ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Commands</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                    {(overrides.disabled_commands ?? []).length} disabled
                  </span>
                </button>
                {showCommands && (
                  <div className="px-3 pb-3 space-y-1">
                    {AVAILABLE_COMMANDS.map((command) => {
                      const isEnabled = !(overrides.disabled_commands ?? []).includes(command);
                      return (
                        <div key={command} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                          <span className="text-xs text-white/70 font-mono">{command}</span>
                          <button
                            type="button"
                            onClick={() => handleDisabledCommandToggle(command)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tmux */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowTmux(!showTmux)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showTmux ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Tmux</span>
                  {overrides.tmux?.enabled && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 text-[10px] font-mono">enabled</span>
                  )}
                </button>
                {showTmux && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                      <span className="text-xs text-white/70 font-mono">Enabled</span>
                      <button
                        type="button"
                        onClick={handleTmuxEnabledToggle}
                        className={`w-9 h-5 rounded-full transition-colors relative ${overrides.tmux?.enabled ? "bg-emerald-500/60" : "bg-white/10"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${overrides.tmux?.enabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
                      </button>
                    </div>
                    {overrides.tmux?.enabled && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">Layout</label>
                          <select value={overrides.tmux.layout ?? "main-vertical"} onChange={(e) => handleTmuxLayoutChange(e.target.value)} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40">
                            {TMUX_LAYOUTS.map((layout) => (<option key={layout} value={layout}>{layout}</option>))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">Main Pane Size (20-80)</label>
                          <input type="number" min={20} max={80} defaultValue={overrides.tmux.main_pane_size ?? 60} onChange={(e) => handleTmuxNumberChange("main_pane_size", Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">Main Pane Min Width</label>
                          <input type="number" min={0} defaultValue={overrides.tmux.main_pane_min_width ?? 120} onChange={(e) => handleTmuxNumberChange("main_pane_min_width", Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">Agent Pane Min Width</label>
                          <input type="number" min={0} defaultValue={overrides.tmux.agent_pane_min_width ?? 40} onChange={(e) => handleTmuxNumberChange("agent_pane_min_width", Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Sisyphus Agent */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowSisyphus(!showSisyphus)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showSisyphus ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Sisyphus Agent</span>
                </button>
                {showSisyphus && (
                  <div className="px-3 pb-3 space-y-1">
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
                          <button type="button" onClick={() => handleSisyphusToggle(field)} className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Browser Automation */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowBrowser(!showBrowser)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showBrowser ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Browser Automation</span>
                </button>
                {showBrowser && (
                  <div className="px-3 pb-3 space-y-1">
                    <label className="text-xs text-white/50">Provider</label>
                    <select value={overrides.browser_automation_engine?.provider ?? "playwright"} onChange={(e) => handleBrowserProviderChange(e.target.value)} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40">
                      {BROWSER_PROVIDERS.map((provider) => (<option key={provider} value={provider}>{provider}</option>))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="flex-1 space-y-3">
              {/* Skills */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowSkills(!showSkills)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showSkills ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Skills</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                    {(overrides.disabled_skills ?? []).length} disabled
                  </span>
                </button>
                {showSkills && (
                  <div className="px-3 pb-3 space-y-1">
                    {AVAILABLE_SKILLS.map((skill) => {
                      const isEnabled = !(overrides.disabled_skills ?? []).includes(skill);
                      return (
                        <div key={skill} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                          <span className="text-xs text-white/70 font-mono">{skill}</span>
                          <button
                            type="button"
                            onClick={() => handleDisabledSkillToggle(skill)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hooks */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowHooks(!showHooks)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showHooks ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Hooks</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                    {(overrides.disabled_hooks ?? []).length} disabled
                  </span>
                </button>
                {showHooks && (
                  <div className="px-3 pb-3 space-y-2">
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
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isGroupExpanded ? "rotate-90" : ""}`}>
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
                                      className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}
                                    >
                                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
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
              </div>

              {/* Background Tasks */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowBgTask(!showBgTask)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showBgTask ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Background Tasks</span>
                </button>
                {showBgTask && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs text-white/50">Default Concurrency</label>
                      <input type="number" min={1} defaultValue={overrides.background_task?.defaultConcurrency ?? 5} onChange={(e) => handleBgTaskNumberChange("defaultConcurrency", Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/50">Stale Timeout (ms)</label>
                      <input type="number" min={60000} defaultValue={overrides.background_task?.staleTimeoutMs ?? 180000} onChange={(e) => handleBgTaskNumberChange("staleTimeoutMs", Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/50">Provider Concurrency</label>
                        <button type="button" onClick={handleProviderConcurrencyAdd} className="text-xs text-violet-400 hover:text-violet-300">+ Add</button>
                      </div>
                      {providerConcurrencyRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input type="text" placeholder="Provider" value={row.key} onChange={(e) => handleProviderConcurrencyChange(idx, "key", e.target.value)} className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                          <input type="number" min={1} value={row.value} onChange={(e) => handleProviderConcurrencyChange(idx, "value", Number(e.target.value))} className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                          <button type="button" onClick={() => handleProviderConcurrencyRemove(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/50">Model Concurrency</label>
                        <button type="button" onClick={handleModelConcurrencyAdd} className="text-xs text-violet-400 hover:text-violet-300">+ Add</button>
                      </div>
                      {modelConcurrencyRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input type="text" placeholder="Model" value={row.key} onChange={(e) => handleModelConcurrencyChange(idx, "key", e.target.value)} className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                          <input type="number" min={1} value={row.value} onChange={(e) => handleModelConcurrencyChange(idx, "value", Number(e.target.value))} className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40" />
                          <button type="button" onClick={() => handleModelConcurrencyRemove(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Git Master */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowGitMaster(!showGitMaster)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showGitMaster ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Git Master</span>
                </button>
                {showGitMaster && (
                  <div className="px-3 pb-3 space-y-1">
                    {[
                      { field: "commit_footer" as const, label: "Commit Footer", defaultValue: false },
                      { field: "include_co_authored_by" as const, label: "Include Co-Authored-By", defaultValue: false },
                    ].map(({ field, label, defaultValue }) => {
                      const isEnabled = overrides.git_master?.[field] ?? defaultValue;
                      return (
                        <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                          <span className="text-xs text-white/70 font-mono">{label}</span>
                          <button type="button" onClick={() => handleGitMasterToggle(field)} className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? "bg-emerald-500/60" : "bg-white/10"}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Disabled MCPs */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
                <button
                  type="button"
                  onClick={() => setShowMcps(!showMcps)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showMcps ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="flex-1 text-left">Disabled MCPs</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                    {(overrides.disabled_mcps ?? []).length}
                  </span>
                </button>
                {showMcps && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="MCP name" value={mcpInput} onChange={(e) => setMcpInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleMcpAdd(); }}} className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/40" />
                      <button type="button" onClick={handleMcpAdd} className="px-3 py-1.5 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(overrides.disabled_mcps ?? []).map((mcp) => (
                        <div key={mcp} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-red-500/10 border border-red-400/20 text-red-300">
                          <span className="font-mono">{mcp}</span>
                          <button type="button" onClick={() => handleMcpRemove(mcp)} className="text-red-400 hover:text-red-200">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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

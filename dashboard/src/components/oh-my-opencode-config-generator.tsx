"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CopyBlock } from "@/components/copy-block";
import { downloadFile } from "@/components/oh-my-opencode/model-badge";
import { TierAssignments } from "@/components/oh-my-opencode/tier-assignments";
import { ToggleSections } from "@/components/oh-my-opencode/toggle-sections";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  AGENT_ROLES,
  CATEGORY_ROLES,
  buildOhMyOpenCodeConfig,
  type ConfigData,
  type OAuthAccount,
  pickBestModel,
} from "@/lib/config-generators/oh-my-opencode";
import type {
  AgentConfigEntry,
  BackgroundTaskConfig,
  BrowserAutomationConfig,
  CategoryConfigEntry,
  GitMasterConfig,
  OhMyOpenCodeFullConfig,
  SisyphusAgentConfig,
  TmuxConfig,
} from "@/lib/config-generators/oh-my-opencode-types";

interface OhMyOpenCodeConfigGeneratorProps {
  apiKeys: { key: string; name: string | null }[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  proxyModelIds?: string[];
  excludedModels?: string[];
  agentOverrides?: OhMyOpenCodeFullConfig;
  modelSourceMap?: Map<string, string>;
}

export function OhMyOpenCodeConfigGenerator(props: OhMyOpenCodeConfigGeneratorProps) {
  const { apiKeys, proxyModelIds, excludedModels, agentOverrides: initialOverrides, modelSourceMap } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrides, setOverrides] = useState<OhMyOpenCodeFullConfig>(initialOverrides ?? { agents: {}, categories: {} });
  const [saving, setSaving] = useState(false);
  const [providerConcurrencyRows, setProviderConcurrencyRows] = useState<Array<{ key: string; value: number }>>([]);
  const [modelConcurrencyRows, setModelConcurrencyRows] = useState<Array<{ key: string; value: number }>>([]);
  const tmuxDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

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

  const latestSaveRef = useRef<OhMyOpenCodeFullConfig>(overrides);

  const saveOverrides = useCallback(
    async (newOverrides: OhMyOpenCodeFullConfig) => {
      const previous = latestSaveRef.current;
      latestSaveRef.current = newOverrides;
      setSaving(true);
      try {
        const res = await fetch("/api/agent-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: newOverrides }),
        });
        if (!res.ok) {
          if (latestSaveRef.current === newOverrides) {
            latestSaveRef.current = previous;
            setOverrides(previous);
          }
          showToast("Failed to save — reverted", "error");
          return;
        }
        showToast("Assignment saved", "success");
      } catch {
        if (latestSaveRef.current === newOverrides) {
          latestSaveRef.current = previous;
          setOverrides(previous);
        }
        showToast("Network error — reverted", "error");
      } finally {
        setSaving(false);
      }
    },
    [showToast],
  );

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

  const handleDisabledAgentToggle = (agent: string) => {
    const current = overrides.disabled_agents ?? [];
    const newDisabled = current.includes(agent) ? current.filter((a) => a !== agent) : [...current, agent];
    const newOverrides = { ...overrides, disabled_agents: newDisabled.length > 0 ? newDisabled : undefined };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleDisabledSkillToggle = (skill: string) => {
    const current = overrides.disabled_skills ?? [];
    const newDisabled = current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill];
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
    const newDisabled = current.includes(hook) ? current.filter((h) => h !== hook) : [...current, hook];
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

  const handleProviderConcurrencyChange = (
    index: number,
    field: "key" | "value",
    newValue: string | number,
  ) => {
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

  const handleMcpAdd = (mcp: string) => {
    const trimmed = mcp.trim();
    if (!trimmed) return false;
    const current = overrides.disabled_mcps ?? [];
    if (current.includes(trimmed)) {
      return true;
    }
    const newDisabled = [...current, trimmed];
    const newOverrides = { ...overrides, disabled_mcps: newDisabled };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
    return true;
  };

  const handleMcpRemove = (mcp: string) => {
    const current = overrides.disabled_mcps ?? [];
    const newDisabled = current.filter((item) => item !== mcp);
    const newOverrides = { ...overrides, disabled_mcps: newDisabled.length > 0 ? newDisabled : undefined };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleLspAdd = (language: string, command: string, extensions: string) => {
    const trimmedLanguage = language.trim();
    const trimmedCommand = command.trim();
    if (!trimmedLanguage || !trimmedCommand) return false;
    const currentLsp = overrides.lsp ?? {};
    if (currentLsp[trimmedLanguage]) {
      return true;
    }
    const commandArray = trimmedCommand.split(/\s+/);
    const extensionsArray = extensions
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
    return true;
  };

  const handleLspRemove = (language: string) => {
    const currentLsp = overrides.lsp ?? {};
    const newLsp = { ...currentLsp };
    delete newLsp[language];
    const newOverrides = { ...overrides, lsp: Object.keys(newLsp).length > 0 ? newLsp : undefined };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  if (apiKeys.length === 0) {
    return (
      <div className="space-y-3">
        <div className="border-l-4 border-amber-400/60 backdrop-blur-xl bg-amber-500/10 p-4 rounded-r-xl">
          <div className="text-sm font-medium text-white mb-1">API Key Required</div>
          <p className="text-sm text-white/70">Create an API key to generate your configuration.</p>
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
            You need to configure at least one AI provider before generating an Oh My OpenCode config. Head to the{" "}
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
      agentAssignments.push({
        name: agent,
        model: overrideModel,
        isOverride: true,
        config: agentConfig,
        tier: role.tier,
        label: role.label,
      });
    } else {
      const model = pickBestModel(availableModelIds, role.tier);
      if (model) {
        agentAssignments.push({
          name: agent,
          model,
          isOverride: !!overrideModel,
          config: agentConfig,
          tier: role.tier,
          label: role.label,
        });
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
      categoryAssignments.push({
        name: category,
        model: overrideModel,
        isOverride: true,
        config: categoryConfig,
        tier: role.tier,
        label: role.label,
      });
    } else {
      const model = pickBestModel(availableModelIds, role.tier);
      if (model) {
        categoryAssignments.push({
          name: category,
          model,
          isOverride: !!overrideModel,
          config: categoryConfig,
          tier: role.tier,
          label: role.label,
        });
      }
    }
  }
  categoryAssignments.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const handleDownload = () => {
    if (configJson) {
      downloadFile(configJson, "oh-my-opencode.json");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Assignments are grouped by tier so core agents stay separated from fast and creative workflows. Click any
        model to override it. Changes save automatically and sync via Config Sync.
        {saving && <span className="ml-2 text-amber-300/70 text-xs">Saving...</span>}
      </p>

      <TierAssignments
        agentAssignments={agentAssignments}
        categoryAssignments={categoryAssignments}
        availableModelIds={availableModelIds}
        modelSourceMap={modelSourceMap}
        onAgentModelChange={handleAgentModelChange}
        onAgentFieldChange={handleAgentFieldChange}
        onCategoryModelChange={handleCategoryModelChange}
        onCategoryFieldChange={handleCategoryFieldChange}
      />

      <ToggleSections
        overrides={overrides}
        providerConcurrencyRows={providerConcurrencyRows}
        modelConcurrencyRows={modelConcurrencyRows}
        onDisabledAgentToggle={handleDisabledAgentToggle}
        onDisabledSkillToggle={handleDisabledSkillToggle}
        onDisabledCommandToggle={handleDisabledCommandToggle}
        onDisabledHookToggle={handleDisabledHookToggle}
        onTmuxEnabledToggle={handleTmuxEnabledToggle}
        onTmuxLayoutChange={handleTmuxLayoutChange}
        onTmuxNumberChange={handleTmuxNumberChange}
        onBgTaskNumberChange={handleBgTaskNumberChange}
        onProviderConcurrencyChange={handleProviderConcurrencyChange}
        onProviderConcurrencyAdd={handleProviderConcurrencyAdd}
        onProviderConcurrencyRemove={handleProviderConcurrencyRemove}
        onModelConcurrencyChange={handleModelConcurrencyChange}
        onModelConcurrencyAdd={handleModelConcurrencyAdd}
        onModelConcurrencyRemove={handleModelConcurrencyRemove}
        onSisyphusToggle={handleSisyphusToggle}
        onGitMasterToggle={handleGitMasterToggle}
        onBrowserProviderChange={handleBrowserProviderChange}
        onMcpAdd={handleMcpAdd}
        onMcpRemove={handleMcpRemove}
        onLspAdd={handleLspAdd}
        onLspRemove={handleLspRemove}
      />

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

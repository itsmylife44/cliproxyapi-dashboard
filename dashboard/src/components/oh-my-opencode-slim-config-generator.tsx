"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CopyBlock } from "@/components/copy-block";
import { downloadFile } from "@/components/oh-my-opencode/model-badge";
import { SlimTierAssignments } from "@/components/oh-my-opencode-slim/tier-assignments";
import { SlimToggleSections } from "@/components/oh-my-opencode-slim/toggle-sections";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import {
  SLIM_AGENT_ROLES,
  buildSlimConfig,
  pickBestModel,
  type ConfigData,
  type OAuthAccount,
} from "@/lib/config-generators/oh-my-opencode-slim";
import type {
  OhMyOpenCodeSlimFullConfig,
  SlimAgentConfig,
  SlimBackgroundConfig,
  SlimFallbackConfig,
  SlimTmuxConfig,
} from "@/lib/config-generators/oh-my-opencode-slim-types";

interface OhMyOpenCodeSlimConfigGeneratorProps {
  apiKeys: { key: string; name: string | null }[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  proxyModelIds?: string[];
  excludedModels?: string[];
  slimOverrides?: OhMyOpenCodeSlimFullConfig;
  modelSourceMap?: Map<string, string>;
}

export function OhMyOpenCodeSlimConfigGenerator(props: OhMyOpenCodeSlimConfigGeneratorProps) {
  const { apiKeys, proxyModelIds, excludedModels, slimOverrides: initialOverrides, modelSourceMap } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrides, setOverrides] = useState<OhMyOpenCodeSlimFullConfig>(initialOverrides ?? { agents: {} });
  const [saving, setSaving] = useState(false);

  // Sync state when parent prop changes (e.g. late-loaded subscriber overrides)
  useEffect(() => {
    if (initialOverrides) {
      setOverrides(initialOverrides);
    }
  }, [initialOverrides]);
  const { showToast } = useToast();

  const allModelIds = proxyModelIds ?? [];
  const availableModelIds = excludedModels
    ? allModelIds.filter((id: string) => !excludedModels.includes(id))
    : allModelIds;
  const hasModels = availableModelIds.length > 0;

  const slimConfig = hasModels ? buildSlimConfig(availableModelIds, overrides) : null;
  const configJson = slimConfig ? JSON.stringify(slimConfig, null, 2) : "";

  const latestSaveRef = useRef<OhMyOpenCodeSlimFullConfig>(overrides);

  const saveOverrides = useCallback(
    async (newOverrides: OhMyOpenCodeSlimFullConfig) => {
      const previous = latestSaveRef.current;
      latestSaveRef.current = newOverrides;
      setSaving(true);
      try {
        const res = await fetch(API_ENDPOINTS.AGENT_CONFIG_SLIM, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: newOverrides }),
        });
        if (!res.ok) {
          if (latestSaveRef.current === newOverrides) {
            latestSaveRef.current = previous;
            setOverrides(previous);
          }
          showToast("Failed to save slim config — reverted", "error");
          return;
        }
        showToast("Slim assignment saved", "success");
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

  // --- Agent model/field handlers ---

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

  const handleAgentFieldChange = (agent: string, field: string, value: string | number | string[] | undefined) => {
    const existing = overrides.agents?.[agent] ?? {};
    const newAgents = { ...overrides.agents };

    // Convert comma-separated string to array for skills/mcps fields
    let processedValue = value;
    if ((field === "skills" || field === "mcps") && typeof value === "string") {
      const arr = value.split(",").map((s) => s.trim()).filter(Boolean);
      processedValue = arr.length > 0 ? arr : undefined;
    }

    if (processedValue === undefined || processedValue === "" || (Array.isArray(processedValue) && processedValue.length === 0)) {
      const updated = { ...existing } as Record<string, unknown>;
      delete updated[field];
      if (Object.keys(updated).length === 0) {
        delete newAgents[agent];
      } else {
        newAgents[agent] = updated as SlimAgentConfig;
      }
    } else {
      newAgents[agent] = { ...existing, [field]: processedValue } as SlimAgentConfig;
    }
    const newOverrides = { ...overrides, agents: newAgents };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleAgentSkillsChange = (agent: string, skills: string[] | undefined) => {
    const existing = overrides.agents?.[agent] ?? {};
    const newAgents = { ...overrides.agents };
    if (skills === undefined || skills.length === 0) {
      const updated = { ...existing } as Record<string, unknown>;
      delete updated.skills;
      if (Object.keys(updated).length === 0) {
        delete newAgents[agent];
      } else {
        newAgents[agent] = updated as SlimAgentConfig;
      }
    } else {
      newAgents[agent] = { ...existing, skills } as SlimAgentConfig;
    }
    const newOverrides = { ...overrides, agents: newAgents };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  // --- Toggle section handlers ---

  const handleTmuxChange = (tmux: SlimTmuxConfig | undefined) => {
    const newOverrides = { ...overrides, tmux };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleBackgroundChange = (bg: SlimBackgroundConfig | undefined) => {
    const newOverrides = { ...overrides, background: bg };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleFallbackChange = (fb: SlimFallbackConfig | undefined) => {
    const newOverrides = { ...overrides, fallback: fb };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const handleDisabledMcpAdd = (mcp: string) => {
    const trimmed = mcp.trim();
    if (!trimmed) return false;
    const current = overrides.disabled_mcps ?? [];
    if (current.includes(trimmed)) return true;
    const newOverrides = { ...overrides, disabled_mcps: [...current, trimmed] };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
    return true;
  };

  const handleDisabledMcpRemove = (mcp: string) => {
    const current = overrides.disabled_mcps ?? [];
    const newDisabled = current.filter((item) => item !== mcp);
    const newOverrides = { ...overrides, disabled_mcps: newDisabled.length > 0 ? newDisabled : undefined };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  const ALLOWED_SCALAR_FIELDS = new Set(["preset", "setDefaultAgent", "scoringEngineVersion", "balanceProviderUsage"]);

  const handleScalarChange = (field: string, value: unknown) => {
    if (!ALLOWED_SCALAR_FIELDS.has(field)) return;
    const newOverrides = { ...overrides, [field]: value } as OhMyOpenCodeSlimFullConfig;
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
  };

  // --- Render guards ---

  if (apiKeys.length === 0) {
    return (
      <div className="space-y-3">
        <div className="border-l-4 border-amber-400/60 backdrop-blur-xl bg-amber-500/10 p-4 rounded-r-xl">
          <div className="text-sm font-medium text-white mb-1">API Key Required</div>
          <p className="text-sm text-white/70">Create an API key to generate your slim configuration.</p>
          <Link
            href="/dashboard/api-keys"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors"
          >
            Create API Key →
          </Link>
        </div>
      </div>
    );
  }

  if (!hasModels || !slimConfig) {
    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-400/60 bg-amber-500/10 backdrop-blur-xl p-4 text-sm rounded-r-xl">
          <p className="text-white/90 font-medium mb-1">No providers configured</p>
          <p className="text-white/60 text-xs">
            Configure at least one AI provider before generating a slim config. Head to{" "}
            <Link
              href="/dashboard/providers"
              className="text-violet-400 font-medium hover:text-violet-300 underline underline-offset-2 decoration-violet-400/30"
            >
              Providers
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // --- Build assignment list ---

  const agentAssignments: {
    name: string;
    model: string;
    isOverride: boolean;
    config: SlimAgentConfig;
    tier: 1 | 2 | 3 | 4;
    label: string;
  }[] = [];

  for (const [agent, role] of Object.entries(SLIM_AGENT_ROLES)) {
    const agentConfig = overrides?.agents?.[agent] ?? {};
    const overrideModel = agentConfig.model;
    if (typeof overrideModel === "string" && availableModelIds.includes(overrideModel)) {
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

  const handleDownload = () => {
    if (configJson) {
      downloadFile(configJson, "oh-my-opencode-slim.json");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Slim uses 6 specialized agents (orchestrator, oracle, designer, explorer, librarian, fixer) with a dedicated fallback system.
        Changes save automatically.
        {saving && <span className="ml-2 text-amber-300/70 text-xs">Saving...</span>}
      </p>

      <SlimTierAssignments
        agentAssignments={agentAssignments}
        availableModelIds={availableModelIds}
        modelSourceMap={modelSourceMap}
        onAgentModelChange={handleAgentModelChange}
        onAgentFieldChange={handleAgentFieldChange}
        onAgentSkillsChange={handleAgentSkillsChange}
      />

      <SlimToggleSections
        overrides={overrides}
        onTmuxChange={handleTmuxChange}
        onBackgroundChange={handleBackgroundChange}
        onFallbackChange={handleFallbackChange}
        onDisabledMcpAdd={handleDisabledMcpAdd}
        onDisabledMcpRemove={handleDisabledMcpRemove}
        onScalarChange={handleScalarChange}
      />

      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download oh-my-opencode-slim.json
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

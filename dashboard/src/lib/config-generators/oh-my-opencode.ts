import type {
  OhMyOpenCodeFullConfig,
  OhMyOpenCodePreset,
} from "./oh-my-opencode-types";

export type { OAuthAccount, ConfigData } from "./shared";
export { type OhMyOpenCodePreset } from "./oh-my-opencode-types";

const ALIAS_NORMALIZE: Record<string, string> = {
  "claude-opus-4-6": "claude-opus-4.6",
  "claude-sonnet-4-6": "claude-sonnet-4.6",
  "claude-haiku-4-5": "claude-haiku-4.5",
};

function normalizeProxyAlias(id: string): string {
  return ALIAS_NORMALIZE[id] ?? id;
}

function stripVariant(id: string): string {
  return id.replace(/\s*\([^)]*\)\s*$/, "");
}

export const UPSTREAM_AGENT_CHAINS: Record<string, string[]> = {
  sisyphus: ["claude-opus-4.6", "kimi-k2.5", "k2p5", "gpt-5.4", "glm-5", "big-pickle"],
  hephaestus: ["gpt-5.4"],
  oracle: ["gpt-5.4", "gemini-3.1-pro", "claude-opus-4.6", "glm-5"],
  prometheus: ["claude-opus-4.6", "gpt-5.4", "glm-5", "gemini-3.1-pro"],
  metis: ["claude-opus-4.6", "gpt-5.4", "glm-5", "k2p5"],
  momus: ["gpt-5.4", "claude-opus-4.6", "gemini-3.1-pro", "glm-5"],
  atlas: ["claude-sonnet-4.6", "kimi-k2.5", "gpt-5.4", "minimax-m2.7"],
  librarian: ["minimax-m2.7", "minimax-m2.7-highspeed", "claude-haiku-4.5", "gpt-5-nano"],
  explore: ["grok-code-fast-1", "minimax-m2.7-highspeed", "minimax-m2.7", "claude-haiku-4.5", "gpt-5-nano"],
  "multimodal-looker": ["gpt-5.4", "kimi-k2.5", "glm-4.6v", "gpt-5-nano"],
  "sisyphus-junior": ["claude-sonnet-4.6", "kimi-k2.5", "gpt-5.4", "minimax-m2.7", "big-pickle"],
};

export const UPSTREAM_CATEGORY_CHAINS: Record<string, string[]> = {
  "visual-engineering": ["gemini-3.1-pro", "glm-5", "claude-opus-4.6", "k2p5"],
  ultrabrain: ["gpt-5.4", "gemini-3.1-pro", "claude-opus-4.6", "glm-5"],
  deep: ["gpt-5.4", "claude-opus-4.6", "gemini-3.1-pro"],
  artistry: ["gemini-3.1-pro", "claude-opus-4.6", "gpt-5.4"],
  quick: ["gpt-5.4-mini", "claude-haiku-4.5", "gemini-3-flash", "minimax-m2.7", "gpt-5-nano"],
  "unspecified-low": ["claude-sonnet-4.6", "gpt-5.3-codex", "kimi-k2.5", "gemini-3-flash", "minimax-m2.7"],
  "unspecified-high": ["claude-opus-4.6", "gpt-5.4", "glm-5", "k2p5", "kimi-k2.5"],
  writing: ["gemini-3-flash", "kimi-k2.5", "claude-sonnet-4.6", "minimax-m2.7"],
};

interface ChainResolution {
  model: string;
  fallbackModels: string[];
}

export function resolveChain(
  chain: string[],
  availableModels: string[],
): ChainResolution | null {
  const availableSet = new Set(
    availableModels.map((m) => normalizeProxyAlias(stripVariant(m))),
  );

  for (const candidate of chain) {
    const stripped = normalizeProxyAlias(stripVariant(candidate));
    if (availableSet.has(stripped)) {
      const remaining = chain.slice(chain.indexOf(candidate) + 1);
      const fallbackModels = remaining.filter((fb) => {
        const fbStripped = normalizeProxyAlias(stripVariant(fb));
        return availableSet.has(fbStripped);
      });
      return { model: candidate, fallbackModels };
    }
  }

  return null;
}

export function getMissingPresetModels(
  preset: OhMyOpenCodePreset,
  availableModels: string[],
): { agent: string; model: string }[] {
  const available = new Set(availableModels);
  const missing: { agent: string; model: string }[] = [];

  // Check agent model overrides
  if (preset.config.agents) {
    for (const [agentName, agentConfig] of Object.entries(preset.config.agents)) {
      if (agentConfig.model && !available.has(agentConfig.model)) {
        missing.push({ agent: agentName, model: agentConfig.model });
      }
    }
  }

  // Check category model overrides
  if (preset.config.categories) {
    for (const [categoryName, categoryConfig] of Object.entries(preset.config.categories)) {
      if (categoryConfig.model && !available.has(categoryConfig.model)) {
        missing.push({ agent: categoryName, model: categoryConfig.model });
      }
    }
  }

  return missing;
}

export const AGENT_ROLE_LABELS: Record<string, string> = {
  sisyphus: "Orchestrator",
  hephaestus: "Deep autonomous worker",
  atlas: "Master orchestrator",
  prometheus: "Planner",
  metis: "Plan consultant",
  oracle: "Technical advisor",
  librarian: "Research",
  explore: "Fast exploration",
  "multimodal-looker": "Vision",
  momus: "Reviewer",
  "sisyphus-junior": "Lightweight executor",
};

export const CATEGORY_ROLE_LABELS: Record<string, string> = {
  "visual-engineering": "UI work",
  ultrabrain: "Hard logic",
  deep: "Deep problem solving",
  artistry: "Creative work",
  quick: "Trivial tasks",
  "unspecified-low": "Low effort general",
  "unspecified-high": "High effort general",
  writing: "Documentation",
};

export type TierLevel = 1 | 2 | 3 | 4;

export interface DynamicTiers {
  tier1: string[];
  tier2: string[];
  tier3: string[];
  tier4: string[];
}

export function buildTiers(availableModels: string[]): DynamicTiers {
  const allChainModels = [
    ...Object.values(UPSTREAM_AGENT_CHAINS),
    ...Object.values(UPSTREAM_CATEGORY_CHAINS),
  ].flat();
  const seen = new Set<string>();
  const uniqueModels: string[] = [];
  for (const m of allChainModels) {
    const normalized = normalizeProxyAlias(stripVariant(m));
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueModels.push(m);
    }
  }

  const availableSet = new Set(
    availableModels.map((m) => normalizeProxyAlias(stripVariant(m))),
  );
  const available = uniqueModels.filter((m) =>
    availableSet.has(normalizeProxyAlias(stripVariant(m))),
  );

  // Append any available models not found in chains (backward compat for slim)
  for (const m of availableModels) {
    const normalized = normalizeProxyAlias(stripVariant(m));
    if (!seen.has(normalized)) {
      seen.add(normalized);
      available.push(m);
    }
  }

  const t1Count = Math.max(1, Math.ceil(available.length / 3));
  const t2Count = Math.max(1, Math.ceil((available.length * 2) / 3));

  return {
    tier1: available.slice(0, t1Count),
    tier2: available.slice(0, t2Count),
    tier3: [...available].reverse(),
    tier4: available,
  };
}

export function pickBestModel(
  availableModels: string[],
  tierLevel: TierLevel,
): string | null {
  const tiers = buildTiers(availableModels);
  const tierList = tierLevel === 1
    ? tiers.tier1
    : tierLevel === 2
      ? tiers.tier2
      : tierLevel === 3
        ? tiers.tier3
        : tiers.tier4;
  return tierList[0] ?? null;
}

export const AGENT_ROLES: Record<string, { tier: TierLevel; label: string }> = {
  sisyphus: { tier: 1, label: "Orchestrator" },
  hephaestus: { tier: 1, label: "Deep autonomous worker" },
  atlas: { tier: 1, label: "Master orchestrator" },
  prometheus: { tier: 1, label: "Planner" },
  metis: { tier: 2, label: "Plan consultant" },
  oracle: { tier: 1, label: "Technical advisor" },
  librarian: { tier: 2, label: "Research" },
  explore: { tier: 3, label: "Fast exploration" },
  "multimodal-looker": { tier: 2, label: "Vision" },
  momus: { tier: 2, label: "Reviewer" },
  "sisyphus-junior": { tier: 3, label: "Lightweight executor" },
};

export const CATEGORY_ROLES: Record<string, { tier: TierLevel; label: string }> = {
  "visual-engineering": { tier: 4, label: "UI work" },
  ultrabrain: { tier: 1, label: "Hard logic" },
  deep: { tier: 1, label: "Deep problem solving" },
  artistry: { tier: 4, label: "Creative work" },
  quick: { tier: 3, label: "Trivial tasks" },
  "unspecified-low": { tier: 2, label: "Low effort general" },
  "unspecified-high": { tier: 1, label: "High effort general" },
  writing: { tier: 3, label: "Documentation" },
};

interface ModelAssignment {
  model: string;
  variant?: string;
  temperature?: number;
  prompt_append?: string;
  description?: string;
  fallback_models?: string[];
  permission?: { edit?: string; bash?: unknown };
  thinking?: { type: string; budgetTokens?: number };
  ultrawork?: { model?: string; variant?: string; temperature?: number };
}

export function buildOhMyOpenCodeConfig(
  availableModels: string[],
  overrides?: OhMyOpenCodeFullConfig,
): Record<string, unknown> | null {
  const agents: Record<string, ModelAssignment> = {};

  for (const [agent, chain] of Object.entries(UPSTREAM_AGENT_CHAINS)) {
    const agentOverride = overrides?.agents?.[agent];
    const overrideModel = agentOverride?.model;
    let entry: ModelAssignment;

    if (overrideModel && availableModels.includes(overrideModel)) {
      const overrideIndex = chain.indexOf(overrideModel);
      const fallbackModels = overrideIndex >= 0
        ? chain.slice(overrideIndex + 1).filter((m) => availableModels.includes(m))
        : [];
      entry = {
        model: `cliproxyapi/${overrideModel}`,
        fallback_models: fallbackModels.length > 0
          ? fallbackModels.map((m) => `cliproxyapi/${m}`)
          : undefined,
      };
      if (!entry.fallback_models) delete entry.fallback_models;
    } else {
      const resolution = resolveChain(chain, availableModels);
      if (!resolution) {
        // No chain model available — still include agent with the first chain model as intended model
        entry = { model: `cliproxyapi/${chain[0]}` };
      } else {
        entry = {
          model: `cliproxyapi/${resolution.model}`,
          fallback_models: resolution.fallbackModels.length > 0
            ? resolution.fallbackModels.map((m) => `cliproxyapi/${m}`)
            : undefined,
        };
        if (!entry.fallback_models) delete entry.fallback_models;
      }
    }

    if (agentOverride?.variant) entry.variant = agentOverride.variant;
    if (agentOverride?.temperature !== undefined) entry.temperature = agentOverride.temperature;
    if (agentOverride?.prompt_append) entry.prompt_append = agentOverride.prompt_append;
    if (agentOverride?.fallback_models?.length) {
      entry.fallback_models = agentOverride.fallback_models
        .filter((m) => availableModels.includes(m))
        .map((m) => `cliproxyapi/${m}`);
      if (entry.fallback_models.length === 0) delete entry.fallback_models;
    }
    if (agentOverride?.permission) entry.permission = agentOverride.permission;
    if (agentOverride?.thinking) entry.thinking = agentOverride.thinking;
    if (agentOverride?.ultrawork) {
      const ultrawork = { ...agentOverride.ultrawork };
      if (ultrawork.model) {
        if (availableModels.includes(ultrawork.model)) {
          ultrawork.model = `cliproxyapi/${ultrawork.model}`;
        } else {
          delete ultrawork.model;
        }
      }
      entry.ultrawork = ultrawork;
    }
    agents[agent] = entry;
  }

  const categories: Record<string, ModelAssignment> = {};

  for (const [category, chain] of Object.entries(UPSTREAM_CATEGORY_CHAINS)) {
    const categoryOverride = overrides?.categories?.[category];
    const overrideModel = categoryOverride?.model;
    let entry: ModelAssignment;

    if (overrideModel && availableModels.includes(overrideModel)) {
      const overrideIndex = chain.indexOf(overrideModel);
      const fallbackModels = overrideIndex >= 0
        ? chain.slice(overrideIndex + 1).filter((m) => availableModels.includes(m))
        : [];
      entry = {
        model: `cliproxyapi/${overrideModel}`,
        fallback_models: fallbackModels.length > 0
          ? fallbackModels.map((m) => `cliproxyapi/${m}`)
          : undefined,
      };
      if (!entry.fallback_models) delete entry.fallback_models;
    } else {
      const resolution = resolveChain(chain, availableModels);
      if (!resolution) {
        // No chain model available — still include category with the first chain model as intended model
        entry = { model: `cliproxyapi/${chain[0]}` };
      } else {
        entry = {
          model: `cliproxyapi/${resolution.model}`,
          fallback_models: resolution.fallbackModels.length > 0
            ? resolution.fallbackModels.map((m) => `cliproxyapi/${m}`)
            : undefined,
        };
        if (!entry.fallback_models) delete entry.fallback_models;
      }
    }

    if (categoryOverride?.variant) entry.variant = categoryOverride.variant;
    if (categoryOverride?.temperature !== undefined) entry.temperature = categoryOverride.temperature;
    if (categoryOverride?.description) entry.description = categoryOverride.description;
    if (categoryOverride?.fallback_models?.length) {
      entry.fallback_models = categoryOverride.fallback_models
        .filter((m) => availableModels.includes(m))
        .map((m) => `cliproxyapi/${m}`);
      if (entry.fallback_models.length === 0) delete entry.fallback_models;
    }
    categories[category] = entry;
  }

  if (Object.keys(agents).length === 0 && Object.keys(categories).length === 0) {
    return null;
  }

  const config: Record<string, unknown> = {
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/main/assets/oh-my-opencode.schema.json",
  };

  if (Object.keys(agents).length > 0) {
    config.agents = agents;
  }
  if (Object.keys(categories).length > 0) {
    config.categories = categories;
  }

  config.auto_update = false;

  if (overrides?.disabled_agents?.length) config.disabled_agents = overrides.disabled_agents;
  if (overrides?.disabled_skills?.length) config.disabled_skills = overrides.disabled_skills;
  if (overrides?.disabled_hooks?.length) config.disabled_hooks = overrides.disabled_hooks;
  if (overrides?.disabled_commands?.length) config.disabled_commands = overrides.disabled_commands;
  if (overrides?.disabled_mcps?.length) config.disabled_mcps = overrides.disabled_mcps;

  if (overrides?.tmux) {
    config.tmux = {
      enabled: true,
      layout: "main-vertical",
      main_pane_size: 60,
      main_pane_min_width: 120,
      agent_pane_min_width: 40,
      ...overrides.tmux,
    };
  }

  config.background_task = { defaultConcurrency: 5, ...overrides?.background_task };

  if (overrides?.browser_automation_engine) config.browser_automation_engine = overrides.browser_automation_engine;

  config.sisyphus_agent = { planner_enabled: true, replace_plan: true, ...overrides?.sisyphus_agent };

  config.git_master = { commit_footer: false, include_co_authored_by: false, ...overrides?.git_master };

  if (overrides?.lsp && Object.keys(overrides.lsp).length > 0) {
    config.lsp = overrides.lsp;
  }

  if (overrides?.hashline_edit !== undefined) config.hashline_edit = overrides.hashline_edit;

  if (overrides?.experimental && Object.keys(overrides.experimental).length > 0) {
    config.experimental = overrides.experimental;
  }

  return config;
}

export function applyPreset(
  preset: OhMyOpenCodePreset,
  existingOverrides?: OhMyOpenCodeFullConfig
): OhMyOpenCodeFullConfig {
  const presetConfig = preset.config;

  const merged: OhMyOpenCodeFullConfig = {
    ...existingOverrides,
    ...presetConfig,
    agents: {
      ...existingOverrides?.agents,
      ...presetConfig.agents,
    },
    categories: {
      ...existingOverrides?.categories,
      ...presetConfig.categories,
    },
    background_task: (() => {
      const base = {
        ...existingOverrides?.background_task,
        ...presetConfig.background_task,
      };
      const mergedProviderConcurrency = {
        ...existingOverrides?.background_task?.providerConcurrency,
        ...presetConfig.background_task?.providerConcurrency,
      };
      const mergedModelConcurrency = {
        ...existingOverrides?.background_task?.modelConcurrency,
        ...presetConfig.background_task?.modelConcurrency,
      };
      if (Object.keys(mergedProviderConcurrency).length > 0) {
        base.providerConcurrency = mergedProviderConcurrency;
      }
      if (Object.keys(mergedModelConcurrency).length > 0) {
        base.modelConcurrency = mergedModelConcurrency;
      }
      return base;
    })(),
    sisyphus_agent: {
      ...existingOverrides?.sisyphus_agent,
      ...presetConfig.sisyphus_agent,
    },
    git_master: {
      ...existingOverrides?.git_master,
      ...presetConfig.git_master,
    },
    experimental: {
      ...existingOverrides?.experimental,
      ...presetConfig.experimental,
    },
  };

  if (presetConfig.hashline_edit !== undefined) {
    merged.hashline_edit = presetConfig.hashline_edit;
  }

  if (presetConfig.tmux) {
    merged.tmux = {
      ...existingOverrides?.tmux,
      ...presetConfig.tmux,
    };
  }

  if (presetConfig.browser_automation_engine) {
    merged.browser_automation_engine = {
      ...existingOverrides?.browser_automation_engine,
      ...presetConfig.browser_automation_engine,
    };
  }

  const arrayFields = ["disabled_agents", "disabled_skills", "disabled_hooks", "disabled_commands", "disabled_mcps"] as const;
  for (const field of arrayFields) {
    const presetValue = presetConfig[field];
    const existingValue = existingOverrides?.[field];
    if (presetValue && presetValue.length > 0) {
      const combined = [...(existingValue ?? []), ...presetValue];
      merged[field] = [...new Set(combined)];
    }
  }

  return merged;
}

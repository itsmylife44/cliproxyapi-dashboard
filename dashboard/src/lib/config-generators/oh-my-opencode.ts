import {
  canonicalizeCategories,
  type OhMyOpenCodeFullConfig,
  type OhMyOpenCodePreset,
} from "./oh-my-opencode-types";
import { OMO_SCHEMA_URL } from "./upstream/plugins";

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

// Mirrors upstream 5.1.33 packages/model-core/src/{agent,category}-model-requirements.ts (model ids
// only, exact duplicates removed; providers and per-rung reasoning are dropped). `minimax-m3` and
// `MiniMax-M3` are distinct upstream ids (different providers), so both stay.
export const UPSTREAM_AGENT_CHAINS: Record<string, string[]> = {
  sisyphus: ["claude-opus-5-5", "kimi-k3", "gpt-5.6-sol", "glm-5.2", "big-pickle"],
  hephaestus: ["gpt-6-sol", "gpt-5.6-sol"],
  oracle: ["gpt-5.6-sol", "gemini-3.1-pro", "claude-opus-5-5", "glm-5.2"],
  prometheus: ["claude-fable-5-1", "claude-opus-5-5", "kimi-k3"],
  metis: ["claude-fable-5-1", "claude-opus-5-5", "kimi-k3"],
  momus: ["gpt-6-astra", "claude-opus-5-5", "gemini-3.1-pro", "glm-5.2"],
  atlas: ["claude-sonnet-5", "kimi-k3", "gpt-5.6-sol", "minimax-m3", "MiniMax-M3", "minimax-m2.7"],
  librarian: ["kimi-for-coding-highspeed", "gpt-6-luna-fast", "claude-haiku-5-5", "deepseek-flash", "qwen3.7-plus", "minimax-m2.7"],
  explore: ["kimi-for-coding-highspeed", "gpt-6-luna-fast", "claude-haiku-5-5", "deepseek-flash", "qwen3.7-plus", "minimax-m2.7"],
  "multimodal-looker": ["gpt-5.6-sol", "kimi-k3", "glm-4.6v", "gpt-5-nano"],
  "sisyphus-junior": ["claude-sonnet-5", "kimi-k3", "gpt-5.6-sol", "minimax-m3", "MiniMax-M3", "minimax-m2.7", "big-pickle"],
};

export const UPSTREAM_CATEGORY_CHAINS: Record<string, string[]> = {
  "visual-engineering": ["claude-fable-5-1", "claude-opus-5-5", "kimi-k3"],
  ultrabrain: ["gpt-6-astra", "gpt-5.6-sol"],
  "deep-low": ["gpt-6.1-sol", "gpt-6.1-sol-fast", "gpt-5.6-sol", "gpt-5.6-sol-fast"],
  "deep-high": ["gpt-6-astra"],
  artistry: ["claude-fable-5-1", "claude-opus-5-5", "kimi-k3"],
  quick: [
    "gpt-6-luna-fast", "claude-haiku-5-5", "deepseek-flash", "qwen3.6-flash", "minimax-m3", "minimax-m2.7",
    "grok-4.20-0309-non-reasoning", "glm-5.3-flash", "mimo-v2.6-flash",
  ],
  "unspecified-low": [
    "claude-sonnet-5-5", "mimo-v2.6-pro", "grok-4.7", "gpt-6.1-sol", "gpt-5.6-sol", "claude-sonnet-5",
    "qwen3.8-max-preview", "deepseek-v4-pro", "mimo-v2.5-pro",
  ],
  "unspecified-high": ["claude-opus-5-5", "glm-5.3", "kimi-k3"],
  writing: ["claude-opus-5-5", "claude-opus-4-6"],
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
  "deep-low": { tier: 1, label: "Deep problem solving" },
  "deep-high": { tier: 1, label: "Deep problem solving (escalation)" },
  artistry: { tier: 4, label: "Creative work" },
  quick: { tier: 3, label: "Trivial tasks" },
  "unspecified-low": { tier: 2, label: "Low effort general" },
  "unspecified-high": { tier: 1, label: "High effort general" },
  writing: { tier: 3, label: "Documentation" },
};

type ModelRef = string | { model: string; reasoning?: string; temperature?: number };

interface ModelAssignment {
  model?: string;
  models?: ModelRef[];
  reasoning?: string;
  temperature?: number;
  prompt_append?: string;
  description?: string;
  permission?: { edit?: string; bash?: unknown };
  providerOptions?: Record<string, unknown>;
  ultrawork?: { model?: string; reasoning?: string };
}

const withProvider = (model: string) => `cliproxyapi/${model}`;

/** Primary model and ordered fallbacks (unprefixed) for one chain and its stored override. */
function resolveAssignment(
  chain: string[],
  availableModels: string[],
  override: { model?: string; fallback_models?: string[] } | undefined,
): ChainResolution {
  let resolved: ChainResolution;
  if (override?.model && availableModels.includes(override.model)) {
    const overrideIndex = chain.indexOf(override.model);
    resolved = {
      model: override.model,
      fallbackModels: overrideIndex >= 0
        ? chain.slice(overrideIndex + 1).filter((m) => availableModels.includes(m))
        : [],
    };
  } else {
    const resolution = resolveChain(chain, availableModels);
    // No chain model available — still emit the first chain model as the intended model
    resolved = resolution ?? { model: chain[0]!, fallbackModels: [] };
  }
  if (override?.fallback_models?.length) {
    resolved = { ...resolved, fallbackModels: override.fallback_models.filter((m) => availableModels.includes(m)) };
  }
  return resolved;
}

/**
 * OMO 5.x model fields: a single `model`, or `models: [primary, ...fallbacks]` (upstream's replacement for
 * `fallback_models`). With `models`, upstream takes per-model settings from the primary rung and drops the
 * entry-level ones, so `primarySettings` move onto that rung.
 */
function modelFields(
  { model, fallbackModels }: ChainResolution,
  primarySettings: { reasoning?: string; temperature?: number },
): Pick<ModelAssignment, "model" | "models" | "reasoning" | "temperature"> {
  const settings = Object.fromEntries(Object.entries(primarySettings).filter(([, v]) => v !== undefined));
  if (fallbackModels.length === 0) return { model: withProvider(model), ...settings };
  const primary = Object.keys(settings).length > 0 ? { model: withProvider(model), ...settings } : withProvider(model);
  return { models: [primary, ...fallbackModels.map(withProvider)] };
}

export function buildOhMyOpenCodeConfig(
  availableModels: string[],
  overrides?: OhMyOpenCodeFullConfig,
): Record<string, unknown> | null {
  const agents: Record<string, ModelAssignment> = {};

  for (const [agent, chain] of Object.entries(UPSTREAM_AGENT_CHAINS)) {
    const agentOverride = overrides?.agents?.[agent];
    const entry: ModelAssignment = modelFields(resolveAssignment(chain, availableModels, agentOverride), {
      reasoning: agentOverride?.reasoning,
      temperature: agentOverride?.temperature,
    });

    if (agentOverride?.prompt_append) entry.prompt_append = agentOverride.prompt_append;
    if (agentOverride?.permission) entry.permission = agentOverride.permission;
    if (agentOverride?.providerOptions) entry.providerOptions = agentOverride.providerOptions;
    if (agentOverride?.ultrawork) {
      const ultrawork = { ...agentOverride.ultrawork };
      if (ultrawork.model) {
        if (availableModels.includes(ultrawork.model)) {
          ultrawork.model = withProvider(ultrawork.model);
        } else {
          delete ultrawork.model;
        }
      }
      entry.ultrawork = ultrawork;
    }
    agents[agent] = entry;
  }

  const categories: Record<string, ModelAssignment> = {};
  const categoryOverrides = canonicalizeCategories(overrides?.categories);

  for (const [category, chain] of Object.entries(UPSTREAM_CATEGORY_CHAINS)) {
    const categoryOverride = categoryOverrides?.[category];
    // Upstream applies a category's temperature from the entry, so only reasoning rides on the primary rung.
    const entry: ModelAssignment = modelFields(resolveAssignment(chain, availableModels, categoryOverride), {
      reasoning: categoryOverride?.reasoning,
    });

    if (categoryOverride?.temperature !== undefined) entry.temperature = categoryOverride.temperature;
    if (categoryOverride?.description) entry.description = categoryOverride.description;
    categories[category] = entry;
  }

  if (Object.keys(agents).length === 0 && Object.keys(categories).length === 0) {
    return null;
  }

  const config: Record<string, unknown> = {
    $schema: OMO_SCHEMA_URL,
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
      ...canonicalizeCategories(existingOverrides?.categories),
      ...canonicalizeCategories(presetConfig.categories),
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

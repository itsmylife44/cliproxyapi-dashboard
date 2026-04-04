import type { OhMyOpenCodeFullConfig } from "./oh-my-opencode-types";

export type { OAuthAccount, ConfigData } from "./shared";
export { OFFICIAL_PRESETS, type OhMyOpenCodePreset } from "./oh-my-opencode-types";

// ---------------------------------------------------------------------------
// Dynamic model scoring & tier building
// ---------------------------------------------------------------------------
// Instead of hardcoding model IDs, we score each model from the proxy based
// on patterns in the ID and sort them into quality tiers dynamically.
// This ensures new models added to the proxy are automatically ranked.
// ---------------------------------------------------------------------------

/** Higher score = better/more capable model. */
function scoreModel(id: string): number {
  let score = 0;

  // --- Family bonus (base capability) ---
  if (id.includes("opus"))        score += 1000;
  else if (id.includes("sonnet")) score += 600;
  else if (id.includes("haiku"))  score += 200;
  else if (id.includes("pro"))    score += 500;
  else if (id.includes("flash"))  score += 250;

  // --- Codex bonus (reasoning-enhanced) ---
  if (id.includes("codex-max"))       score += 400;
  else if (id.includes("codex-mini")) score += 50;
  else if (id.includes("codex"))      score += 300;

  // --- Thinking bonus ---
  if (id.includes("thinking")) score += 150;

  // --- GPT version parsing (gpt-5, gpt-5.1, gpt-5.2, gpt-5.3) ---
  const gptMatch = id.match(/gpt-(\d+(?:\.\d+)?)/);
  if (gptMatch) {
    const ver = parseFloat(gptMatch[1]);
    score += ver * 80; // gpt-5 = 400, gpt-5.1 = 408, gpt-5.2 = 416, gpt-5.3 = 424
  }

  // --- Gemini version parsing (gemini-2.5, gemini-3) ---
  const geminiMatch = id.match(/gemini-(\d+(?:\.\d+)?)/);
  if (geminiMatch) {
    const ver = parseFloat(geminiMatch[1]);
    score += ver * 60; // gemini-2.5 = 150, gemini-3 = 180
  }

  // --- Claude version bonus (higher opus/sonnet version = better) ---
  // claude-opus-4-6 > claude-opus-4-5 > claude-opus-4
  const claudeVerMatch = id.match(/claude-(?:opus|sonnet|haiku)-(\d+)-?(\d+)?/);
  if (claudeVerMatch) {
    const major = parseInt(claudeVerMatch[1], 10);
    const minor = claudeVerMatch[2] ? parseInt(claudeVerMatch[2], 10) : 0;
    score += major * 20 + minor * 2;
  }

  // --- Image model bonus (for visual-engineering tier) ---
  if (id.includes("image")) score += 10;

  // --- Gemini-Claude hybrid bonus (cross-provider, often very capable) ---
  if (id.startsWith("gemini-claude")) score += 50;

  return score;
}

/** Sort models by score descending. */
function rankModels(modelIds: string[]): string[] {
  return [...modelIds].sort((a, b) => scoreModel(b) - scoreModel(a));
}

export interface DynamicTiers {
  tier1: string[]; // Top: orchestrators, planners, hard logic
  tier2: string[]; // Mid: consultants, reviewers, research
  tier3: string[]; // Fast/cheap: exploration, quick tasks, writing
  tier4: string[]; // Visual/creative: pro + image models first, then mid-tier
}

/**
 * Build 4 dynamic tiers from the available proxy models.
 *
 * Tier 1: Top third by score (best models for orchestrators, hard logic)
 * Tier 2: Top two-thirds by score (good models for mid-level agents)
 * Tier 3: Cheap/fast models first, then rest ascending by score
 * Tier 4: Visual/creative (pro + image) models first, then mid-tier fallback
 */
export function buildTiers(availableModels: string[]): DynamicTiers {
  if (availableModels.length === 0) {
    return { tier1: [], tier2: [], tier3: [], tier4: [] };
  }

  const ranked = rankModels(availableModels);

  // Tier 1: top third
  const t1Count = Math.max(1, Math.ceil(ranked.length / 3));
  const tier1 = ranked.slice(0, t1Count);

  // Tier 2: top two-thirds
  const t2Count = Math.max(1, Math.ceil((ranked.length * 2) / 3));
  const tier2 = ranked.slice(0, t2Count);

  // Tier 3: fast/cheap models first, then everything sorted by score ascending
  const cheapPatterns = ["haiku", "flash", "mini", "lite", "nano"];
  const isCheap = (id: string) => cheapPatterns.some((p) => id.includes(p));
  const cheapModels = ranked.filter((id) => isCheap(id));
  const nonCheapByScoreAsc = ranked.filter((id) => !isCheap(id)).reverse();
  const tier3 = [...cheapModels, ...nonCheapByScoreAsc];

  // Tier 4: visual/creative — pro & image models first, then mid-tier fallback
  const visualPatterns = ["pro", "image"];
  const isVisual = (id: string) => visualPatterns.some((p) => id.includes(p));
  const visualModels = ranked.filter((id) => isVisual(id));
  const nonVisual = ranked.filter((id) => !isVisual(id));
  const tier4 = [...visualModels, ...nonVisual];

  return { tier1, tier2, tier3, tier4 };
}

export type TierLevel = 1 | 2 | 3 | 4;

export function pickBestModel(availableModels: string[], tierLevel: TierLevel): string | null {
  const tiers = buildTiers(availableModels);
  const tierList = tierLevel === 1 ? tiers.tier1
    : tierLevel === 2 ? tiers.tier2
    : tierLevel === 3 ? tiers.tier3
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
  overrides?: OhMyOpenCodeFullConfig
): Record<string, unknown> | null {
  const agents: Record<string, ModelAssignment> = {};
  for (const [agent, role] of Object.entries(AGENT_ROLES)) {
    const agentOverride = overrides?.agents?.[agent];
    const overrideModel = agentOverride?.model;
    let entry: ModelAssignment;
    if (overrideModel && availableModels.includes(overrideModel)) {
      entry = { model: `cliproxyapi/${overrideModel}` };
    } else {
      const model = pickBestModel(availableModels, role.tier);
      if (!model) continue;
      entry = { model: `cliproxyapi/${model}` };
    }
    if (agentOverride?.variant) entry.variant = agentOverride.variant;
    if (agentOverride?.temperature !== undefined) entry.temperature = agentOverride.temperature;
    if (agentOverride?.prompt_append) entry.prompt_append = agentOverride.prompt_append;
    if (agentOverride?.fallback_models?.length) {
      entry.fallback_models = agentOverride.fallback_models
        .filter(m => availableModels.includes(m))
        .map(m => `cliproxyapi/${m}`);
      if (entry.fallback_models.length === 0) delete entry.fallback_models;
    }
    if (agentOverride?.permission) entry.permission = agentOverride.permission;
    if (agentOverride?.thinking) entry.thinking = agentOverride.thinking;
    if (agentOverride?.ultrawork) entry.ultrawork = agentOverride.ultrawork;
    agents[agent] = entry;
  }

  const categories: Record<string, ModelAssignment> = {};
  for (const [category, role] of Object.entries(CATEGORY_ROLES)) {
    const categoryOverride = overrides?.categories?.[category];
    const overrideModel = categoryOverride?.model;
    let entry: ModelAssignment;
    if (overrideModel && availableModels.includes(overrideModel)) {
      entry = { model: `cliproxyapi/${overrideModel}` };
    } else {
      const model = pickBestModel(availableModels, role.tier);
      if (!model) continue;
      entry = { model: `cliproxyapi/${model}` };
    }
    if (categoryOverride?.variant) entry.variant = categoryOverride.variant;
    if (categoryOverride?.temperature !== undefined) entry.temperature = categoryOverride.temperature;
    if (categoryOverride?.description) entry.description = categoryOverride.description;
    if (categoryOverride?.fallback_models?.length) {
      entry.fallback_models = categoryOverride.fallback_models
        .filter(m => availableModels.includes(m))
        .map(m => `cliproxyapi/${m}`);
      if (entry.fallback_models.length === 0) delete entry.fallback_models;
    }
    categories[category] = entry;
  }

  if (Object.keys(agents).length === 0 && Object.keys(categories).length === 0) {
    return null;
  }

  const config: Record<string, unknown> = {
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json",
  };

  if (Object.keys(agents).length > 0) {
    config.agents = agents;
  }
  if (Object.keys(categories).length > 0) {
    config.categories = categories;
  }

  config.auto_update = false;

  // Disabled arrays — only include if non-empty
  if (overrides?.disabled_agents?.length) config.disabled_agents = overrides.disabled_agents;
  if (overrides?.disabled_skills?.length) config.disabled_skills = overrides.disabled_skills;
  if (overrides?.disabled_hooks?.length) config.disabled_hooks = overrides.disabled_hooks;
  if (overrides?.disabled_commands?.length) config.disabled_commands = overrides.disabled_commands;
  if (overrides?.disabled_mcps?.length) config.disabled_mcps = overrides.disabled_mcps;

  // Tmux — merge with defaults (same pattern as sisyphus_agent, git_master, etc.)
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

  // Background task — merge user overrides with defaults
  config.background_task = { defaultConcurrency: 5, ...overrides?.background_task };

  // Browser automation — only if configured
  if (overrides?.browser_automation_engine) config.browser_automation_engine = overrides.browser_automation_engine;

  // Sisyphus agent — merge with defaults
  config.sisyphus_agent = { planner_enabled: true, replace_plan: true, ...overrides?.sisyphus_agent };

  // Git master — merge with defaults
  config.git_master = { commit_footer: false, include_co_authored_by: false, ...overrides?.git_master };

  // LSP — only if configured
  if (overrides?.lsp && Object.keys(overrides.lsp).length > 0) {
    config.lsp = overrides.lsp;
  }

  // Hashline edit — enable hash-anchored edit tool
  if (overrides?.hashline_edit !== undefined) config.hashline_edit = overrides.hashline_edit;

  // Experimental features
  if (overrides?.experimental && Object.keys(overrides.experimental).length > 0) {
    config.experimental = overrides.experimental;
  }

  return config;
}

import type { OhMyOpenCodePreset } from "./oh-my-opencode-types";

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
    background_task: {
      ...existingOverrides?.background_task,
      ...presetConfig.background_task,
      providerConcurrency: {
        ...existingOverrides?.background_task?.providerConcurrency,
        ...presetConfig.background_task?.providerConcurrency,
      },
      modelConcurrency: {
        ...existingOverrides?.background_task?.modelConcurrency,
        ...presetConfig.background_task?.modelConcurrency,
      },
    },
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

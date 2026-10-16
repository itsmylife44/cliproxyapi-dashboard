/**
 * Oh-My-OpenCode-Slim Configuration Generator
 *
 * Generates oh-my-opencode-slim plugin configs with the full presets system.
 * Supports named presets, multiplexer, interview, provider-specific options and council.
 * Keys slim 3.x removed are never emitted, even if still stored.
 *
 * @see https://github.com/alvinunreal/oh-my-opencode-slim
 */

import {
  buildTiers,
  pickBestModel,
  type TierLevel,
} from "./oh-my-opencode";
import { SLIM_SCHEMA_URL } from "./upstream/plugins";
import {
  SLIM_AGENTS,
  SLIM_PASSTHROUGH_KEYS,
  toUpstreamNames,
  type OhMyOpenCodeSlimFullConfig,
  type SlimAgentConfig,
  type SlimModelConfig,
  type SlimModelEntry,
} from "./oh-my-opencode-slim-types";

export type { ConfigData, OAuthAccount } from "./shared";

// ---------------------------------------------------------------------------
// Slim agent roles — 7 agents mapped to the shared 4-tier system
// ---------------------------------------------------------------------------

export const SLIM_AGENT_ROLES: Record<string, { tier: TierLevel; label: string; defaultVariant?: string }> = {
  orchestrator: { tier: 1, label: "Master delegator", defaultVariant: "high" },
  oracle:       { tier: 1, label: "Strategic advisor", defaultVariant: "high" },
  council:      { tier: 1, label: "Multi-LLM consensus" },
  designer:     { tier: 4, label: "UI/UX implementation", defaultVariant: "medium" },
  explorer:     { tier: 3, label: "Codebase reconnaissance", defaultVariant: "low" },
  librarian:    { tier: 2, label: "External knowledge", defaultVariant: "low" },
  fixer:        { tier: 3, label: "Fast implementation", defaultVariant: "low" },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Prefix a model ID with cliproxyapi/ if it's in the available models list.
 * Returns the original model ID if not available (external model).
 */
function prefixModel(model: string, availableModels: string[]): string {
  return availableModels.includes(model) ? `cliproxyapi/${model}` : model;
}

/**
 * Process a model config (string or array) and prefix available models.
 * External models (not in availableModels) are kept as-is.
 */
function processModelConfig(
  modelConfig: SlimModelConfig,
  availableModels: string[],
): SlimModelConfig {
  // Simple string model
  if (typeof modelConfig === "string") {
    return prefixModel(modelConfig, availableModels);
  }
  
  // Array of models
  return modelConfig.map((item): string | SlimModelEntry => {
    if (typeof item === "string") {
      return prefixModel(item, availableModels);
    }
    // Object with id and optional variant
    return {
      id: prefixModel(item.id, availableModels),
      ...(item.variant !== undefined && { variant: item.variant }),
    };
  });
}

/**
 * Build an agent config entry with proper model prefixing and defaults.
 * 
 * Model resolution priority:
 * 1. If override.model is provided → process and prefix if available
 * 2. If override.inheritModelFrom is set → no model and no default variant (upstream inherits)
 * 3. Otherwise → pick best model from availableModels based on tier
 *
 * Supports both string and array model configurations.
 * Returns null if no model can be picked for a non-inheriting agent without a model override.
 */
function buildAgentEntry(
  agent: string,
  availableModels: string[],
  override?: SlimAgentConfig,
): SlimAgentConfig | null {
  const role = SLIM_AGENT_ROLES[agent];
  const overrideModel = override?.model;

  // Upstream lets a scalar model beat inheritance, so an inheriting agent gets no auto-pick or default variant.
  if (override?.inheritModelFrom !== undefined && overrideModel === undefined) {
    return copyAgentFields(override, availableModels);
  }

  let model: SlimModelConfig;
  if (overrideModel !== undefined) {
    // User specified a model override — process it
    model = processModelConfig(overrideModel, availableModels);
  } else {
    // No override → pick best from available models
    const picked = pickBestModel(availableModels, role?.tier ?? 3);
    if (!picked) {
      // No model available and no override — cannot build valid entry
      return null;
    }
    model = `cliproxyapi/${picked}`;
  }

  const entry: SlimAgentConfig = { model, ...(override && copyAgentFields(override, availableModels)) };

  // Default variant from role unless the user set one (even an empty one)
  if (entry.variant === undefined && role?.defaultVariant) entry.variant = role.defaultVariant;

  return entry;
}

/** Agent fields emitted exactly as stored. */
const AGENT_PASSTHROUGH_FIELDS = [
  "temperature",
  "variant",
  "inheritModelFrom",
  "skills_add",
  "skills_remove",
  "skills_include_local",
  "prompt",
  "orchestratorPrompt",
  "displayName",
  "color",
  "description",
  "permission",
] as const satisfies readonly (keyof SlimAgentConfig)[];

/** Copies the fields the user set: models prefixed, renamed skills/MCPs translated, empty options dropped. */
function copyAgentFields(override: SlimAgentConfig, availableModels: string[]): SlimAgentConfig {
  const entry: Record<string, unknown> = {};
  if (override.model !== undefined) entry.model = processModelConfig(override.model, availableModels);
  for (const field of AGENT_PASSTHROUGH_FIELDS) {
    if (override[field] !== undefined) entry[field] = override[field];
  }
  // Skills/MCPs — only what the user set (even an empty array); otherwise upstream defaults apply
  if (override.skills !== undefined) entry.skills = toUpstreamNames(override.skills);
  if (override.mcps !== undefined) entry.mcps = toUpstreamNames(override.mcps);
  if (override.options && Object.keys(override.options).length > 0) entry.options = override.options;
  return entry as SlimAgentConfig;
}

function normalizeExplicitAgentConfig(
  agentKey: string,
  override: SlimAgentConfig | string | undefined,
  availableModels: string[],
): SlimAgentConfig | null {
  // Upstream removed `council-master` (1.0.0); emitting it would register a bogus custom subagent.
  if (typeof override !== "object" || agentKey === "council-master") return null;

  const entry = copyAgentFields(override, availableModels);
  return Object.keys(entry).length > 0 ? entry : null;
}

/**
 * Slim 2.0.2 removed `fallback.chains`; an agent's array `model` is now its fallback chain.
 * Folds each stored chain into the matching agent's model as `[primary, ...chain]`, deduped by id.
 * An inheriting agent without a model gets the chain alone (upstream follows the inherited model and
 * uses the array as its fallback); other agents without an emitted model are skipped.
 */
function foldFallbackChains(
  agents: Record<string, SlimAgentConfig>,
  chains: Record<string, string[]>,
  availableModels: string[],
): void {
  for (const [agent, chain] of Object.entries(chains)) {
    const entry = agents[agent];
    if (entry === undefined) continue;
    if (entry.model === undefined && (entry.inheritModelFrom === undefined || chain.length === 0)) continue;
    const seen = new Set<string>();
    const primary = [entry.model ?? []].flat();
    entry.model = [...primary, ...chain.map((m) => prefixModel(m, availableModels))].filter((item) => {
      const id = typeof item === "string" ? item : item.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Main config builder
// ---------------------------------------------------------------------------

const DEFAULT_PRESET_NAME = "cliproxyapi";

export interface BuildSlimConfigOptions {
  /** Name of the preset to generate (default: "cliproxyapi") */
  presetName?: string;
  /** Whether to use presets structure (true) or legacy agents (false) */
  usePresets?: boolean;
}

/**
 * Build a complete oh-my-opencode-slim configuration.
 *
 * By default, generates a presets-based config (the modern approach).
 * Set usePresets: false for legacy agents-only config.
 * 
 * Returns null if no valid config can be built (e.g., no available models).
 */
export function buildSlimConfig(
  availableModels: string[],
  overrides?: OhMyOpenCodeSlimFullConfig,
  options?: BuildSlimConfigOptions,
): Record<string, unknown> | null {
  const { presetName: optionsPresetName = DEFAULT_PRESET_NAME, usePresets = true } = options ?? {};

  // Active preset selection: overrides.preset first, then options.presetName, then "cliproxyapi"
  const activePresetName = overrides?.preset ?? optionsPresetName;
  // A model array is always a live chain upstream, so a disabled fallback must not fold its chains in.
  const chains = overrides?.fallback?.enabled === false ? {} : overrides?.fallback?.chains ?? {};

  // Build the config object
  const config: Record<string, unknown> = {
    $schema: SLIM_SCHEMA_URL,
  };

  if (usePresets) {
    const presets: Record<string, Record<string, unknown>> = Object.create(null);
    const explicitPresets = overrides?.presets ?? {};
    const presetNames = new Set<string>([activePresetName, ...Object.keys(explicitPresets)]);
    // The default preset exists in the dashboard even when never stored; slim rejects a missing parent.
    if (Object.values(explicitPresets).some((preset) => preset.extends === DEFAULT_PRESET_NAME)) {
      presetNames.add(DEFAULT_PRESET_NAME);
    }

    for (const presetName of presetNames) {
      const presetOverride = explicitPresets[presetName];
      const presetOut: Record<string, SlimAgentConfig> = Object.create(null);
      const extendsPreset = presetOverride?.extends;

      // Auto-assign the 7 primary agents for every dashboard-managed preset. An extending preset
      // only carries what the user set; everything else is inherited upstream.
      for (const agent of extendsPreset === undefined ? SLIM_AGENTS : []) {
        const presetAgentOverride = presetOverride?.agents[agent];
        const rootModelFallback =
          availableModels.length === 0 && presetAgentOverride?.model === undefined
            ? overrides?.agents?.[agent]
            : undefined;
        const entry = buildAgentEntry(
          agent,
          availableModels,
          rootModelFallback ? { ...rootModelFallback, ...presetAgentOverride } : presetAgentOverride,
        );
        if (entry === null) {
          return null;
        }
        presetOut[agent] = entry;
      }

      // Preserve explicitly configured advanced agents without inventing defaults for them.
      for (const [agentKey, agentConfig] of Object.entries(presetOverride?.agents ?? {})) {
        if (extendsPreset === undefined && SLIM_AGENTS.includes(agentKey as typeof SLIM_AGENTS[number])) continue;
        const normalized = normalizeExplicitAgentConfig(agentKey, agentConfig, availableModels);
        if (normalized) {
          presetOut[agentKey] = normalized;
        }
      }

      foldFallbackChains(presetOut, chains, availableModels);
      presets[presetName] = extendsPreset === undefined ? presetOut : { extends: extendsPreset, ...presetOut };
    }

    config.preset = activePresetName;
    config.presets = presets;

    // Emit root agents separately as global overrides (upstream loader merges these over presets).
    if (overrides?.agents && Object.keys(overrides.agents).length > 0) {
      const rootAgents: Record<string, SlimAgentConfig> = Object.create(null);
      for (const [agentKey, agentConfig] of Object.entries(overrides.agents)) {
        const normalized = normalizeExplicitAgentConfig(agentKey, agentConfig, availableModels);
        if (normalized) {
          rootAgents[agentKey] = normalized;
        }
      }
      if (Object.keys(rootAgents).length > 0) {
        foldFallbackChains(rootAgents, chains, availableModels);
        config.agents = rootAgents;
      }
    }
  } else {
    const explicitAgents = overrides?.agents ?? {};
    const generatedAgents: Record<string, SlimAgentConfig> = Object.create(null);

    for (const agent of SLIM_AGENTS) {
      const entry = buildAgentEntry(agent, availableModels, explicitAgents[agent]);
      if (entry === null) {
        return null;
      }
      generatedAgents[agent] = entry;
    }

    for (const [agentKey, agentConfig] of Object.entries(explicitAgents)) {
      if (SLIM_AGENTS.includes(agentKey as typeof SLIM_AGENTS[number])) continue;
      const normalized = normalizeExplicitAgentConfig(agentKey, agentConfig, availableModels);
      if (normalized) {
        generatedAgents[agentKey] = normalized;
      }
    }

    foldFallbackChains(generatedAgents, chains, availableModels);
    config.agents = generatedAgents;
    if (overrides?.preset) config.preset = overrides.preset;
  }

  // Scalar settings
  if (overrides?.setDefaultAgent !== undefined) config.setDefaultAgent = overrides.setDefaultAgent;

  // Disabled MCPs
  if (overrides?.disabled_mcps?.length) config.disabled_mcps = overrides.disabled_mcps;

  // Disabled agents
  if (overrides?.disabled_agents?.length) config.disabled_agents = overrides.disabled_agents;

  // Multiplexer
  if (overrides?.multiplexer) {
    config.multiplexer = {
      type: "auto",
      layout: "main-vertical",
      main_pane_size: 60,
      ...overrides.multiplexer,
    };
  }

  // Fallback — `chains` are folded into agent models above. Slim's `fallback` is strict, so only
  // emit keys it still accepts (timeoutMs / retry_on_empty were removed upstream).
  if (overrides?.fallback) {
    const { enabled = true, retryDelayMs = 500, maxRetries } = overrides.fallback;
    config.fallback = { enabled, retryDelayMs, ...(maxRetries !== undefined && { maxRetries }) };
  }

  // Newer upstream keys the dashboard only stores (validated by validateSlimConfig)
  for (const key of SLIM_PASSTHROUGH_KEYS) {
    if (overrides?.[key] !== undefined) config[key] = overrides[key];
  }

  // Council — upstream requires `presets`; `master`, per-preset `master` and the timeout/fallback/
  // execution/retry scalars were removed (1.0.0–2.2.5), so they are not emitted.
  const councilPresets: Record<string, Record<string, Record<string, unknown>>> = Object.create(null);
  for (const [pName, preset] of Object.entries(overrides?.council?.presets ?? {})) {
    const presetOut: Record<string, Record<string, unknown>> = Object.create(null);
    for (const [cName, cConfig] of Object.entries(preset.councillors)) {
      presetOut[cName] = {
        model: prefixModel(cConfig.model, availableModels),
        ...(cConfig.variant !== undefined && { variant: cConfig.variant }),
        ...(cConfig.prompt !== undefined && { prompt: cConfig.prompt }),
      };
    }
    if (Object.keys(presetOut).length > 0) councilPresets[pName] = presetOut;
  }
  if (Object.keys(councilPresets).length > 0) {
    const defaultPreset = overrides?.council?.default_preset;
    config.council = {
      presets: councilPresets,
      ...(defaultPreset !== undefined && { default_preset: defaultPreset }),
    };
  }

  // Interview config
  if (overrides?.interview) {
    config.interview = {
      maxQuestions: 2,
      outputFolder: "interview",
      autoOpenBrowser: true,
      port: 0,
      ...overrides.interview,
    };
  }

  return config;
}

/**
 * The primary model slim resolves for `agent` in `presetName`, following `extends` through a
 * generated config. Undefined when the chain leaves the config (a parent defined only in a
 * project config), cycles, or ends in `inheritModelFrom` without a model.
 */
export function resolveInheritedModel(
  config: Record<string, unknown>,
  presetName: string,
  agent: string,
): string | undefined {
  const presets = config.presets as Record<string, Record<string, unknown>> | undefined;
  const seen = new Set<string>();
  let current: string | undefined = presetName;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const preset: Record<string, unknown> | undefined = presets?.[current];
    if (preset === undefined) return undefined;
    const entry = preset[agent] as SlimAgentConfig | undefined;
    if (entry?.model !== undefined) {
      const primary = [entry.model].flat()[0];
      return typeof primary === "string" ? primary : primary?.id;
    }
    if (entry?.inheritModelFrom !== undefined) return undefined;
    current = typeof preset.extends === "string" ? preset.extends : undefined;
  }
  return undefined;
}

// Re-export shared utilities needed by components
export { buildTiers, pickBestModel };
export { SLIM_AGENTS };

/**
 * Oh-My-OpenCode-Slim Configuration Generator
 *
 * Generates oh-my-opencode-slim plugin configs with the full presets system.
 * Supports named presets, multiplexer (tmux+zellij), interview, todoContinuation,
 * provider-specific options, and all council features.
 *
 * @see https://github.com/alvinunreal/oh-my-opencode-slim
 */

import {
  buildTiers,
  pickBestModel,
  type TierLevel,
} from "./oh-my-opencode";
import {
  SLIM_AGENTS,
  SLIM_DEFAULT_MCPS,
  SLIM_DEFAULT_SKILLS,
  SLIM_MANUAL_PLAN_AGENTS,
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
 * 2. If no override → pick best model from availableModels based on tier
 * 
 * Supports both string and array model configurations.
 * Returns null if no model can be resolved and no override is provided.
 */
function buildAgentEntry(
  agent: string,
  availableModels: string[],
  override?: SlimAgentConfig,
): SlimAgentConfig | null {
  const role = SLIM_AGENT_ROLES[agent];
  const overrideModel = override?.model;
  
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

  const entry: SlimAgentConfig = { model };

  // Apply variant — use override or default from role (use !== undefined for explicit empty)
  if (override?.variant !== undefined) {
    entry.variant = override.variant;
  } else if (role?.defaultVariant) {
    entry.variant = role.defaultVariant;
  }

  // Apply other overrides
  if (override?.temperature !== undefined) entry.temperature = override.temperature;
  
  // Skills — use override if explicitly provided (even empty array), else defaults
  if (override?.skills !== undefined) {
    entry.skills = [...override.skills]; // Clone to prevent mutation
  } else if (SLIM_DEFAULT_SKILLS[agent as keyof typeof SLIM_DEFAULT_SKILLS]?.length) {
    entry.skills = [...SLIM_DEFAULT_SKILLS[agent as keyof typeof SLIM_DEFAULT_SKILLS]];
  }

  // MCPs — use override if explicitly provided (even empty array), else defaults
  if (override?.mcps !== undefined) {
    entry.mcps = [...override.mcps]; // Clone to prevent mutation
  } else if (SLIM_DEFAULT_MCPS[agent as keyof typeof SLIM_DEFAULT_MCPS]?.length) {
    entry.mcps = [...SLIM_DEFAULT_MCPS[agent as keyof typeof SLIM_DEFAULT_MCPS]];
  }

  // Provider-specific options
  if (override?.options && Object.keys(override.options).length > 0) {
    entry.options = override.options;
  }

  return entry;
}

function normalizeExplicitAgentConfig(
  override: SlimAgentConfig | undefined,
  availableModels: string[],
): SlimAgentConfig | null {
  if (!override) return null;

  const entry: SlimAgentConfig = {};

  if (override.model !== undefined) {
    entry.model = processModelConfig(override.model, availableModels);
  }
  if (override.temperature !== undefined) entry.temperature = override.temperature;
  if (override.variant !== undefined) entry.variant = override.variant;
  if (override.skills !== undefined) entry.skills = [...override.skills];
  if (override.mcps !== undefined) entry.mcps = [...override.mcps];
  if (override.options && Object.keys(override.options).length > 0) {
    entry.options = override.options;
  }

  return Object.keys(entry).length > 0 ? entry : null;
}

// ---------------------------------------------------------------------------
// Main config builder
// ---------------------------------------------------------------------------

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
  const { presetName: optionsPresetName = "cliproxyapi", usePresets = true } = options ?? {};

  // Active preset selection: overrides.preset first, then options.presetName, then "cliproxyapi"
  const activePresetName = overrides?.preset ?? optionsPresetName;

  // Build the config object
  const config: Record<string, unknown> = {
    $schema: "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json",
  };

  if (usePresets) {
    const presets: Record<string, Record<string, SlimAgentConfig>> = Object.create(null);
    const explicitPresets = overrides?.presets ?? {};
    const presetNames = new Set<string>([activePresetName, ...Object.keys(explicitPresets)]);

    for (const presetName of presetNames) {
      const presetOverride = explicitPresets[presetName];
      const presetOut: Record<string, SlimAgentConfig> = Object.create(null);

      // Auto-assign the 7 primary agents for every dashboard-managed preset.
      for (const agent of SLIM_AGENTS) {
        const presetAgentOverride = presetOverride?.[agent];
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
      for (const [agentKey, agentConfig] of Object.entries(presetOverride ?? {})) {
        if (SLIM_AGENTS.includes(agentKey as typeof SLIM_AGENTS[number])) continue;
        const normalized = normalizeExplicitAgentConfig(agentConfig, availableModels);
        if (normalized) {
          presetOut[agentKey] = normalized;
        }
      }

      presets[presetName] = presetOut;
    }

    config.preset = activePresetName;
    config.presets = presets;

    // Emit root agents separately as global overrides (upstream loader merges these over presets).
    if (overrides?.agents && Object.keys(overrides.agents).length > 0) {
      const rootAgents: Record<string, SlimAgentConfig> = Object.create(null);
      for (const [agentKey, agentConfig] of Object.entries(overrides.agents)) {
        const normalized = normalizeExplicitAgentConfig(agentConfig, availableModels);
        if (normalized) {
          rootAgents[agentKey] = normalized;
        }
      }
      if (Object.keys(rootAgents).length > 0) {
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
      const normalized = normalizeExplicitAgentConfig(agentConfig, availableModels);
      if (normalized) {
        generatedAgents[agentKey] = normalized;
      }
    }

    config.agents = generatedAgents;
    if (overrides?.preset) config.preset = overrides.preset;
  }

  // Scalar settings
  if (overrides?.setDefaultAgent !== undefined) config.setDefaultAgent = overrides.setDefaultAgent;
  if (overrides?.scoringEngineVersion) config.scoringEngineVersion = overrides.scoringEngineVersion;
  if (overrides?.balanceProviderUsage !== undefined) config.balanceProviderUsage = overrides.balanceProviderUsage;

  // Manual plan — passthrough external models, prefix available ones
  // Only valid for the 6 manual plan agents (excludes council)
  if (overrides?.manualPlan && Object.keys(overrides.manualPlan).length > 0) {
    const filteredPlan: Record<string, { primary: string; fallback1: string; fallback2: string; fallback3: string }> = {};
    for (const [agent, entry] of Object.entries(overrides.manualPlan)) {
      // Only include valid manual plan agents (excludes council)
      if (!(SLIM_MANUAL_PLAN_AGENTS as readonly string[]).includes(agent)) continue;
      filteredPlan[agent] = {
        primary: prefixModel(entry.primary, availableModels),
        fallback1: prefixModel(entry.fallback1, availableModels),
        fallback2: prefixModel(entry.fallback2, availableModels),
        fallback3: prefixModel(entry.fallback3, availableModels),
      };
    }
    if (Object.keys(filteredPlan).length > 0) {
      config.manualPlan = filteredPlan;
    }
  }

  // Disabled MCPs
  if (overrides?.disabled_mcps?.length) config.disabled_mcps = overrides.disabled_mcps;

  // Disabled agents
  if (overrides?.disabled_agents?.length) config.disabled_agents = overrides.disabled_agents;

  // Multiplexer (new unified config) — takes precedence over tmux
  if (overrides?.multiplexer) {
    config.multiplexer = {
      type: "auto",
      layout: "main-vertical",
      main_pane_size: 60,
      ...overrides.multiplexer,
    };
  } else if (overrides?.tmux) {
    // Legacy tmux config — convert to multiplexer
    config.multiplexer = {
      type: overrides.tmux.enabled ? "tmux" : "none",
      layout: overrides.tmux.layout ?? "main-vertical",
      main_pane_size: overrides.tmux.main_pane_size ?? 60,
    };
  }

  // Background
  if (overrides?.background) {
    config.background = { maxConcurrentStarts: 10, ...overrides.background };
  }

  // Fallback — build chains from available models if not explicitly set
  if (overrides?.fallback) {
    const { chains: rawChains, ...fallbackRest } = overrides.fallback;
    const fallback: Record<string, unknown> = {
      enabled: true,
      timeoutMs: 15000,
      retryDelayMs: 500,
      retry_on_empty: true,
      ...fallbackRest,
    };

    // Prefix chain models with cliproxyapi/ if available, passthrough external models
    if (rawChains) {
      const prefixedChains: Record<string, string[]> = {};
      for (const [agent, chain] of Object.entries(rawChains)) {
        const prefixed = chain.map((m) => prefixModel(m, availableModels));
        if (prefixed.length > 0) {
          prefixedChains[agent] = prefixed;
        }
      }
      if (Object.keys(prefixedChains).length > 0) {
        fallback.chains = prefixedChains;
      }
    }

    config.fallback = fallback;
  }

  // Council — prefix model IDs, validate availability
  if (overrides?.council) {
    const rawCouncil = overrides.council;
    const council: Record<string, unknown> = Object.create(null);

    // Master
    if (rawCouncil.master) {
      const master: Record<string, unknown> = Object.create(null);
      if (rawCouncil.master.model !== undefined) {
        master.model = prefixModel(rawCouncil.master.model, availableModels);
      }
      if (rawCouncil.master.variant !== undefined) master.variant = rawCouncil.master.variant;
      if (rawCouncil.master.prompt !== undefined) master.prompt = rawCouncil.master.prompt;
      if (Object.keys(master).length > 0) {
        council.master = master;
      }
    }

    // Council presets
    if (rawCouncil.presets && Object.keys(rawCouncil.presets).length > 0) {
      const presets: Record<string, Record<string, unknown>> = Object.create(null);
      for (const [pName, preset] of Object.entries(rawCouncil.presets)) {
        const presetOut: Record<string, unknown> = Object.create(null);
        for (const [cName, cConfig] of Object.entries(preset.councillors)) {
          const entry: Record<string, unknown> = Object.create(null);
          entry.model = prefixModel(cConfig.model, availableModels);
          if (cConfig.variant !== undefined) entry.variant = cConfig.variant;
          if (cConfig.prompt !== undefined) entry.prompt = cConfig.prompt;
          presetOut[cName] = entry;
        }
        if (preset.master) {
          const mo: Record<string, unknown> = Object.create(null);
          if (preset.master.model !== undefined) {
            mo.model = prefixModel(preset.master.model, availableModels);
          }
          if (preset.master.variant !== undefined) mo.variant = preset.master.variant;
          if (preset.master.prompt !== undefined) mo.prompt = preset.master.prompt;
          if (Object.keys(mo).length > 0) presetOut.master = mo;
        }
        if (Object.keys(presetOut).length > 0) presets[pName] = presetOut;
      }
      if (Object.keys(presets).length > 0) council.presets = presets;
    }

    // Scalar council fields
    if (rawCouncil.master_timeout !== undefined) council.master_timeout = rawCouncil.master_timeout;
    if (rawCouncil.councillors_timeout !== undefined) council.councillors_timeout = rawCouncil.councillors_timeout;
    if (rawCouncil.default_preset !== undefined) council.default_preset = rawCouncil.default_preset;
    if (rawCouncil.councillor_execution_mode !== undefined) council.councillor_execution_mode = rawCouncil.councillor_execution_mode;
    if (rawCouncil.councillor_retries !== undefined) council.councillor_retries = rawCouncil.councillor_retries;

    // Master fallback — prefix available models, passthrough external
    if (rawCouncil.master_fallback?.length) {
      const prefixed = rawCouncil.master_fallback.map((m) => prefixModel(m, availableModels));
      if (prefixed.length > 0) council.master_fallback = prefixed;
    }

    // Only emit council if it has both master AND presets (schema requirement)
    if (council.master && council.presets && Object.keys(council.presets).length > 0) {
      config.council = council;
    }
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

  // Todo continuation config
  if (overrides?.todoContinuation) {
    config.todoContinuation = {
      maxContinuations: 5,
      cooldownMs: 3000,
      autoEnable: false,
      autoEnableThreshold: 4,
      ...overrides.todoContinuation,
    };
  }

  // Websearch config
  if (overrides?.websearch) {
    config.websearch = { ...overrides.websearch };
  }

  return config;
}

// Re-export shared utilities needed by components
export { buildTiers, pickBestModel };
export { SLIM_AGENTS };

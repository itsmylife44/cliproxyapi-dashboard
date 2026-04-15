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
  type OhMyOpenCodeSlimFullConfig,
  type SlimAgentConfig,
  type SlimModelConfig,
  type SlimModelEntry,
  type SlimPreset,
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
      ...(item.variant && { variant: item.variant }),
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
 */
function buildAgentEntry(
  agent: string,
  availableModels: string[],
  override?: SlimAgentConfig,
): SlimAgentConfig {
  const role = SLIM_AGENT_ROLES[agent];
  const overrideModel = override?.model;
  
  let model: SlimModelConfig;
  if (overrideModel !== undefined) {
    // User specified a model override — process it
    model = processModelConfig(overrideModel, availableModels);
  } else {
    // No override → pick best from available models
    const picked = pickBestModel(availableModels, role?.tier ?? 3);
    model = picked ? `cliproxyapi/${picked}` : `cliproxyapi/unresolved-tier-${role?.tier ?? 3}`;
  }

  const entry: SlimAgentConfig = { model };

  // Apply variant — use override or default from role
  if (override?.variant) {
    entry.variant = override.variant;
  } else if (role?.defaultVariant) {
    entry.variant = role.defaultVariant;
  }

  // Apply other overrides
  if (override?.temperature !== undefined) entry.temperature = override.temperature;
  
  // Skills — use override or defaults
  if (override?.skills?.length) {
    entry.skills = override.skills;
  } else if (SLIM_DEFAULT_SKILLS[agent as keyof typeof SLIM_DEFAULT_SKILLS]?.length) {
    entry.skills = SLIM_DEFAULT_SKILLS[agent as keyof typeof SLIM_DEFAULT_SKILLS];
  }

  // MCPs — use override or defaults
  if (override?.mcps?.length) {
    entry.mcps = override.mcps;
  } else if (SLIM_DEFAULT_MCPS[agent as keyof typeof SLIM_DEFAULT_MCPS]?.length) {
    entry.mcps = SLIM_DEFAULT_MCPS[agent as keyof typeof SLIM_DEFAULT_MCPS];
  }

  // Provider-specific options
  if (override?.options && Object.keys(override.options).length > 0) {
    entry.options = override.options;
  }

  return entry;
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
 */
export function buildSlimConfig(
  availableModels: string[],
  overrides?: OhMyOpenCodeSlimFullConfig,
  options?: BuildSlimConfigOptions,
): Record<string, unknown> | null {
  const { presetName = "cliproxyapi", usePresets = true } = options ?? {};

  // Build agent configs
  const agentConfigs: Record<string, SlimAgentConfig> = {};
  for (const agent of SLIM_AGENTS) {
    // Check for preset overrides first, then legacy agents
    const presetOverride = overrides?.presets?.[presetName]?.[agent as keyof SlimPreset];
    const agentOverride = presetOverride ?? overrides?.agents?.[agent];
    agentConfigs[agent] = buildAgentEntry(agent, availableModels, agentOverride);
  }

  if (Object.keys(agentConfigs).length === 0) {
    return null;
  }

  // Build the config object
  const config: Record<string, unknown> = {
    $schema: "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json",
  };

  // Use presets structure (modern) or agents (legacy)
  if (usePresets) {
    config.preset = presetName;
    config.presets = {
      [presetName]: agentConfigs,
    };

    // Include any additional presets from overrides (with model prefixing)
    if (overrides?.presets) {
      for (const [name, preset] of Object.entries(overrides.presets)) {
        if (name === presetName) continue; // Already handled
        const presetOut: Record<string, SlimAgentConfig> = {};
        for (const [agentKey, agentConfig] of Object.entries(preset)) {
          if (!SLIM_AGENTS.includes(agentKey as typeof SLIM_AGENTS[number])) continue;
          presetOut[agentKey] = buildAgentEntry(agentKey, availableModels, agentConfig);
        }
        if (Object.keys(presetOut).length > 0) {
          (config.presets as Record<string, unknown>)[name] = presetOut;
        }
      }
    }
  } else {
    // Legacy mode: use agents directly
    config.agents = agentConfigs;
    if (overrides?.preset) config.preset = overrides.preset;
  }

  // Scalar settings
  if (overrides?.setDefaultAgent !== undefined) config.setDefaultAgent = overrides.setDefaultAgent;
  if (overrides?.scoringEngineVersion) config.scoringEngineVersion = overrides.scoringEngineVersion;
  if (overrides?.balanceProviderUsage !== undefined) config.balanceProviderUsage = overrides.balanceProviderUsage;

  // Manual plan — skip entries with unavailable models, prefix valid ones
  if (overrides?.manualPlan && Object.keys(overrides.manualPlan).length > 0) {
    const filteredPlan: Record<string, { primary: string; fallback1: string; fallback2: string; fallback3: string }> = {};
    for (const [agent, entry] of Object.entries(overrides.manualPlan)) {
      const allAvailable = [entry.primary, entry.fallback1, entry.fallback2, entry.fallback3]
        .every((m) => availableModels.includes(m));
      if (!allAvailable) continue;
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

    // Prefix chain models with cliproxyapi/ and drop chains with no available models
    if (rawChains) {
      const prefixedChains: Record<string, string[]> = {};
      for (const [agent, chain] of Object.entries(rawChains)) {
        const available = chain
          .filter((m) => availableModels.includes(m))
          .map((m) => prefixModel(m, availableModels));
        if (available.length > 0) {
          prefixedChains[agent] = available;
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
    const council: Record<string, unknown> = {};

    // Master
    if (rawCouncil.master?.model) {
      const master: Record<string, unknown> = {
        model: prefixModel(rawCouncil.master.model, availableModels),
      };
      if (rawCouncil.master.variant) master.variant = rawCouncil.master.variant;
      if (rawCouncil.master.prompt) master.prompt = rawCouncil.master.prompt;
      council.master = master;
    }

    // Council presets
    if (rawCouncil.presets && Object.keys(rawCouncil.presets).length > 0) {
      const presets: Record<string, Record<string, unknown>> = {};
      for (const [pName, preset] of Object.entries(rawCouncil.presets)) {
        const presetOut: Record<string, unknown> = {};
        for (const [cName, cConfig] of Object.entries(preset.councillors)) {
          const entry: Record<string, unknown> = {
            model: prefixModel(cConfig.model, availableModels),
          };
          if (cConfig.variant) entry.variant = cConfig.variant;
          if (cConfig.prompt) entry.prompt = cConfig.prompt;
          presetOut[cName] = entry;
        }
        if (preset.master) {
          const mo: Record<string, unknown> = {};
          if (preset.master.model) {
            mo.model = prefixModel(preset.master.model, availableModels);
          }
          if (preset.master.variant) mo.variant = preset.master.variant;
          if (preset.master.prompt) mo.prompt = preset.master.prompt;
          if (Object.keys(mo).length > 0) presetOut.master = mo;
        }
        if (Object.keys(presetOut).length > 0) presets[pName] = presetOut;
      }
      if (Object.keys(presets).length > 0) council.presets = presets;
    }

    // Scalar council fields
    if (rawCouncil.master_timeout !== undefined) council.master_timeout = rawCouncil.master_timeout;
    if (rawCouncil.councillors_timeout !== undefined) council.councillors_timeout = rawCouncil.councillors_timeout;
    if (rawCouncil.default_preset) council.default_preset = rawCouncil.default_preset;
    if (rawCouncil.councillor_execution_mode) council.councillor_execution_mode = rawCouncil.councillor_execution_mode;
    if (rawCouncil.councillor_retries !== undefined) council.councillor_retries = rawCouncil.councillor_retries;

    // Master fallback — prefix with cliproxyapi/
    if (rawCouncil.master_fallback?.length) {
      const prefixed = rawCouncil.master_fallback
        .filter((m) => availableModels.includes(m))
        .map((m) => prefixModel(m, availableModels));
      if (prefixed.length > 0) council.master_fallback = prefixed;
    }

    if (Object.keys(council).length > 0) config.council = council;
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

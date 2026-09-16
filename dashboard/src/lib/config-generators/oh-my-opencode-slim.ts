/**
 * Oh-My-OpenCode-Slim Configuration Generator
 *
 * Generates oh-my-opencode-slim plugin configs for the current stable schema.
 *
 * UPSTREAM PROVENANCE (verified 2026-09-16): see `SLIM_UPSTREAM` in
 * `oh-my-opencode-slim-types.ts`. The emitted field set is exactly the
 * top-level property set of the shipped schema at
 * https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json
 *
 * Fields removed upstream are never emitted; unknown fields present on the
 * stored overrides are carried through unchanged.
 *
 * @see https://github.com/alvinunreal/oh-my-opencode-slim
 * @see docs/upstream-opencode-integrations.md
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
  SLIM_KNOWN_TOP_LEVEL_KEYS,
  SLIM_UPSTREAM,
  migrateSlimLegacyConfig,
  type OhMyOpenCodeSlimFullConfig,
  type SlimAgentConfig,
  type SlimModelConfig,
  type SlimModelEntry,
  type SlimPreset,
} from "./oh-my-opencode-slim-types";

export type { ConfigData, OAuthAccount } from "./shared";

// ---------------------------------------------------------------------------
// Slim agent roles — grid agents mapped to the shared 4-tier system
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
 * Process a model config (string or ordered array) and prefix available models.
 * External models (not in availableModels) are kept as-is.
 *
 * The array order is the fallback order in the current schema.
 */
export function processSlimModelConfig(
  modelConfig: SlimModelConfig,
  availableModels: string[],
): SlimModelConfig {
  if (typeof modelConfig === "string") {
    return prefixModel(modelConfig, availableModels);
  }

  return modelConfig.map((item): string | SlimModelEntry => {
    if (typeof item === "string") {
      return prefixModel(item, availableModels);
    }
    return {
      id: prefixModel(item.id, availableModels),
      ...(item.variant !== undefined && { variant: item.variant }),
    };
  });
}

/** Copy the agent-level fields the dashboard models, prefixing models. */
function normalizeAgentConfig(
  override: SlimAgentConfig,
  availableModels: string[],
): SlimAgentConfig {
  const entry: SlimAgentConfig = {};

  if (override.model !== undefined) {
    entry.model = processSlimModelConfig(override.model, availableModels);
  }
  if (override.inheritModelFrom !== undefined) entry.inheritModelFrom = override.inheritModelFrom;
  if (override.variant !== undefined) entry.variant = override.variant;
  if (override.temperature !== undefined) entry.temperature = override.temperature;
  if (override.skills !== undefined) entry.skills = [...override.skills];
  if (override.skills_add !== undefined) entry.skills_add = [...override.skills_add];
  if (override.skills_remove !== undefined) entry.skills_remove = [...override.skills_remove];
  if (override.mcps !== undefined) entry.mcps = [...override.mcps];
  if (override.prompt !== undefined) entry.prompt = override.prompt;
  if (override.orchestratorPrompt !== undefined) entry.orchestratorPrompt = override.orchestratorPrompt;
  if (override.options && Object.keys(override.options).length > 0) entry.options = override.options;
  if (override.displayName !== undefined) entry.displayName = override.displayName;
  if (override.color !== undefined) entry.color = override.color;
  if (override.description !== undefined) entry.description = override.description;
  if (override.permission !== undefined) entry.permission = override.permission;

  // Unknown agent-level keys are deliberately NOT emitted: upstream declares
  // the per-agent object as `additionalProperties: false`, so copying them
  // would produce schema-invalid config. They stay in the stored dashboard
  // config (see `validateSlimConfig`) and are simply not generated.

  return entry;
}

/**
 * Build an agent config entry with proper model prefixing and defaults.
 *
 * Model resolution priority:
 * 1. explicit override model -> processed and prefixed when available
 * 2. otherwise -> best model for the agent's tier from availableModels
 *
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
    model = processSlimModelConfig(overrideModel, availableModels);
  } else {
    const picked = pickBestModel(availableModels, role?.tier ?? 3);
    if (!picked) return null;
    model = `cliproxyapi/${picked}`;
  }

  const entry: SlimAgentConfig = { model };

  if (override?.variant !== undefined) {
    entry.variant = override.variant;
  } else if (role?.defaultVariant) {
    entry.variant = role.defaultVariant;
  }

  if (override?.temperature !== undefined) entry.temperature = override.temperature;
  if (override?.inheritModelFrom !== undefined) entry.inheritModelFrom = override.inheritModelFrom;

  // Skills — explicit value wins (even an empty array), else upstream defaults.
  if (override?.skills !== undefined) {
    entry.skills = [...override.skills];
  } else if (SLIM_DEFAULT_SKILLS[agent as keyof typeof SLIM_DEFAULT_SKILLS]?.length) {
    entry.skills = [...SLIM_DEFAULT_SKILLS[agent as keyof typeof SLIM_DEFAULT_SKILLS]];
  }
  if (override?.skills_add !== undefined) entry.skills_add = [...override.skills_add];
  if (override?.skills_remove !== undefined) entry.skills_remove = [...override.skills_remove];

  // MCPs — explicit value wins (even an empty array), else upstream defaults.
  if (override?.mcps !== undefined) {
    entry.mcps = [...override.mcps];
  } else if (SLIM_DEFAULT_MCPS[agent as keyof typeof SLIM_DEFAULT_MCPS]?.length) {
    entry.mcps = [...SLIM_DEFAULT_MCPS[agent as keyof typeof SLIM_DEFAULT_MCPS]];
  }

  if (override?.prompt !== undefined) entry.prompt = override.prompt;
  if (override?.orchestratorPrompt !== undefined) entry.orchestratorPrompt = override.orchestratorPrompt;
  if (override?.options && Object.keys(override.options).length > 0) entry.options = override.options;
  if (override?.displayName !== undefined) entry.displayName = override.displayName;
  if (override?.color !== undefined) entry.color = override.color;
  if (override?.description !== undefined) entry.description = override.description;
  if (override?.permission !== undefined) entry.permission = override.permission;

  return entry;
}

/** Copy top-level fields the dashboard does not model, so they survive. */
function preservedUnknownFields(overrides: OhMyOpenCodeSlimFullConfig): Record<string, unknown> {
  const preserved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if ((SLIM_KNOWN_TOP_LEVEL_KEYS as readonly string[]).includes(key)) continue;
    preserved[key] = value;
  }
  return preserved;
}

// ---------------------------------------------------------------------------
// Main config builder
// ---------------------------------------------------------------------------

export interface BuildSlimConfigOptions {
  /** Name of the preset to generate (default: "cliproxyapi") */
  presetName?: string;
  /** Whether to use presets structure (true) or root-level agents (false) */
  usePresets?: boolean;
}

/**
 * Build a complete oh-my-opencode-slim configuration.
 *
 * By default, generates a presets-based config. Set `usePresets: false` for a
 * root-level `agents` config.
 *
 * Every emitted field exists in the current stable upstream schema. Fields
 * that upstream removed (fallback chains, council master, legacy tmux/scoring
 * sections) are never produced.
 *
 * Returns null if no valid config can be built (e.g. no available models).
 */
export function buildSlimConfig(
  availableModels: string[],
  overridesInput?: OhMyOpenCodeSlimFullConfig,
  options?: BuildSlimConfigOptions,
): Record<string, unknown> | null {
  const { presetName: optionsPresetName = "cliproxyapi", usePresets = true } = options ?? {};

  // Migrate first so legacy keys can never reach the output, even when the
  // caller passes an unvalidated object.
  const overrides = overridesInput
    ? (migrateSlimLegacyConfig(overridesInput) as OhMyOpenCodeSlimFullConfig)
    : undefined;

  const activePresetName = overrides?.preset ?? optionsPresetName;

  const config: Record<string, unknown> = {
    $schema: SLIM_UPSTREAM.schemaUrl,
    ...(overrides ? preservedUnknownFields(overrides) : {}),
  };

  if (usePresets) {
    const presets: Record<string, SlimPreset> = Object.create(null);
    const explicitPresets = overrides?.presets ?? {};
    const presetNames = new Set<string>([activePresetName, ...Object.keys(explicitPresets)]);

    for (const presetName of presetNames) {
      const presetOverride = explicitPresets[presetName];
      const presetOut: SlimPreset = Object.create(null);

      // Auto-assign the dashboard-managed agents for every managed preset.
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

      // Preserve explicitly configured non-grid agents without inventing defaults.
      for (const [agentKey, agentConfig] of Object.entries(presetOverride ?? {})) {
        if (SLIM_AGENTS.includes(agentKey as (typeof SLIM_AGENTS)[number])) continue;
        presetOut[agentKey] = normalizeAgentConfig(agentConfig, availableModels);
      }

      presets[presetName] = presetOut;
    }

    config.preset = activePresetName;
    config.presets = presets;

    // Emit root agents separately as global overrides (the upstream loader
    // merges these above the active preset at runtime).
    if (overrides?.agents && Object.keys(overrides.agents).length > 0) {
      const rootAgents: Record<string, SlimAgentConfig> = Object.create(null);
      for (const [agentKey, agentConfig] of Object.entries(overrides.agents)) {
        rootAgents[agentKey] = normalizeAgentConfig(agentConfig, availableModels);
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
      if (SLIM_AGENTS.includes(agentKey as (typeof SLIM_AGENTS)[number])) continue;
      generatedAgents[agentKey] = normalizeAgentConfig(agentConfig, availableModels);
    }

    config.agents = generatedAgents;
    if (overrides?.preset) config.preset = overrides.preset;
  }

  // Scalar settings
  if (overrides?.setDefaultAgent !== undefined) config.setDefaultAgent = overrides.setDefaultAgent;
  if (overrides?.compactSidebar !== undefined) config.compactSidebar = overrides.compactSidebar;
  if (overrides?.stripOrchestratorModel !== undefined) {
    config.stripOrchestratorModel = overrides.stripOrchestratorModel;
  }
  if (overrides?.autoUpdate !== undefined) config.autoUpdate = overrides.autoUpdate;
  if (overrides?.image_routing !== undefined) config.image_routing = overrides.image_routing;

  // Disabled lists
  if (overrides?.disabled_mcps?.length) config.disabled_mcps = overrides.disabled_mcps;
  if (overrides?.disabled_agents?.length) config.disabled_agents = overrides.disabled_agents;
  if (overrides?.disabled_tools?.length) config.disabled_tools = overrides.disabled_tools;
  if (overrides?.disabled_skills?.length) config.disabled_skills = overrides.disabled_skills;

  // Multiplexer — emit only the upstream fields, never legacy tmux keys.
  if (overrides?.multiplexer && Object.keys(overrides.multiplexer).length > 0) {
    const mux = overrides.multiplexer;
    config.multiplexer = {
      type: mux.type ?? "auto",
      layout: mux.layout ?? "main-vertical",
      main_pane_size: mux.main_pane_size ?? 60,
      ...(mux.zellij_pane_mode !== undefined && { zellij_pane_mode: mux.zellij_pane_mode }),
    };
  }

  // Background jobs
  if (overrides?.backgroundJobs) {
    config.backgroundJobs = { ...overrides.backgroundJobs };
  }

  // Fallback — emit only the four currently supported global fields.
  if (overrides?.fallback) {
    const fb = overrides.fallback;
    config.fallback = {
      enabled: fb.enabled ?? true,
      maxRetries: fb.maxRetries ?? 3,
      initialRetryDelayMs: fb.initialRetryDelayMs ?? 0,
      retryDelayMs: fb.retryDelayMs ?? 500,
    };
  }

  // Council — flat councillor names under each preset.
  if (overrides?.council) {
    const council: Record<string, unknown> = Object.create(null);

    if (overrides.council.presets && Object.keys(overrides.council.presets).length > 0) {
      const presets: Record<string, SlimPreset> = Object.create(null);
      for (const [presetName, preset] of Object.entries(overrides.council.presets)) {
        const presetOut: SlimPreset = Object.create(null);
        for (const [councillorName, councillorConfig] of Object.entries(preset)) {
          presetOut[councillorName] = normalizeAgentConfig(councillorConfig, availableModels);
        }
        if (Object.keys(presetOut).length > 0) presets[presetName] = presetOut;
      }
      if (Object.keys(presets).length > 0) council.presets = presets;
    }

    if (overrides.council.default_preset !== undefined) {
      council.default_preset = overrides.council.default_preset;
    }

    // Upstream requires `presets`.
    if (council.presets) {
      config.council = council;
    }
  }

  // Companion
  if (overrides?.companion) {
    config.companion = { ...overrides.companion };
  }

  // Webfetch
  if (overrides?.webfetch) {
    const webfetch: Record<string, unknown> = { ...overrides.webfetch };
    if (overrides.webfetch.model !== undefined) {
      webfetch.model = processSlimModelConfig(overrides.webfetch.model, availableModels);
    }
    config.webfetch = webfetch;
  }

  // ACP agents
  if (overrides?.acpAgents && Object.keys(overrides.acpAgents).length > 0) {
    config.acpAgents = { ...overrides.acpAgents };
  }

  // Interview
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

// Re-export shared utilities needed by components
export { buildTiers, pickBestModel };
export { SLIM_AGENTS };

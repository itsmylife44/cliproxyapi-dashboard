import {
  buildTiers,
  pickBestModel,
  type TierLevel,
} from "./oh-my-opencode";
import type { OhMyOpenCodeSlimFullConfig, SlimCouncilConfig, SlimCouncilPreset } from "./oh-my-opencode-slim-types";

export type { ConfigData, OAuthAccount } from "./shared";

// ---------------------------------------------------------------------------
// Slim agent roles — 7 agents mapped to the shared 4-tier system
// ---------------------------------------------------------------------------

export const SLIM_AGENT_ROLES: Record<string, { tier: TierLevel; label: string }> = {
  orchestrator: { tier: 1, label: "Master delegator" },
  oracle:       { tier: 1, label: "Strategic advisor" },
  council:      { tier: 1, label: "Multi-LLM consensus" },
  designer:     { tier: 4, label: "UI/UX implementation" },
  explorer:     { tier: 3, label: "Codebase reconnaissance" },
  librarian:    { tier: 2, label: "External knowledge" },
  fixer:        { tier: 3, label: "Fast implementation" },
};

// ---------------------------------------------------------------------------
// Config builder
// ---------------------------------------------------------------------------

interface SlimModelAssignment {
  model: string;
  variant?: string;
  temperature?: number;
  skills?: string[];
  mcps?: string[];
}

export function buildSlimConfig(
  availableModels: string[],
  overrides?: OhMyOpenCodeSlimFullConfig,
): Record<string, unknown> | null {
  const agents: Record<string, SlimModelAssignment> = {};

  for (const [agent, role] of Object.entries(SLIM_AGENT_ROLES)) {
    const agentOverride = overrides?.agents?.[agent];
    const overrideModel = agentOverride?.model;
    let entry: SlimModelAssignment;

    if (overrideModel && typeof overrideModel === "string" && availableModels.includes(overrideModel)) {
      entry = { model: `cliproxyapi/${overrideModel}` };
    } else {
      const model = pickBestModel(availableModels, role.tier);
      if (!model) {
        // No model available for this tier — use placeholder to keep agent in config
        entry = { model: `cliproxyapi/unresolved-tier-${role.tier}` };
      } else {
        entry = { model: `cliproxyapi/${model}` };
      }
    }

    if (agentOverride?.variant) entry.variant = agentOverride.variant;
    if (agentOverride?.temperature !== undefined) entry.temperature = agentOverride.temperature;
    if (agentOverride?.skills?.length) entry.skills = agentOverride.skills;
    if (agentOverride?.mcps?.length) entry.mcps = agentOverride.mcps;

    agents[agent] = entry;
  }

  if (Object.keys(agents).length === 0) {
    return null;
  }

  const config: Record<string, unknown> = {
    $schema:
      "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json",
  };

  config.agents = agents;

  // Scalar settings
  if (overrides?.preset) config.preset = overrides.preset;
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
        primary: `cliproxyapi/${entry.primary}`,
        fallback1: `cliproxyapi/${entry.fallback1}`,
        fallback2: `cliproxyapi/${entry.fallback2}`,
        fallback3: `cliproxyapi/${entry.fallback3}`,
      };
    }
    if (Object.keys(filteredPlan).length > 0) {
      config.manualPlan = filteredPlan;
    }
  }

  // Disabled MCPs
  if (overrides?.disabled_mcps?.length) config.disabled_mcps = overrides.disabled_mcps;

  // Tmux — merge with defaults
  if (overrides?.tmux) {
    config.tmux = {
      enabled: false,
      layout: "main-vertical",
      main_pane_size: 60,
      ...overrides.tmux,
    };
  }

  // Background
  if (overrides?.background) {
    config.background = { maxConcurrentStarts: 10, ...overrides.background };
  }

  // Fallback — build chains from available models if not explicitly set
  if (overrides?.fallback) {
    // Destructure chains out so the spread below never copies raw model IDs
    // into fallback.chains — we set that field explicitly after prefixing.
    const { chains: rawChains, ...fallbackRest } = overrides.fallback;
    const fallback: Record<string, unknown> = {
      enabled: true,
      timeoutMs: 15000,
      retryDelayMs: 500,
      ...fallbackRest,
    };

    // Prefix chain models with cliproxyapi/ and drop chains with no available models
    if (rawChains) {
      const prefixedChains: Record<string, string[]> = {};
      for (const [agent, chain] of Object.entries(rawChains)) {
        const available = chain
          .filter((m) => availableModels.includes(m))
          .map((m) => `cliproxyapi/${m}`);
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
      const masterModel = availableModels.includes(rawCouncil.master.model)
        ? `cliproxyapi/${rawCouncil.master.model}`
        : rawCouncil.master.model;
      const master: Record<string, unknown> = { model: masterModel };
      if (rawCouncil.master.variant) master.variant = rawCouncil.master.variant;
      if (rawCouncil.master.prompt) master.prompt = rawCouncil.master.prompt;
      council.master = master;
    }

    // Presets
    if (rawCouncil.presets && Object.keys(rawCouncil.presets).length > 0) {
      const presets: Record<string, Record<string, unknown>> = {};
      for (const [presetName, preset] of Object.entries(rawCouncil.presets)) {
        const presetOut: Record<string, unknown> = {};
        for (const [cName, cConfig] of Object.entries(preset.councillors)) {
          const cModel = availableModels.includes(cConfig.model)
            ? `cliproxyapi/${cConfig.model}`
            : cConfig.model;
          const entry: Record<string, unknown> = { model: cModel };
          if (cConfig.variant) entry.variant = cConfig.variant;
          if (cConfig.prompt) entry.prompt = cConfig.prompt;
          presetOut[cName] = entry;
        }
        if (preset.master) {
          const mo: Record<string, unknown> = {};
          if (preset.master.model) {
            mo.model = availableModels.includes(preset.master.model)
              ? `cliproxyapi/${preset.master.model}`
              : preset.master.model;
          }
          if (preset.master.variant) mo.variant = preset.master.variant;
          if (preset.master.prompt) mo.prompt = preset.master.prompt;
          if (Object.keys(mo).length > 0) presetOut.master = mo;
        }
        if (Object.keys(presetOut).length > 0) presets[presetName] = presetOut;
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
        .map((m) => `cliproxyapi/${m}`);
      if (prefixed.length > 0) council.master_fallback = prefixed;
    }

    if (Object.keys(council).length > 0) config.council = council;
  }

  return config;
}

// Re-export shared utilities needed by components
export { buildTiers, pickBestModel };

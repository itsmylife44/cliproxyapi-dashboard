import {
  buildTiers,
  pickBestModel,
  type TierLevel,
} from "./oh-my-opencode";
import type { OhMyOpenCodeSlimFullConfig } from "./oh-my-opencode-slim-types";

export type { ConfigData, OAuthAccount } from "./shared";

// ---------------------------------------------------------------------------
// Slim agent roles — 6 agents mapped to the shared 4-tier system
// ---------------------------------------------------------------------------

export const SLIM_AGENT_ROLES: Record<string, { tier: TierLevel; label: string }> = {
  orchestrator: { tier: 1, label: "Master delegator" },
  oracle:       { tier: 1, label: "Strategic advisor" },
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
      if (!model) continue;
      entry = { model: `cliproxyapi/${model}` };
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
    const fallback: Record<string, unknown> = {
      enabled: true,
      timeoutMs: 15000,
      retryDelayMs: 500,
      ...overrides.fallback,
    };

    // Prefix chain models with cliproxyapi/, dropping empty chains
    delete fallback.chains;
    if (overrides.fallback.chains) {
      const prefixedChains: Record<string, string[]> = {};
      for (const [agent, chain] of Object.entries(overrides.fallback.chains)) {
        const filtered = chain
          .filter((m) => availableModels.includes(m))
          .map((m) => `cliproxyapi/${m}`);
        if (filtered.length > 0) {
          prefixedChains[agent] = filtered;
        }
      }
      if (Object.keys(prefixedChains).length > 0) {
        fallback.chains = prefixedChains;
      }
    }

    config.fallback = fallback;
  }

  return config;
}

// Re-export shared utilities needed by components
export { buildTiers, pickBestModel };

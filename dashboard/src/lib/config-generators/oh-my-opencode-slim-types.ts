/**
 * Oh-My-OpenCode-Slim Configuration Types
 *
 * TypeScript interfaces and constants for the oh-my-opencode-slim plugin schema.
 * Slim has 6 agents, no categories, and a dedicated fallback system.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const SLIM_AGENTS = [
  "orchestrator",
  "oracle",
  "designer",
  "explorer",
  "librarian",
  "fixer",
] as const;

export type SlimAgentName = (typeof SLIM_AGENTS)[number];

export const SLIM_TMUX_LAYOUTS = [
  "main-horizontal",
  "main-vertical",
  "tiled",
  "even-horizontal",
  "even-vertical",
] as const;

export const SLIM_SCORING_VERSIONS = ["v1", "v2-shadow", "v2"] as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface SlimAgentConfig {
  model?: string;
  temperature?: number;
  variant?: string;
  skills?: string[];
  mcps?: string[];
}

export interface SlimManualPlanEntry {
  primary: string;
  fallback1: string;
  fallback2: string;
  fallback3: string;
}

export interface SlimFallbackConfig {
  enabled?: boolean;
  timeoutMs?: number;
  retryDelayMs?: number;
  chains?: Record<string, string[]>;
}

export interface SlimBackgroundConfig {
  maxConcurrentStarts?: number;
}

export interface SlimTmuxConfig {
  enabled?: boolean;
  layout?: (typeof SLIM_TMUX_LAYOUTS)[number];
  main_pane_size?: number;
}

export interface OhMyOpenCodeSlimFullConfig {
  preset?: string;
  setDefaultAgent?: boolean;
  scoringEngineVersion?: (typeof SLIM_SCORING_VERSIONS)[number];
  balanceProviderUsage?: boolean;
  manualPlan?: Record<string, SlimManualPlanEntry>;
  agents?: Record<string, SlimAgentConfig>;
  disabled_mcps?: string[];
  tmux?: SlimTmuxConfig;
  background?: SlimBackgroundConfig;
  fallback?: SlimFallbackConfig;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateSlimConfig(raw: unknown): OhMyOpenCodeSlimFullConfig {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const result: OhMyOpenCodeSlimFullConfig = {};

  // preset — length-bounded
  if (typeof obj.preset === "string" && obj.preset.length <= 128) {
    result.preset = obj.preset;
  }

  // setDefaultAgent
  if (typeof obj.setDefaultAgent === "boolean") {
    result.setDefaultAgent = obj.setDefaultAgent;
  }

  // scoringEngineVersion
  if (
    typeof obj.scoringEngineVersion === "string" &&
    (SLIM_SCORING_VERSIONS as readonly string[]).includes(obj.scoringEngineVersion)
  ) {
    result.scoringEngineVersion = obj.scoringEngineVersion as OhMyOpenCodeSlimFullConfig["scoringEngineVersion"];
  }

  // balanceProviderUsage
  if (typeof obj.balanceProviderUsage === "boolean") {
    result.balanceProviderUsage = obj.balanceProviderUsage;
  }

  // manualPlan — restrict keys to known agents, bound string lengths
  if (obj.manualPlan && typeof obj.manualPlan === "object" && !Array.isArray(obj.manualPlan)) {
    const planObj = obj.manualPlan as Record<string, unknown>;
    const validatedPlan: Record<string, SlimManualPlanEntry> = {};
    const isValidModelStr = (v: unknown): v is string => typeof v === "string" && v.length <= 256;
    for (const [agent, value] of Object.entries(planObj)) {
      if (!(SLIM_AGENTS as readonly string[]).includes(agent)) continue;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const entry = value as Record<string, unknown>;
        if (
          isValidModelStr(entry.primary) &&
          isValidModelStr(entry.fallback1) &&
          isValidModelStr(entry.fallback2) &&
          isValidModelStr(entry.fallback3)
        ) {
          validatedPlan[agent] = {
            primary: entry.primary,
            fallback1: entry.fallback1,
            fallback2: entry.fallback2,
            fallback3: entry.fallback3,
          };
        }
      }
    }
    if (Object.keys(validatedPlan).length > 0) {
      result.manualPlan = validatedPlan;
    }
  }

  // agents — restrict keys to known agents, bound strings and arrays
  if (obj.agents && typeof obj.agents === "object" && !Array.isArray(obj.agents)) {
    const agentsObj = obj.agents as Record<string, unknown>;
    const validatedAgents: Record<string, SlimAgentConfig> = {};
    for (const [key, value] of Object.entries(agentsObj)) {
      if (key.length > 64) continue;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const entryObj = value as Record<string, unknown>;
        const entry: SlimAgentConfig = {};
        if (typeof entryObj.model === "string" && entryObj.model.length <= 256) entry.model = entryObj.model;
        if (typeof entryObj.variant === "string" && entryObj.variant.length <= 256) entry.variant = entryObj.variant;
        if (typeof entryObj.temperature === "number" && Number.isFinite(entryObj.temperature) && entryObj.temperature >= 0 && entryObj.temperature <= 2) {
          entry.temperature = entryObj.temperature;
        }
        if (Array.isArray(entryObj.skills)) {
          const skills = entryObj.skills.slice(0, 50).filter((v: unknown): v is string => typeof v === "string" && v.length <= 256);
          if (skills.length > 0) entry.skills = skills;
        }
        if (Array.isArray(entryObj.mcps)) {
          const mcps = entryObj.mcps.slice(0, 50).filter((v: unknown): v is string => typeof v === "string" && v.length <= 256);
          if (mcps.length > 0) entry.mcps = mcps;
        }
        validatedAgents[key] = entry;
      } else if (typeof value === "string" && value.length <= 256) {
        validatedAgents[key] = { model: value };
      }
    }
    if (Object.keys(validatedAgents).length > 0) {
      result.agents = validatedAgents;
    }
  }

  // disabled_mcps — bounded
  if (Array.isArray(obj.disabled_mcps)) {
    const items = obj.disabled_mcps.slice(0, 50).filter((v): v is string => typeof v === "string" && v.length <= 256);
    if (items.length > 0) result.disabled_mcps = items;
  }

  // tmux
  if (obj.tmux && typeof obj.tmux === "object" && !Array.isArray(obj.tmux)) {
    const tmuxObj = obj.tmux as Record<string, unknown>;
    const tmux: SlimTmuxConfig = {};
    if (typeof tmuxObj.enabled === "boolean") tmux.enabled = tmuxObj.enabled;
    if (typeof tmuxObj.layout === "string" && (SLIM_TMUX_LAYOUTS as readonly string[]).includes(tmuxObj.layout)) {
      tmux.layout = tmuxObj.layout as SlimTmuxConfig["layout"];
    }
    if (typeof tmuxObj.main_pane_size === "number" && Number.isInteger(tmuxObj.main_pane_size)) {
      tmux.main_pane_size = Math.max(20, Math.min(80, tmuxObj.main_pane_size));
    }
    if (Object.keys(tmux).length > 0) result.tmux = tmux;
  }

  // background
  if (obj.background && typeof obj.background === "object" && !Array.isArray(obj.background)) {
    const bgObj = obj.background as Record<string, unknown>;
    const bg: SlimBackgroundConfig = {};
    if (typeof bgObj.maxConcurrentStarts === "number" && Number.isInteger(bgObj.maxConcurrentStarts)) {
      bg.maxConcurrentStarts = Math.max(1, Math.min(50, bgObj.maxConcurrentStarts));
    }
    if (Object.keys(bg).length > 0) result.background = bg;
  }

  // fallback
  if (obj.fallback && typeof obj.fallback === "object" && !Array.isArray(obj.fallback)) {
    const fbObj = obj.fallback as Record<string, unknown>;
    const fb: SlimFallbackConfig = {};
    if (typeof fbObj.enabled === "boolean") fb.enabled = fbObj.enabled;
    if (typeof fbObj.timeoutMs === "number" && fbObj.timeoutMs >= 0 && fbObj.timeoutMs <= 60000) fb.timeoutMs = fbObj.timeoutMs;
    if (typeof fbObj.retryDelayMs === "number" && fbObj.retryDelayMs >= 0 && fbObj.retryDelayMs <= 10000) fb.retryDelayMs = fbObj.retryDelayMs;
    if (fbObj.chains && typeof fbObj.chains === "object" && !Array.isArray(fbObj.chains)) {
      const chainsObj = fbObj.chains as Record<string, unknown>;
      const validatedChains: Record<string, string[]> = {};
      for (const [agent, arr] of Object.entries(chainsObj)) {
        if (!(SLIM_AGENTS as readonly string[]).includes(agent)) continue;
        if (Array.isArray(arr)) {
          const chain = arr.slice(0, 10).filter((v): v is string => typeof v === "string" && v.length <= 256);
          if (chain.length > 0) validatedChains[agent] = chain;
        }
      }
      if (Object.keys(validatedChains).length > 0) fb.chains = validatedChains;
    }
    if (Object.keys(fb).length > 0) result.fallback = fb;
  }

  return result;
}

/**
 * Oh-My-OpenCode-Slim Configuration Types
 *
 * TypeScript interfaces and constants for the oh-my-opencode-slim plugin schema.
 * Slim has 7 agents (incl. council), no categories, and a dedicated fallback system.
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
  "council",
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

export const SLIM_COUNCILLOR_EXECUTION_MODES = ["parallel", "serial"] as const;

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

export interface SlimCouncillorConfig {
  model: string;
  variant?: string;
  prompt?: string;
}

export interface SlimCouncilPresetMasterOverride {
  model?: string;
  variant?: string;
  prompt?: string;
}

export interface SlimCouncilPreset {
  councillors: Record<string, SlimCouncillorConfig>;
  master?: SlimCouncilPresetMasterOverride;
}

export interface SlimCouncilConfig {
  master?: { model: string; variant?: string; prompt?: string };
  presets?: Record<string, SlimCouncilPreset>;
  master_timeout?: number;
  councillors_timeout?: number;
  default_preset?: string;
  master_fallback?: string[];
  councillor_execution_mode?: (typeof SLIM_COUNCILLOR_EXECUTION_MODES)[number];
  councillor_retries?: number;
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
  council?: SlimCouncilConfig;
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
      if (!(SLIM_AGENTS as readonly string[]).includes(key)) continue;
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

  // council
  if (obj.council && typeof obj.council === "object" && !Array.isArray(obj.council)) {
    const cObj = obj.council as Record<string, unknown>;
    const council: SlimCouncilConfig = {};

    // master
    if (cObj.master && typeof cObj.master === "object" && !Array.isArray(cObj.master)) {
      const mObj = cObj.master as Record<string, unknown>;
      if (typeof mObj.model === "string" && mObj.model.length <= 256) {
        const master: NonNullable<SlimCouncilConfig["master"]> = { model: mObj.model };
        if (typeof mObj.variant === "string" && mObj.variant.length <= 256) master.variant = mObj.variant;
        if (typeof mObj.prompt === "string" && mObj.prompt.length <= 4096) master.prompt = mObj.prompt;
        council.master = master;
      }
    }

    // presets
    if (cObj.presets && typeof cObj.presets === "object" && !Array.isArray(cObj.presets)) {
      const presetsObj = cObj.presets as Record<string, unknown>;
      const validatedPresets: Record<string, SlimCouncilPreset> = {};
      for (const [presetName, presetVal] of Object.entries(presetsObj)) {
        if (typeof presetName !== "string" || presetName.length > 128) continue;
        if (typeof presetVal !== "object" || presetVal === null || Array.isArray(presetVal)) continue;
        const pObj = presetVal as Record<string, unknown>;
        const councillors: Record<string, SlimCouncillorConfig> = {};
        let masterOverride: SlimCouncilPresetMasterOverride | undefined;
        for (const [key, val] of Object.entries(pObj)) {
          if (typeof val !== "object" || val === null || Array.isArray(val)) continue;
          const entry = val as Record<string, unknown>;
          if (key === "master") {
            const mo: SlimCouncilPresetMasterOverride = {};
            if (typeof entry.model === "string" && entry.model.length <= 256) mo.model = entry.model;
            if (typeof entry.variant === "string" && entry.variant.length <= 256) mo.variant = entry.variant;
            if (typeof entry.prompt === "string" && entry.prompt.length <= 4096) mo.prompt = entry.prompt;
            if (Object.keys(mo).length > 0) masterOverride = mo;
          } else {
            if (typeof entry.model === "string" && entry.model.length <= 256) {
              const c: SlimCouncillorConfig = { model: entry.model };
              if (typeof entry.variant === "string" && entry.variant.length <= 256) c.variant = entry.variant;
              if (typeof entry.prompt === "string" && entry.prompt.length <= 4096) c.prompt = entry.prompt;
              councillors[key] = c;
            }
          }
        }
        if (Object.keys(councillors).length > 0) {
          validatedPresets[presetName] = { councillors, master: masterOverride };
        }
      }
      if (Object.keys(validatedPresets).length > 0) council.presets = validatedPresets;
    }

    // scalar fields
    if (typeof cObj.master_timeout === "number" && cObj.master_timeout >= 0 && cObj.master_timeout <= 600000) {
      council.master_timeout = cObj.master_timeout;
    }
    if (typeof cObj.councillors_timeout === "number" && cObj.councillors_timeout >= 0 && cObj.councillors_timeout <= 600000) {
      council.councillors_timeout = cObj.councillors_timeout;
    }
    if (typeof cObj.default_preset === "string" && cObj.default_preset.length <= 128) {
      council.default_preset = cObj.default_preset;
    }
    if (Array.isArray(cObj.master_fallback)) {
      const fb = cObj.master_fallback.slice(0, 10).filter((v): v is string => typeof v === "string" && v.length <= 256);
      if (fb.length > 0) council.master_fallback = fb;
    }
    if (typeof cObj.councillor_execution_mode === "string" &&
      (SLIM_COUNCILLOR_EXECUTION_MODES as readonly string[]).includes(cObj.councillor_execution_mode)) {
      council.councillor_execution_mode = cObj.councillor_execution_mode as SlimCouncilConfig["councillor_execution_mode"];
    }
    if (typeof cObj.councillor_retries === "number" && Number.isInteger(cObj.councillor_retries) &&
      cObj.councillor_retries >= 0 && cObj.councillor_retries <= 5) {
      council.councillor_retries = cObj.councillor_retries;
    }

    if (Object.keys(council).length > 0) result.council = council;
  }

  return result;
}

/**
 * Oh-My-OpenCode-Slim Configuration Types
 *
 * TypeScript interfaces and constants for the oh-my-opencode-slim plugin schema.
 *
 * UPSTREAM PROVENANCE (verified 2026-09-16)
 *   project:    oh-my-opencode-slim
 *   repository: https://github.com/alvinunreal/oh-my-opencode-slim
 *   channel:    stable
 *   version:    2.2.21
 *   tag:        v2.2.21
 *   commit:     f34d7ae22af0985bec257d72d0b6213f2aed3e48
 *   schema:     oh-my-opencode-slim.schema.json (shipped in the npm tarball)
 *   derived:    src/config/schema.ts, src/config/constants.ts,
 *               src/config/agent-mcps.ts, src/cli/custom-skills-registry.ts,
 *               src/cli/skills.ts
 *
 * The constants below are transcribed from those upstream files. Do not edit
 * them from memory: re-derive them from the pinned commit and update the
 * provenance block above.
 *
 * @see docs/upstream-opencode-integrations.md
 */

// ============================================================================
// UPSTREAM PROVENANCE
// ============================================================================

export const SLIM_UPSTREAM = {
  project: "oh-my-opencode-slim",
  repository: "https://github.com/alvinunreal/oh-my-opencode-slim",
  packageName: "oh-my-opencode-slim",
  stableVersion: "2.2.21",
  stableTag: "v2.2.21",
  stableCommit: "f34d7ae22af0985bec257d72d0b6213f2aed3e48",
  betaVersion: "3.0.0-beta.13",
  verifiedAt: "2026-09-16",
  schemaUrl:
    "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json",
  configFileBase: "oh-my-opencode-slim",
} as const;

// ============================================================================
// AGENTS
// ============================================================================

/**
 * Agents the dashboard auto-assigns in the tier grid and in every managed
 * preset. Mirrors the upstream agents that are enabled by default
 * (ALL_AGENT_NAMES minus the default-disabled observer and the internal
 * councillor).
 */
export const SLIM_AGENTS = [
  "orchestrator",
  "oracle",
  "designer",
  "explorer",
  "librarian",
  "fixer",
  "council",
] as const;

/** Optional upstream agent. Listed in DEFAULT_DISABLED_AGENTS upstream. */
export const SLIM_OPTIONAL_AGENTS = ["observer"] as const;

/**
 * Internal upstream agents that are not ordinary fixed agents.
 * `councillor` is instantiated dynamically per council session
 * (upstream COUNCILLOR_AGENT_PREFIX = "councillor-").
 */
export const SLIM_INTERNAL_AGENTS = ["councillor"] as const;

/** Complete upstream agent name set (ALL_AGENT_NAMES, 9 entries). */
export const SLIM_ALL_AGENT_NAMES = [
  "orchestrator",
  "explorer",
  "librarian",
  "oracle",
  "designer",
  "fixer",
  "observer",
  "council",
  "councillor",
] as const;

/** Upstream DEFAULT_DISABLED_AGENTS. */
export const SLIM_DEFAULT_DISABLED_AGENTS = ["observer"] as const;

/** Upstream PROTECTED_AGENTS: cannot be disabled even if listed. */
export const SLIM_PROTECTED_AGENTS = ["orchestrator", "councillor"] as const;

/** Upstream AGENT_ALIASES: legacy name -> canonical name. */
export const SLIM_AGENT_ALIASES: Record<string, string> = {
  explore: "explorer",
  "frontend-ui-ux-engineer": "designer",
};

export type SlimAgentName = (typeof SLIM_AGENTS)[number];
export type SlimOptionalAgentName = (typeof SLIM_OPTIONAL_AGENTS)[number];
export type SlimInternalAgentName = (typeof SLIM_INTERNAL_AGENTS)[number];
export type SlimAllAgentName = (typeof SLIM_ALL_AGENT_NAMES)[number];

// ============================================================================
// SKILLS
// ============================================================================

/**
 * Skills bundled and installed by the upstream CLI.
 * Source: src/cli/custom-skills-registry.ts#CUSTOM_SKILLS.
 *
 * `cartography` no longer exists (renamed to `codemap`); `agent-browser` is
 * not part of this plugin.
 */
export const SLIM_BUNDLED_SKILLS = [
  "simplify",
  "codemap",
  "clonedeps",
  "deepwork",
  "verification-planning",
  "reflect",
  "oh-my-opencode-slim",
  "worktrees",
] as const;

/**
 * Externally managed skills that receive permission grants only
 * (upstream src/cli/skills.ts#PERMISSION_ONLY_SKILLS). Not installed.
 */
export const SLIM_PERMISSION_ONLY_SKILLS = ["requesting-code-review"] as const;

export type SlimBundledSkillName = (typeof SLIM_BUNDLED_SKILLS)[number];

/**
 * Upstream default skill grants, derived from each registry entry's
 * `allowedAgents` (registry order, CUSTOM_SKILLS then PERMISSION_ONLY_SKILLS).
 */
export const SLIM_DEFAULT_SKILLS: Record<SlimAgentName, string[]> = {
  orchestrator: [
    "codemap",
    "clonedeps",
    "deepwork",
    "verification-planning",
    "reflect",
    "oh-my-opencode-slim",
    "worktrees",
  ],
  oracle: ["simplify", "requesting-code-review"],
  designer: [],
  explorer: [],
  librarian: [],
  fixer: [],
  council: [],
};

// ============================================================================
// MCPs
// ============================================================================

/** Upstream McpNameSchema: the only MCP ids the plugin knows. */
export const SLIM_MCP_NAMES = ["context7", "gh_grep"] as const;

/** Upstream DEFAULT_AGENT_MCPS ("*" = all, "!name" = exclude). */
export const SLIM_DEFAULT_MCPS: Record<SlimAgentName, string[]> = {
  orchestrator: ["*", "!context7"],
  librarian: ["context7", "gh_grep"],
  designer: [],
  oracle: [],
  explorer: [],
  fixer: [],
  council: [],
};

// ============================================================================
// ENUMS
// ============================================================================

export const SLIM_MULTIPLEXER_TYPES = [
  "auto",
  "tmux",
  "zellij",
  "herdr",
  "kitty",
  "cmux",
  "none",
] as const;

export const SLIM_MULTIPLEXER_LAYOUTS = [
  "main-horizontal",
  "main-vertical",
  "tiled",
  "even-horizontal",
  "even-vertical",
] as const;

export const SLIM_ZELLIJ_PANE_MODES = ["agent-tab", "current-tab"] as const;

export const SLIM_IMAGE_ROUTING_MODES = ["auto", "direct"] as const;

export const SLIM_BACKGROUND_JOB_STRATEGIES = [
  "latest",
  "checkpoint-compatible",
] as const;

export const SLIM_PERMISSION_VALUES = ["ask", "allow", "deny"] as const;

export const SLIM_REASONING_LEVELS = [
  "auto",
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Model entry for array-style model configuration.
 * An ordered `model` array IS the fallback chain in the current schema.
 */
export interface SlimModelEntry {
  id: string;
  variant?: string;
}

/**
 * Model can be a simple string or an ordered array of model entries.
 * The array order is the fallback order.
 */
export type SlimModelConfig = string | Array<string | SlimModelEntry>;

export type SlimPermissionValue = (typeof SLIM_PERMISSION_VALUES)[number];

/** Agent configuration (used both at `agents.<name>` and inside presets). */
export interface SlimAgentConfig {
  model?: SlimModelConfig;
  inheritModelFrom?: "session" | "orchestrator";
  temperature?: number;
  variant?: string;
  skills?: string[];
  skills_add?: string[];
  skills_remove?: string[];
  mcps?: string[];
  prompt?: string;
  orchestratorPrompt?: string;
  options?: Record<string, unknown>;
  displayName?: string;
  color?: string;
  description?: string;
  permission?:
    | SlimPermissionValue
    | Record<string, SlimPermissionValue | Record<string, SlimPermissionValue>>;
  /** Unknown agent-level fields are preserved verbatim on round-trip. */
  [key: string]: unknown;
}

/** A named preset: a flat map of agent name -> agent config. */
export type SlimPreset = Record<string, SlimAgentConfig>;

/** Global failover settings (upstream FailoverConfigSchema). */
export interface SlimFallbackConfig {
  enabled?: boolean;
  /** Consecutive 429/rate-limit responses tolerated on the same model. */
  maxRetries?: number;
  /** Delay before the first fallback on a failover-worthy error. 0 disables. */
  initialRetryDelayMs?: number;
  /** Delay between consecutive fallback attempts. 0 disables. */
  retryDelayMs?: number;
}

/**
 * Council configuration (upstream CouncilConfigSchema).
 * `presets.<presetName>.<councillorName>` uses FLAT councillor names; each
 * councillor is an ordinary agent config and may carry a model chain.
 */
export interface SlimCouncilConfig {
  presets?: Record<string, SlimPreset>;
  default_preset?: string;
}

/** Unified multiplexer config (tmux, zellij, herdr, kitty, cmux). */
export interface SlimMultiplexerConfig {
  type?: (typeof SLIM_MULTIPLEXER_TYPES)[number];
  layout?: (typeof SLIM_MULTIPLEXER_LAYOUTS)[number];
  main_pane_size?: number;
  zellij_pane_mode?: (typeof SLIM_ZELLIJ_PANE_MODES)[number];
}

export interface SlimOrchestratorWakeConfig {
  enabled?: boolean;
  intervalMs?: number;
  mode?: "auto" | "todo" | "children";
}

export interface SlimBackgroundJobsConcurrencyConfig {
  defaultConcurrency?: number;
  providerConcurrency?: Record<string, number>;
  modelConcurrency?: Record<string, number>;
}

export interface SlimBackgroundJobsConfig {
  strategy?: (typeof SLIM_BACKGROUND_JOB_STRATEGIES)[number];
  maxSessionsPerAgent?: number;
  maxContextLines?: number;
  readContextMinLines?: number;
  readContextMaxFiles?: number;
  maxRetainedSnapshots?: number;
  orchestratorWake?: SlimOrchestratorWakeConfig;
  wallClockTimeoutMs?: number;
  abortGraceMs?: number;
  concurrency?: SlimBackgroundJobsConcurrencyConfig;
  sameProviderPolicy?: Record<string, "foreground">;
  waitForUserGuard?: boolean;
}

export interface SlimCompanionConfig {
  enabled?: boolean;
  binaryPath?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  size?: "small" | "medium" | "large";
  gifPack?: string;
  loopStyle?: "classic" | "smooth";
  speed?: number;
  debug?: boolean;
}

export interface SlimWebfetchConfig {
  enabled?: boolean;
  model?: SlimModelConfig;
}

export interface SlimAcpAgentConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  description?: string;
  prompt?: string;
  orchestratorPrompt?: string;
  wrapperModel?: string;
  timeoutMs?: number;
  permissionMode?: "ask" | "allow" | "reject";
}

/** Interview feature config for browser-based Q&A flow. */
export interface SlimInterviewConfig {
  maxQuestions?: number;
  outputFolder?: string;
  autoOpenBrowser?: boolean;
  port?: number;
  dashboard?: boolean;
}

/**
 * Full oh-my-opencode-slim configuration.
 *
 * The index signature preserves fields the dashboard does not model so that
 * unknown keys survive a read/write round-trip instead of being dropped.
 *
 * @see https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json
 */
export interface OhMyOpenCodeSlimFullConfig {
  preset?: string;
  presets?: Record<string, SlimPreset>;
  /** Root-level agent overrides, merged above the active preset at runtime. */
  agents?: Record<string, SlimAgentConfig>;

  setDefaultAgent?: boolean;
  compactSidebar?: boolean;
  stripOrchestratorModel?: boolean;
  autoUpdate?: boolean;
  image_routing?: (typeof SLIM_IMAGE_ROUTING_MODES)[number];

  disabled_agents?: string[];
  disabled_mcps?: string[];
  disabled_tools?: string[];
  disabled_skills?: string[];

  multiplexer?: SlimMultiplexerConfig;
  backgroundJobs?: SlimBackgroundJobsConfig;
  fallback?: SlimFallbackConfig;
  council?: SlimCouncilConfig;
  companion?: SlimCompanionConfig;
  webfetch?: SlimWebfetchConfig;
  acpAgents?: Record<string, SlimAcpAgentConfig>;
  interview?: SlimInterviewConfig;

  [key: string]: unknown;
}

// ============================================================================
// KNOWN KEYS
// ============================================================================

/** Every top-level key the dashboard models and emits. */
export const SLIM_KNOWN_TOP_LEVEL_KEYS = [
  "preset",
  "presets",
  "agents",
  "setDefaultAgent",
  "compactSidebar",
  "stripOrchestratorModel",
  "autoUpdate",
  "image_routing",
  "disabled_agents",
  "disabled_mcps",
  "disabled_tools",
  "disabled_skills",
  "multiplexer",
  "backgroundJobs",
  "fallback",
  "council",
  "companion",
  "webfetch",
  "acpAgents",
  "interview",
] as const;

/**
 * Top-level keys that earlier dashboard versions emitted but that the current
 * schema no longer defines. They are consumed by the migration below and never
 * re-emitted.
 */
export const SLIM_REMOVED_TOP_LEVEL_KEYS = [
  "scoringEngineVersion",
  "balanceProviderUsage",
  "manualPlan",
  "todoContinuation",
  "websearch",
  "background",
  "tmux",
] as const;

/**
 * `fallback` keys accepted by versions before 2.3.x and stripped by the
 * upstream loader (src/config/schema.ts#LEGACY_FALLBACK_KEYS).
 */
export const SLIM_LEGACY_FALLBACK_KEYS = [
  "timeoutMs",
  "retry_on_empty",
  "runtimeOverride",
] as const;

/** Agent-level keys the dashboard models. */
export const SLIM_KNOWN_AGENT_KEYS = [
  "model",
  "inheritModelFrom",
  "temperature",
  "variant",
  "skills",
  "skills_add",
  "skills_remove",
  "mcps",
  "prompt",
  "orchestratorPrompt",
  "options",
  "displayName",
  "color",
  "description",
  "permission",
] as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const MAX_MODEL_STRING = 256;
const MAX_MODELS_IN_CHAIN = 10;
const MAX_NAME_LENGTH = 128;
const MAX_LIST_ITEMS = 50;
const MAX_PROMPT_LENGTH = 8192;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedStringList(value: unknown, max = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, max)
    .filter((v): v is string => typeof v === "string" && v.length <= MAX_MODEL_STRING);
}

/**
 * Validate and normalize a model configuration.
 * Model can be a string or an ordered array of (string | {id, variant}).
 */
function validateModelConfig(value: unknown): SlimModelConfig | undefined {
  if (typeof value === "string" && value.length <= MAX_MODEL_STRING) {
    return value;
  }

  if (Array.isArray(value)) {
    const result: Array<string | SlimModelEntry> = [];
    for (const item of value.slice(0, MAX_MODELS_IN_CHAIN)) {
      if (typeof item === "string" && item.length <= MAX_MODEL_STRING) {
        result.push(item);
      } else if (isPlainObject(item)) {
        if (typeof item.id === "string" && item.id.length <= MAX_MODEL_STRING) {
          const entry: SlimModelEntry = { id: item.id };
          if (typeof item.variant === "string" && item.variant.length <= MAX_MODEL_STRING) {
            entry.variant = item.variant;
          }
          result.push(entry);
        }
      }
    }
    if (result.length > 0) return result;
  }

  return undefined;
}

function validatePermission(
  value: unknown,
): SlimAgentConfig["permission"] | undefined {
  if (
    typeof value === "string" &&
    (SLIM_PERMISSION_VALUES as readonly string[]).includes(value)
  ) {
    return value as SlimPermissionValue;
  }
  if (!isPlainObject(value)) return undefined;

  const out: Record<string, SlimPermissionValue | Record<string, SlimPermissionValue>> = {};
  for (const [tool, rule] of Object.entries(value)) {
    if (typeof tool !== "string" || tool.length > MAX_NAME_LENGTH) continue;
    if (
      typeof rule === "string" &&
      (SLIM_PERMISSION_VALUES as readonly string[]).includes(rule)
    ) {
      out[tool] = rule as SlimPermissionValue;
    } else if (isPlainObject(rule)) {
      const nested: Record<string, SlimPermissionValue> = {};
      for (const [pattern, nestedRule] of Object.entries(rule)) {
        if (
          typeof nestedRule === "string" &&
          (SLIM_PERMISSION_VALUES as readonly string[]).includes(nestedRule)
        ) {
          nested[pattern] = nestedRule as SlimPermissionValue;
        }
      }
      if (Object.keys(nested).length > 0) out[tool] = nested;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Sanitize one agent config. Unknown agent-level keys are preserved verbatim.
 */
export function validateSlimAgentConfig(raw: unknown): SlimAgentConfig {
  if (!isPlainObject(raw)) return {};
  const entry: SlimAgentConfig = {};

  const model = validateModelConfig(raw.model);
  if (model !== undefined) entry.model = model;

  if (raw.inheritModelFrom === "session" || raw.inheritModelFrom === "orchestrator") {
    entry.inheritModelFrom = raw.inheritModelFrom;
  }
  if (typeof raw.variant === "string" && raw.variant.length <= MAX_MODEL_STRING) {
    entry.variant = raw.variant;
  }
  if (
    typeof raw.temperature === "number" &&
    Number.isFinite(raw.temperature) &&
    raw.temperature >= 0 &&
    raw.temperature <= 2
  ) {
    entry.temperature = raw.temperature;
  }

  // Skills — preserve empty arrays to allow explicitly disabling defaults.
  if (Array.isArray(raw.skills)) entry.skills = boundedStringList(raw.skills);
  if (Array.isArray(raw.skills_add)) entry.skills_add = boundedStringList(raw.skills_add);
  if (Array.isArray(raw.skills_remove)) entry.skills_remove = boundedStringList(raw.skills_remove);
  if (Array.isArray(raw.mcps)) entry.mcps = boundedStringList(raw.mcps);

  if (typeof raw.prompt === "string" && raw.prompt.length <= MAX_PROMPT_LENGTH) {
    entry.prompt = raw.prompt;
  }
  if (
    typeof raw.orchestratorPrompt === "string" &&
    raw.orchestratorPrompt.length <= MAX_PROMPT_LENGTH
  ) {
    entry.orchestratorPrompt = raw.orchestratorPrompt;
  }
  if (isPlainObject(raw.options)) {
    const optionsStr = JSON.stringify(raw.options);
    if (optionsStr.length <= MAX_PROMPT_LENGTH) {
      entry.options = raw.options;
    }
  }
  if (typeof raw.displayName === "string" && raw.displayName.length <= MAX_MODEL_STRING) {
    entry.displayName = raw.displayName;
  }
  if (typeof raw.color === "string" && raw.color.length <= MAX_MODEL_STRING) {
    entry.color = raw.color;
  }
  if (typeof raw.description === "string" && raw.description.length <= MAX_PROMPT_LENGTH) {
    entry.description = raw.description;
  }
  const permission = validatePermission(raw.permission);
  if (permission !== undefined) entry.permission = permission;

  // Preserve unknown agent-level keys.
  for (const [key, value] of Object.entries(raw)) {
    if ((SLIM_KNOWN_AGENT_KEYS as readonly string[]).includes(key)) continue;
    entry[key] = value;
  }

  return entry;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Pure, idempotent migration of legacy dashboard/upstream shapes into the
 * current 2.2.x schema.
 *
 * 1. `fallback.chains` (Record<agent, model[]>) becomes an ordered `model`
 *    array on the matching agent, since an ordered model array IS the fallback
 *    chain in the current schema.
 * 2. `fallback.timeoutMs` / `retry_on_empty` / `runtimeOverride` are dropped
 *    (the upstream loader strips them and warns).
 * 3. Legacy `council.master.model` becomes the `council` agent's model — the
 *    synthesizer is an ordinary `council` agent now.
 * 4. Nested `council.presets.<p>.councillors` and
 *    `council.presets.<p>.master` are flattened into
 *    `council.presets.<p>.<name>`.
 * 5. Removed top-level sections (`tmux` → `multiplexer`, `background` →
 *    nothing, `scoringEngineVersion`, `balanceProviderUsage`, `manualPlan`,
 *    `todoContinuation`, `websearch`) are handled as follows: `tmux` is
 *    converted to `multiplexer`, the rest are dropped.
 *
 * Running this repeatedly is safe: already-migrated shapes are returned
 * unchanged.
 */
export function migrateSlimLegacyConfig(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, unknown> = { ...raw };

  // --- legacy `tmux` -> `multiplexer` -------------------------------------
  const legacyTmux = out.tmux;
  if (isPlainObject(legacyTmux) && out.multiplexer === undefined) {
    const mux: Record<string, unknown> = {};
    mux.type = legacyTmux.enabled === false ? "none" : "tmux";
    if (typeof legacyTmux.layout === "string") mux.layout = legacyTmux.layout;
    if (typeof legacyTmux.main_pane_size === "number") {
      mux.main_pane_size = legacyTmux.main_pane_size;
    }
    out.multiplexer = mux;
  }
  delete out.tmux;

  // --- legacy `background` -> drop (superseded by `backgroundJobs`) -------
  delete out.background;

  // --- removed scalar sections -------------------------------------------
  delete out.scoringEngineVersion;
  delete out.balanceProviderUsage;
  delete out.manualPlan;
  delete out.todoContinuation;
  delete out.websearch;

  // --- fallback ----------------------------------------------------------
  const legacyChainsByAgent = new Map<string, string[]>();
  const legacyFallback = out.fallback;
  if (isPlainObject(legacyFallback)) {
    const chains = legacyFallback.chains;
    if (isPlainObject(chains)) {
      for (const [agent, chain] of Object.entries(chains)) {
        if (!Array.isArray(chain)) continue;
        const models = chain.filter(
          (m): m is string => typeof m === "string" && m.length <= MAX_MODEL_STRING,
        );
        if (models.length > 0) legacyChainsByAgent.set(agent, models);
      }
    }

    const migratedFallback: Record<string, unknown> = {};
    if (typeof legacyFallback.enabled === "boolean") migratedFallback.enabled = legacyFallback.enabled;
    if (typeof legacyFallback.maxRetries === "number") migratedFallback.maxRetries = legacyFallback.maxRetries;
    if (typeof legacyFallback.initialRetryDelayMs === "number") {
      migratedFallback.initialRetryDelayMs = legacyFallback.initialRetryDelayMs;
    }
    if (typeof legacyFallback.retryDelayMs === "number") migratedFallback.retryDelayMs = legacyFallback.retryDelayMs;
    // Anything else on the legacy fallback block (timeoutMs, retry_on_empty,
    // runtimeOverride, chains, …) is intentionally not carried over.

    out.fallback = migratedFallback;
  }

  // --- council -----------------------------------------------------------
  const legacyCouncil = out.council;
  let synthesizerModel: string | undefined;
  if (isPlainObject(legacyCouncil)) {
    const migratedCouncil: Record<string, unknown> = {};

    const master = legacyCouncil.master;
    if (isPlainObject(master) && typeof master.model === "string") {
      synthesizerModel = master.model;
    }

    const presets = legacyCouncil.presets;
    if (isPlainObject(presets)) {
      const migratedPresets: Record<string, Record<string, unknown>> = {};
      for (const [presetName, presetValue] of Object.entries(presets)) {
        if (!isPlainObject(presetValue)) continue;
        const migratedPreset: Record<string, unknown> = {};

        // Flatten nested `councillors`.
        const nested = presetValue.councillors;
        if (isPlainObject(nested)) {
          for (const [name, cfg] of Object.entries(nested)) {
            if (isPlainObject(cfg)) migratedPreset[name] = cfg;
          }
        }
        // Flatten a preset-level `master` override to a `council` entry.
        const presetMaster = presetValue.master;
        if (isPlainObject(presetMaster)) {
          migratedPreset.council = presetMaster;
        }
        // Carry through any already-flat entries.
        for (const [name, cfg] of Object.entries(presetValue)) {
          if (name === "councillors" || name === "master") continue;
          if (isPlainObject(cfg)) migratedPreset[name] = cfg;
        }

        if (Object.keys(migratedPreset).length > 0) migratedPresets[presetName] = migratedPreset;
      }
      if (Object.keys(migratedPresets).length > 0) migratedCouncil.presets = migratedPresets;
    }

    if (typeof legacyCouncil.default_preset === "string") {
      migratedCouncil.default_preset = legacyCouncil.default_preset;
    }

    // Removed council keys (master_timeout, councillors_timeout,
    // master_fallback, councillor_execution_mode, councillor_retries) are
    // deliberately not carried over.
    out.council = migratedCouncil;
  }

  // --- apply legacy fallback chains as agent model arrays ----------------
  if (legacyChainsByAgent.size > 0 || synthesizerModel !== undefined) {
    const agents = isPlainObject(out.agents) ? { ...out.agents } : {};

    for (const [agent, chain] of legacyChainsByAgent) {
      const existing = isPlainObject(agents[agent]) ? (agents[agent] as Record<string, unknown>) : {};
      if (existing.model === undefined) {
        agents[agent] = { ...existing, model: chain };
      }
    }

    if (synthesizerModel !== undefined) {
      const councilAgent = isPlainObject(agents.council) ? (agents.council as Record<string, unknown>) : {};
      if (councilAgent.model === undefined) {
        agents.council = { ...councilAgent, model: synthesizerModel };
      }
    }

    if (Object.keys(agents).length > 0) out.agents = agents;
  }

  return out;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateAgentMap(value: unknown): Record<string, SlimAgentConfig> | undefined {
  if (!isPlainObject(value)) return undefined;
  const out: Record<string, SlimAgentConfig> = {};
  for (const [name, cfg] of Object.entries(value)) {
    if (name.length > MAX_NAME_LENGTH) continue;
    if (isPlainObject(cfg)) {
      out[name] = validateSlimAgentConfig(cfg);
    } else if (typeof cfg === "string" && cfg.length <= MAX_MODEL_STRING) {
      out[name] = { model: cfg };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Validate, migrate and normalize a stored or imported Slim configuration.
 *
 * - legacy shapes are migrated first (see `migrateSlimLegacyConfig`)
 * - unknown top-level fields are preserved
 * - fields the current schema no longer defines are never returned
 */
export function validateSlimConfig(raw: unknown): OhMyOpenCodeSlimFullConfig {
  if (!isPlainObject(raw)) return {};

  const obj = migrateSlimLegacyConfig(raw);
  const result: OhMyOpenCodeSlimFullConfig = {};

  if (typeof obj.preset === "string" && obj.preset.length <= MAX_NAME_LENGTH) {
    result.preset = obj.preset;
  }

  // presets — named preset configurations
  if (isPlainObject(obj.presets)) {
    const validatedPresets: Record<string, SlimPreset> = {};
    for (const [presetName, presetVal] of Object.entries(obj.presets)) {
      if (presetName.length > MAX_NAME_LENGTH || !isPlainObject(presetVal)) continue;
      const preset: SlimPreset = {};
      for (const [agentName, agentVal] of Object.entries(presetVal)) {
        if (agentName.length > MAX_NAME_LENGTH || !isPlainObject(agentVal)) continue;
        preset[agentName] = validateSlimAgentConfig(agentVal);
      }
      // Preserve empty presets so the UI can create one before configuring it.
      validatedPresets[presetName] = preset;
    }
    if (Object.keys(validatedPresets).length > 0) result.presets = validatedPresets;
  }

  // agents (root-level overrides)
  const agents = validateAgentMap(obj.agents);
  if (agents) result.agents = agents;

  // scalars
  if (typeof obj.setDefaultAgent === "boolean") result.setDefaultAgent = obj.setDefaultAgent;
  if (typeof obj.compactSidebar === "boolean") result.compactSidebar = obj.compactSidebar;
  if (typeof obj.stripOrchestratorModel === "boolean") {
    result.stripOrchestratorModel = obj.stripOrchestratorModel;
  }
  if (typeof obj.autoUpdate === "boolean") result.autoUpdate = obj.autoUpdate;
  if (
    typeof obj.image_routing === "string" &&
    (SLIM_IMAGE_ROUTING_MODES as readonly string[]).includes(obj.image_routing)
  ) {
    result.image_routing = obj.image_routing as OhMyOpenCodeSlimFullConfig["image_routing"];
  }

  // disabled lists
  for (const key of ["disabled_agents", "disabled_mcps", "disabled_tools", "disabled_skills"] as const) {
    if (Array.isArray(obj[key])) {
      const items = boundedStringList(obj[key]);
      if (items.length > 0) result[key] = items;
    }
  }

  // multiplexer
  if (isPlainObject(obj.multiplexer)) {
    const muxObj = obj.multiplexer;
    const mux: SlimMultiplexerConfig = {};
    if (
      typeof muxObj.type === "string" &&
      (SLIM_MULTIPLEXER_TYPES as readonly string[]).includes(muxObj.type)
    ) {
      mux.type = muxObj.type as SlimMultiplexerConfig["type"];
    }
    if (
      typeof muxObj.layout === "string" &&
      (SLIM_MULTIPLEXER_LAYOUTS as readonly string[]).includes(muxObj.layout)
    ) {
      mux.layout = muxObj.layout as SlimMultiplexerConfig["layout"];
    }
    if (typeof muxObj.main_pane_size === "number" && Number.isInteger(muxObj.main_pane_size)) {
      mux.main_pane_size = Math.max(20, Math.min(80, muxObj.main_pane_size));
    }
    if (
      typeof muxObj.zellij_pane_mode === "string" &&
      (SLIM_ZELLIJ_PANE_MODES as readonly string[]).includes(muxObj.zellij_pane_mode)
    ) {
      mux.zellij_pane_mode = muxObj.zellij_pane_mode as SlimMultiplexerConfig["zellij_pane_mode"];
    }
    if (Object.keys(mux).length > 0) result.multiplexer = mux;
  }

  // backgroundJobs
  if (isPlainObject(obj.backgroundJobs)) {
    const bgObj = obj.backgroundJobs;
    const bg: SlimBackgroundJobsConfig = {};
    if (
      typeof bgObj.strategy === "string" &&
      (SLIM_BACKGROUND_JOB_STRATEGIES as readonly string[]).includes(bgObj.strategy)
    ) {
      bg.strategy = bgObj.strategy as SlimBackgroundJobsConfig["strategy"];
    }
    const intFields: Array<[keyof SlimBackgroundJobsConfig, number, number]> = [
      ["maxSessionsPerAgent", 1, 10],
      ["maxContextLines", 0, 500000],
      ["readContextMinLines", 0, 1000],
      ["readContextMaxFiles", 0, 50],
      ["maxRetainedSnapshots", 1, 100],
      ["abortGraceMs", 1000, 60000],
    ];
    for (const [field, min, max] of intFields) {
      const value = bgObj[field as string];
      if (typeof value === "number" && Number.isInteger(value)) {
        (bg as Record<string, unknown>)[field as string] = Math.max(min, Math.min(max, value));
      }
    }
    if (typeof bgObj.wallClockTimeoutMs === "number" && bgObj.wallClockTimeoutMs >= 0) {
      bg.wallClockTimeoutMs = bgObj.wallClockTimeoutMs;
    }
    if (typeof bgObj.waitForUserGuard === "boolean") bg.waitForUserGuard = bgObj.waitForUserGuard;
    if (isPlainObject(bgObj.orchestratorWake)) {
      const wake = bgObj.orchestratorWake;
      const out: SlimOrchestratorWakeConfig = {};
      if (typeof wake.enabled === "boolean") out.enabled = wake.enabled;
      if (typeof wake.intervalMs === "number" && Number.isInteger(wake.intervalMs)) {
        out.intervalMs = Math.max(60000, wake.intervalMs);
      }
      if (wake.mode === "auto" || wake.mode === "todo" || wake.mode === "children") {
        out.mode = wake.mode;
      }
      if (Object.keys(out).length > 0) bg.orchestratorWake = out;
    }
    if (isPlainObject(bgObj.concurrency)) {
      const conc = bgObj.concurrency;
      const out: SlimBackgroundJobsConcurrencyConfig = {};
      if (typeof conc.defaultConcurrency === "number" && Number.isInteger(conc.defaultConcurrency)) {
        out.defaultConcurrency = Math.max(0, Math.min(1000, conc.defaultConcurrency));
      }
      for (const field of ["providerConcurrency", "modelConcurrency"] as const) {
        const map = conc[field];
        if (isPlainObject(map)) {
          const clean: Record<string, number> = {};
          for (const [k, v] of Object.entries(map)) {
            if (typeof v === "number" && Number.isInteger(v) && v >= 0) clean[k] = v;
          }
          if (Object.keys(clean).length > 0) out[field] = clean;
        }
      }
      if (Object.keys(out).length > 0) bg.concurrency = out;
    }
    if (isPlainObject(bgObj.sameProviderPolicy)) {
      const policy: Record<string, "foreground"> = {};
      for (const [k, v] of Object.entries(bgObj.sameProviderPolicy)) {
        if (v === "foreground") policy[k] = "foreground";
      }
      if (Object.keys(policy).length > 0) bg.sameProviderPolicy = policy;
    }
    if (Object.keys(bg).length > 0) result.backgroundJobs = bg;
  }

  // fallback — only the four currently supported fields
  if (isPlainObject(obj.fallback)) {
    const fbObj = obj.fallback;
    const fb: SlimFallbackConfig = {};
    if (typeof fbObj.enabled === "boolean") fb.enabled = fbObj.enabled;
    if (typeof fbObj.maxRetries === "number" && Number.isInteger(fbObj.maxRetries) && fbObj.maxRetries >= 0) {
      fb.maxRetries = fbObj.maxRetries;
    }
    if (
      typeof fbObj.initialRetryDelayMs === "number" &&
      Number.isInteger(fbObj.initialRetryDelayMs) &&
      fbObj.initialRetryDelayMs >= 0
    ) {
      fb.initialRetryDelayMs = fbObj.initialRetryDelayMs;
    }
    if (typeof fbObj.retryDelayMs === "number" && Number.isInteger(fbObj.retryDelayMs) && fbObj.retryDelayMs >= 0) {
      fb.retryDelayMs = fbObj.retryDelayMs;
    }
    if (Object.keys(fb).length > 0) result.fallback = fb;
  }

  // council — flat preset map + default_preset
  if (isPlainObject(obj.council)) {
    const cObj = obj.council;
    const council: SlimCouncilConfig = {};

    if (isPlainObject(cObj.presets)) {
      const validatedPresets: Record<string, SlimPreset> = {};
      for (const [presetName, presetVal] of Object.entries(cObj.presets)) {
        if (presetName.length > MAX_NAME_LENGTH || !isPlainObject(presetVal)) continue;
        const preset: SlimPreset = {};
        for (const [councillorName, councillorVal] of Object.entries(presetVal)) {
          if (councillorName.length > MAX_NAME_LENGTH || !isPlainObject(councillorVal)) continue;
          preset[councillorName] = validateSlimAgentConfig(councillorVal);
        }
        if (Object.keys(preset).length > 0) validatedPresets[presetName] = preset;
      }
      if (Object.keys(validatedPresets).length > 0) council.presets = validatedPresets;
    }

    if (typeof cObj.default_preset === "string" && cObj.default_preset.length <= MAX_NAME_LENGTH) {
      council.default_preset = cObj.default_preset;
    }

    if (Object.keys(council).length > 0) result.council = council;
  }

  // companion
  if (isPlainObject(obj.companion)) {
    const compObj = obj.companion;
    const comp: SlimCompanionConfig = {};
    if (typeof compObj.enabled === "boolean") comp.enabled = compObj.enabled;
    if (typeof compObj.binaryPath === "string" && compObj.binaryPath.length <= MAX_MODEL_STRING) {
      comp.binaryPath = compObj.binaryPath;
    }
    for (const field of ["position", "size", "gifPack", "loopStyle"] as const) {
      const value = compObj[field];
      if (typeof value === "string" && value.length <= MAX_NAME_LENGTH) {
        (comp as Record<string, unknown>)[field] = value;
      }
    }
    if (typeof compObj.speed === "number" && Number.isFinite(compObj.speed)) {
      comp.speed = Math.max(0.25, Math.min(4, compObj.speed));
    }
    if (typeof compObj.debug === "boolean") comp.debug = compObj.debug;
    if (Object.keys(comp).length > 0) result.companion = comp;
  }

  // webfetch
  if (isPlainObject(obj.webfetch)) {
    const wfObj = obj.webfetch;
    const wf: SlimWebfetchConfig = {};
    if (typeof wfObj.enabled === "boolean") wf.enabled = wfObj.enabled;
    const model = validateModelConfig(wfObj.model);
    if (model !== undefined) wf.model = model;
    if (Object.keys(wf).length > 0) result.webfetch = wf;
  }

  // acpAgents
  if (isPlainObject(obj.acpAgents)) {
    const acp: Record<string, SlimAcpAgentConfig> = {};
    for (const [name, cfg] of Object.entries(obj.acpAgents)) {
      if (name.length > MAX_NAME_LENGTH || !isPlainObject(cfg)) continue;
      const entry: SlimAcpAgentConfig = {};
      if (typeof cfg.command === "string") entry.command = cfg.command;
      if (Array.isArray(cfg.args)) entry.args = boundedStringList(cfg.args);
      if (isPlainObject(cfg.env)) {
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(cfg.env)) {
          if (typeof v === "string") env[k] = v;
        }
        if (Object.keys(env).length > 0) entry.env = env;
      }
      for (const field of ["cwd", "description", "prompt", "orchestratorPrompt", "wrapperModel"] as const) {
        const value = cfg[field];
        if (typeof value === "string" && value.length <= MAX_PROMPT_LENGTH) {
          entry[field] = value;
        }
      }
      if (typeof cfg.timeoutMs === "number" && Number.isInteger(cfg.timeoutMs) && cfg.timeoutMs >= 0) {
        entry.timeoutMs = cfg.timeoutMs;
      }
      if (cfg.permissionMode === "ask" || cfg.permissionMode === "allow" || cfg.permissionMode === "reject") {
        entry.permissionMode = cfg.permissionMode;
      }
      acp[name] = entry;
    }
    if (Object.keys(acp).length > 0) result.acpAgents = acp;
  }

  // interview
  if (isPlainObject(obj.interview)) {
    const intObj = obj.interview;
    const interview: SlimInterviewConfig = {};
    if (typeof intObj.maxQuestions === "number" && Number.isInteger(intObj.maxQuestions)) {
      interview.maxQuestions = Math.max(1, Math.min(10, intObj.maxQuestions));
    }
    if (
      typeof intObj.outputFolder === "string" &&
      intObj.outputFolder.length >= 1 &&
      intObj.outputFolder.length <= MAX_MODEL_STRING
    ) {
      interview.outputFolder = intObj.outputFolder;
    }
    if (typeof intObj.autoOpenBrowser === "boolean") interview.autoOpenBrowser = intObj.autoOpenBrowser;
    if (typeof intObj.port === "number" && Number.isInteger(intObj.port) && intObj.port >= 0 && intObj.port <= 65535) {
      interview.port = intObj.port;
    }
    if (typeof intObj.dashboard === "boolean") interview.dashboard = intObj.dashboard;
    if (Object.keys(interview).length > 0) result.interview = interview;
  }

  // Preserve unknown top-level fields so they survive a round-trip.
  for (const [key, value] of Object.entries(obj)) {
    if ((SLIM_KNOWN_TOP_LEVEL_KEYS as readonly string[]).includes(key)) continue;
    result[key] = value;
  }

  return result;
}

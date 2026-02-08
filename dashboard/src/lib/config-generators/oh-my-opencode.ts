import {
  PROVIDER_KEYS,
  type ModelsDevModel,
  isRecord,
  hasProvider,
  getActiveOAuthProviderTypes,
} from "./shared";
import type { OhMyOpenCodeFullConfig } from "./oh-my-opencode-types";

export type { OAuthAccount, ConfigData, ModelsDevData } from "./shared";

export const GEMINI_MODEL_IDS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
];

export const CLAUDE_MODEL_IDS = [
  "claude-sonnet-4-5-20250514",
  "claude-opus-4-5-20250414",
];

export const CODEX_MODEL_IDS = [
  "codex-mini-latest",
  "o4-mini",
];

export const TIER_1 = [
  "claude-opus-4-6",
  "claude-opus-4-5",
  "gemini-claude-opus-4-5-thinking",
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  "gpt-5.1-codex",
  "gemini-claude-sonnet-4-5-thinking",
  "gemini-claude-sonnet-4-5",
  "claude-sonnet-4-5",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
] as const;

export const TIER_2 = [
  "gemini-claude-sonnet-4-5-thinking",
  "gemini-claude-sonnet-4-5",
  "claude-sonnet-4-5",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5-codex",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
  "gemini-claude-opus-4-5-thinking",
  "claude-opus-4",
] as const;

export const TIER_3 = [
  "claude-haiku-4-5",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gpt-5-codex-mini",
  "gpt-5",
  "gemini-claude-sonnet-4-5",
] as const;

export const TIER_4 = [
  "gemini-3-pro-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-pro",
  "gemini-claude-sonnet-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4",
] as const;

interface OAuthModelAlias {
  name: string;
  alias: string;
}

interface OpenAICompatProvider {
  name: string;
  prefix?: string;
  models?: string[];
}

const MODELS_DEV_PROVIDERS = ["anthropic", "google", "openai"] as const;

export interface ModelMeta {
  reasoning?: boolean;
  context?: number;
}

export function getModelMeta(modelId: string, modelsDevData: import("./shared").ModelsDevData | null): ModelMeta | null {
  if (!modelsDevData) return null;
  for (const providerKey of MODELS_DEV_PROVIDERS) {
    const provider = modelsDevData[providerKey];
    if (provider?.models?.[modelId]) {
      const m = provider.models[modelId];
      return { reasoning: m.reasoning, context: m.limit?.context };
    }
  }
  return null;
}

function discoverModelsFromProvider(
  modelsDevData: import("./shared").ModelsDevData | null,
  providerKey: string
): string[] {
  if (!modelsDevData) return [];
  const provider = modelsDevData[providerKey];
  if (!provider?.models) return [];
  return Object.keys(provider.models);
}

export function isAntigravityAlias(modelId: string): boolean {
  return modelId.startsWith("gemini-claude-");
}

export function classifyModelToTier(model: ModelsDevModel): 1 | 2 | 3 | 4 | null {
  const id = model.id;
  const family = model.family?.toLowerCase() ?? "";
  const isReasoning = model.reasoning === true;
  const cost = (model.cost?.input ?? 0) + (model.cost?.output ?? 0);
  const hasImageInput = model.modalities?.input?.some(
    (m) => m === "image" || m === "pdf"
  ) ?? false;

  if (isReasoning && (cost > 20 || family.includes("opus"))) return 1;
  if (id.includes("opus")) return 1;

  if (isReasoning && (family.includes("sonnet") || family.includes("pro") || id.includes("pro"))) return 2;
  if (isReasoning && id.includes("sonnet")) return 2;

  if (id.includes("flash") || id.includes("haiku") || id.includes("mini")) return 3;

  if (hasImageInput) return 4;

  if (isReasoning) return 2;
  if (cost > 10) return 1;
  if (cost > 2) return 2;

  return null;
}

export function buildEnrichedTier(
  baseTier: readonly string[],
  tierNumber: 1 | 2 | 3 | 4,
  modelsDevData: import("./shared").ModelsDevData | null
): string[] {
  const result = [...baseTier];
  if (!modelsDevData) return result;

  const existing = new Set(result);

  for (const providerKey of MODELS_DEV_PROVIDERS) {
    const provider = modelsDevData[providerKey];
    if (!provider?.models) continue;

    for (const [modelId, model] of Object.entries(provider.models)) {
      if (existing.has(modelId)) continue;
      if (isAntigravityAlias(modelId)) continue;

      const assignedTier = classifyModelToTier(model);
      if (assignedTier === tierNumber) {
        result.push(modelId);
        existing.add(modelId);
      }
    }
  }

  return result;
}

export function formatContextWindow(context: number | undefined): string {
  if (!context) return "";
  if (context >= 1000000) {
    const m = context / 1000000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (context >= 1000) {
    const k = context / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(0)}k`;
  }
  return String(context);
}

function extractOpenAICompatModelIds(config: import("./shared").ConfigData | null): string[] {
  if (!config) return [];
  const compat = config["openai-compatibility"];
  if (!Array.isArray(compat)) return [];

  const ids: string[] = [];
  for (const entry of compat) {
    if (!isRecord(entry)) continue;
    const providerEntry = entry as unknown as OpenAICompatProvider;
    const prefix = typeof providerEntry.prefix === "string" ? providerEntry.prefix : "";
    const entryModels = providerEntry.models;
    if (Array.isArray(entryModels)) {
      for (const model of entryModels) {
        if (typeof model === "string") {
          ids.push(prefix ? `${prefix}${model}` : model);
        }
      }
    }
  }
  return ids;
}

function extractOAuthModelAliasIds(config: import("./shared").ConfigData | null, oauthAccounts: import("./shared").OAuthAccount[]): string[] {
  if (!config) return [];
  const aliases = config["oauth-model-alias"];
  if (!isRecord(aliases)) return [];

  const ids: string[] = [];
  for (const [provider, aliasList] of Object.entries(aliases)) {
    if (!Array.isArray(aliasList)) continue;

    const hasMatchingAccount = oauthAccounts.some(
      (account) =>
        !account.disabled &&
        (account.provider === provider ||
          (typeof account.name === "string" && account.name.includes(provider)))
    );
    if (!hasMatchingAccount) continue;

    for (const entry of aliasList) {
      if (!isRecord(entry)) continue;
      const alias = entry as unknown as OAuthModelAlias;
      if (typeof alias.alias === "string") {
        ids.push(alias.alias);
      }
    }
  }
  return ids;
}

export function buildAvailableModelIds(
  config: import("./shared").ConfigData | null,
  oauthAccounts: import("./shared").OAuthAccount[],
  modelsDevData: import("./shared").ModelsDevData | null
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  const add = (modelId: string) => {
    if (!seen.has(modelId)) {
      seen.add(modelId);
      ids.push(modelId);
    }
  };

  if (hasProvider(config, PROVIDER_KEYS.GEMINI)) {
    for (const id of GEMINI_MODEL_IDS) add(id);
    for (const id of discoverModelsFromProvider(modelsDevData, "google")) add(id);
  }
  if (hasProvider(config, PROVIDER_KEYS.CLAUDE)) {
    for (const id of CLAUDE_MODEL_IDS) add(id);
    for (const id of discoverModelsFromProvider(modelsDevData, "anthropic")) add(id);
  }
  if (hasProvider(config, PROVIDER_KEYS.CODEX)) {
    for (const id of CODEX_MODEL_IDS) add(id);
    for (const id of discoverModelsFromProvider(modelsDevData, "openai")) add(id);
  }
  const activeOAuthTypes = getActiveOAuthProviderTypes(oauthAccounts);

  if (!hasProvider(config, PROVIDER_KEYS.CLAUDE) && activeOAuthTypes.has("claude")) {
    for (const id of CLAUDE_MODEL_IDS) add(id);
    for (const id of discoverModelsFromProvider(modelsDevData, "anthropic")) add(id);
  }
  if (!hasProvider(config, PROVIDER_KEYS.GEMINI) && (activeOAuthTypes.has("gemini-cli") || activeOAuthTypes.has("antigravity"))) {
    for (const id of GEMINI_MODEL_IDS) add(id);
    for (const id of discoverModelsFromProvider(modelsDevData, "google")) add(id);
  }
  if (!hasProvider(config, PROVIDER_KEYS.CODEX) && activeOAuthTypes.has("codex")) {
    for (const id of CODEX_MODEL_IDS) add(id);
    for (const id of discoverModelsFromProvider(modelsDevData, "openai")) add(id);
  }

  if (hasProvider(config, PROVIDER_KEYS.OPENAI_COMPAT)) {
    for (const id of extractOpenAICompatModelIds(config)) add(id);
  }
  for (const id of extractOAuthModelAliasIds(config, oauthAccounts)) add(id);

  return ids;
}

export function pickBestModel(availableModels: string[], tierPriority: readonly string[]): string | null {
  for (const pattern of tierPriority) {
    const match = availableModels.find((m) => m.startsWith(pattern));
    if (match) return match;
  }
  return null;
}

export const AGENT_ROLES = {
  sisyphus: { tier: TIER_1, label: "Orchestrator" },
  atlas: { tier: TIER_1, label: "Master orchestrator" },
  prometheus: { tier: TIER_1, label: "Planner" },
  metis: { tier: TIER_2, label: "Plan consultant" },
  oracle: { tier: TIER_1, label: "Technical advisor" },
  librarian: { tier: TIER_2, label: "Research" },
  explore: { tier: TIER_3, label: "Fast exploration" },
  "multimodal-looker": { tier: TIER_2, label: "Vision" },
  momus: { tier: TIER_2, label: "Reviewer" },
} as const;

export const CATEGORY_ROLES = {
  "visual-engineering": { tier: TIER_4, label: "UI work" },
  ultrabrain: { tier: TIER_1, label: "Hard logic" },
  deep: { tier: TIER_1, label: "Deep problem solving" },
  artistry: { tier: TIER_4, label: "Creative work" },
  quick: { tier: TIER_3, label: "Trivial tasks" },
  "unspecified-low": { tier: TIER_2, label: "Low effort general" },
  "unspecified-high": { tier: TIER_1, label: "High effort general" },
  writing: { tier: TIER_3, label: "Documentation" },
} as const;

interface ModelAssignment {
  model: string;
  variant?: string;
  temperature?: number;
  prompt_append?: string;
  description?: string;
}

export function enrichTierForRole(tier: readonly string[], modelsDevData: import("./shared").ModelsDevData | null): string[] {
  if (tier === TIER_1) return buildEnrichedTier(tier, 1, modelsDevData);
  if (tier === TIER_2) return buildEnrichedTier(tier, 2, modelsDevData);
  if (tier === TIER_3) return buildEnrichedTier(tier, 3, modelsDevData);
  if (tier === TIER_4) return buildEnrichedTier(tier, 4, modelsDevData);
  return [...tier];
}

// Backward compatibility type alias
export type AgentModelOverrides = OhMyOpenCodeFullConfig;

export function buildOhMyOpenCodeConfig(
  availableModels: string[],
  modelsDevData: import("./shared").ModelsDevData | null,
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
      const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
      const model = pickBestModel(availableModels, enrichedTier);
      if (!model) continue;
      entry = { model: `cliproxyapi/${model}` };
    }
    if (agentOverride?.variant) entry.variant = agentOverride.variant;
    if (agentOverride?.temperature !== undefined) entry.temperature = agentOverride.temperature;
    if (agentOverride?.prompt_append) entry.prompt_append = agentOverride.prompt_append;
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
      const enrichedTier = enrichTierForRole(role.tier, modelsDevData);
      const model = pickBestModel(availableModels, enrichedTier);
      if (!model) continue;
      entry = { model: `cliproxyapi/${model}` };
    }
    if (categoryOverride?.variant) entry.variant = categoryOverride.variant;
    if (categoryOverride?.temperature !== undefined) entry.temperature = categoryOverride.temperature;
    if (categoryOverride?.description) entry.description = categoryOverride.description;
    categories[category] = entry;
  }

  if (Object.keys(agents).length === 0 && Object.keys(categories).length === 0) {
    return null;
  }

  const config: Record<string, unknown> = {
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
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

  // Tmux — only include if user configured it
  if (overrides?.tmux) config.tmux = overrides.tmux;

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

  return config;
}

import bundledPresetData from "./oh-my-opencode-presets.json";

import { fetchWithRetry } from "@/lib/fetch-utils";
import { isRecord } from "@/lib/utils";

import {
  type AgentConfigEntry,
  type AgentThinkingConfig,
  type OhMyOpenCodeFullConfig,
  type OhMyOpenCodePreset,
  readPermissionConfig,
  validateFullConfig,
} from "./oh-my-opencode-types";

const DEFAULT_PRESETS_REPO = process.env.GITHUB_REPO || "itsmylife44/cliproxyapi-dashboard";
const DEFAULT_PRESETS_SOURCE_URL =
  process.env.OH_MY_OPENCODE_PRESETS_SOURCE_URL ||
  `https://raw.githubusercontent.com/${DEFAULT_PRESETS_REPO}/main/dashboard/src/lib/config-generators/oh-my-opencode-presets.json`;


function hasMeaningfulConfig(config: OhMyOpenCodeFullConfig): boolean {
  return Object.values(config).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "object" && value !== null) {
      return Object.keys(value).length > 0;
    }

    return value !== undefined;
  });
}

function pruneEmptyEntries(config: OhMyOpenCodeFullConfig): OhMyOpenCodeFullConfig {
  const agents = config.agents
    ? Object.fromEntries(
        Object.entries(config.agents).filter(([, entry]) => Object.keys(entry).length > 0)
      )
    : undefined;

  const categories = config.categories
    ? Object.fromEntries(
        Object.entries(config.categories).filter(([, entry]) => Object.keys(entry).length > 0)
      )
    : undefined;

  return {
    ...config,
    ...(agents && Object.keys(agents).length > 0 ? { agents } : { agents: undefined }),
    ...(categories && Object.keys(categories).length > 0 ? { categories } : { categories: undefined }),
  };
}

function readThinkingConfig(value: unknown): AgentThinkingConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const type = value.type;
  if (type !== "enabled" && type !== "disabled") {
    return undefined;
  }

  const thinking: AgentThinkingConfig = { type };
  if (typeof value.budgetTokens === "number" && value.budgetTokens >= 0) {
    thinking.budgetTokens = value.budgetTokens;
  }

  return thinking;
}

function mergeAgentExtras(rawConfig: unknown, validatedConfig: OhMyOpenCodeFullConfig): OhMyOpenCodeFullConfig {
  if (!isRecord(rawConfig) || !isRecord(rawConfig.agents) || !validatedConfig.agents) {
    return validatedConfig;
  }

  const mergedAgents: Record<string, AgentConfigEntry> = { ...validatedConfig.agents };

  for (const [agentName, rawEntry] of Object.entries(rawConfig.agents)) {
    if (!isRecord(rawEntry) || !mergedAgents[agentName]) {
      continue;
    }

    const permission = readPermissionConfig(rawEntry.permission);
    const thinking = readThinkingConfig(rawEntry.thinking);

    if (!permission && !thinking) {
      continue;
    }

    mergedAgents[agentName] = {
      ...mergedAgents[agentName],
      ...(permission ? { permission } : {}),
      ...(thinking ? { thinking } : {}),
    };
  }

  return { ...validatedConfig, agents: mergedAgents };
}

export function validatePresetList(raw: unknown): OhMyOpenCodePreset[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const name = entry.name;
    const description = entry.description;
    const config = entry.config;

    if (typeof name !== "string" || typeof description !== "string" || !isRecord(config)) {
      return [];
    }

    const validatedConfig = pruneEmptyEntries(
      mergeAgentExtras(config, validateFullConfig(config))
    );
    if (!hasMeaningfulConfig(validatedConfig)) {
      return [];
    }

    return [{
      name,
      description,
      config: validatedConfig,
    } satisfies OhMyOpenCodePreset];
  });
}

const bundledOfficialPresets = validatePresetList(bundledPresetData);

export function getBundledOhMyOpenCodePresets(): OhMyOpenCodePreset[] {
  return bundledOfficialPresets;
}

export async function loadOfficialOhMyOpenCodePresets(): Promise<OhMyOpenCodePreset[]> {
  try {
    const response = await fetchWithRetry(DEFAULT_PRESETS_SOURCE_URL, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "cliproxyapi-dashboard/oh-my-opencode-presets",
      },
      timeout: 10_000,
      disableRetry: false,
    });

    if (!response.ok) {
      await response.body?.cancel();
      return bundledOfficialPresets;
    }

    const data = await response.json();
    const validated = validatePresetList(data);
    return validated.length > 0 ? validated : bundledOfficialPresets;
  } catch {
    return bundledOfficialPresets;
  }
}

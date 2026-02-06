export const PROVIDER_KEYS = {
  GEMINI: "gemini-api-key",
  CLAUDE: "claude-api-key",
  CODEX: "codex-api-key",
  OPENAI_COMPAT: "openai-compatibility",
} as const;

export interface OAuthAccount {
  id: string;
  name: string;
  type?: string;
  provider?: string;
  disabled?: boolean;
}

export interface ConfigData {
  "gemini-api-key"?: unknown;
  "claude-api-key"?: unknown;
  "codex-api-key"?: unknown;
  "openai-compatibility"?: unknown;
  "oauth-model-alias"?: unknown;
}

export interface ModelsDevModelModalities {
  input?: string[];
  output?: string[];
}

export interface ModelsDevModelCost {
  input?: number;
  output?: number;
}

export interface ModelsDevModelLimit {
  context?: number;
  output?: number;
}

export interface ModelsDevModel {
  id: string;
  name: string;
  family?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  attachment?: boolean;
  modalities?: ModelsDevModelModalities;
  cost?: ModelsDevModelCost;
  limit?: ModelsDevModelLimit;
}

export interface ModelsDevProvider {
  models: Record<string, ModelsDevModel>;
}

export type ModelsDevData = Record<string, ModelsDevProvider>;

export const OAUTH_PROVIDER_MAP: Record<string, { providerKey: string; modelsDevKey: string }> = {
  claude: { providerKey: "claude-api-key", modelsDevKey: "anthropic" },
  "gemini-cli": { providerKey: "gemini-api-key", modelsDevKey: "google" },
  antigravity: { providerKey: "gemini-api-key", modelsDevKey: "google" },
  codex: { providerKey: "codex-api-key", modelsDevKey: "openai" },
};

export function getActiveOAuthProviderTypes(oauthAccounts: OAuthAccount[]): Set<string> {
  const types = new Set<string>();
  for (const account of oauthAccounts) {
    if (!account.disabled) {
      const provider = account.provider || account.type;
      if (provider) types.add(provider);
    }
  }
  return types;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function hasProvider(config: ConfigData | null, key: string): boolean {
  if (!config) return false;
  const value = config[key as keyof ConfigData];
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

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

export const OAUTH_PROVIDER_MAP: Record<string, { providerKey: string }> = {
  claude: { providerKey: "claude-api-key" },
  "gemini-cli": { providerKey: "gemini-api-key" },
  antigravity: { providerKey: "gemini-api-key" },
  codex: { providerKey: "codex-api-key" },
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

export interface ProxyModel {
  id: string;
  owned_by: string;
}

export async function fetchProxyModels(proxyUrl: string, apiKey: string): Promise<ProxyModel[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${proxyUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      await res.body?.cancel();
      return [];
    }
    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return [];
    return data.data.filter(
      (m: unknown): m is ProxyModel =>
        isRecord(m) && typeof m.id === "string" && typeof m.owned_by === "string"
    );
  } catch {
    return [];
  }
}

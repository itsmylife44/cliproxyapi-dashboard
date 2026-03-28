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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export interface ProxyModel {
  id: string;
  owned_by: string;
}

export function buildAvailableModelIds(
  proxyModels: ProxyModel[],
  oauthAliasIds: string[],
): string[] {
  return [...new Set([...proxyModels.map((m) => m.id), ...oauthAliasIds])]
    .sort((a, b) => a.localeCompare(b));
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

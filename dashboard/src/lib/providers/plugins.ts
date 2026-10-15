import "server-only";
import { logger } from "@/lib/logger";
import { fetchWithTimeout, isRecord, MANAGEMENT_API_KEY, MANAGEMENT_BASE_URL } from "./management-api";

/**
 * OAuth providers served by CLIProxyAPI plugins that are installed and active
 * (`GET /plugins`: plugin system on and `effective_enabled`). The returned ids
 * are what upstream routes `<id>-auth-url` to. Any failure yields `[]`, so
 * plugin-only logins stay hidden rather than offering a 404.
 */
export async function listEnabledPluginOAuthProviders(): Promise<string[]> {
  if (!MANAGEMENT_API_KEY) return [];
  try {
    const res = await fetchWithTimeout(`${MANAGEMENT_BASE_URL}/plugins`, {
      headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
    });
    if (!res.ok) {
      await res.body?.cancel();
      return [];
    }
    const data: unknown = await res.json();
    if (!isRecord(data) || data.plugins_enabled !== true || !Array.isArray(data.plugins)) return [];
    return data.plugins.flatMap((p) =>
      isRecord(p) && p.effective_enabled === true && p.supports_oauth === true && typeof p.oauth_provider === "string" && p.oauth_provider
        ? [p.oauth_provider.trim().toLowerCase()]
        : []
    );
  } catch (error) {
    logger.warn({ err: error }, "listEnabledPluginOAuthProviders failed");
    return [];
  }
}

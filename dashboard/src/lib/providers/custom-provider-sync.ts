import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { invalidateProxyModelsCache } from "@/lib/cache";

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface SyncProviderData {
  providerId: string;
  prefix?: string | null;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string | null;
  headers?: Record<string, string> | null;
  models: Array<{ upstreamName: string; alias: string }>;
  excludedModels: Array<{ pattern: string }>;
}

export interface SyncResult {
  syncStatus: "ok" | "failed";
  syncMessage?: string;
}

interface ManagementProviderEntry {
  name?: string;
  [key: string]: unknown;
}

function isManagementProviderEntry(value: unknown): value is ManagementProviderEntry {
  return typeof value === "object" && value !== null;
}

/**
 * Syncs a custom provider to CLIProxyAPI Management API.
 * 
 * For POST (create): Adds new provider entry to openai-compatibility list.
 * For PATCH (update): Updates existing provider entry in openai-compatibility list.
 * 
 * @param providerData - Provider configuration data
 * @param operation - "create" or "update"
 * @returns Sync status and optional error message
 */
export async function syncCustomProviderToProxy(
  providerData: SyncProviderData,
  operation: "create" | "update"
): Promise<SyncResult> {
  const managementUrl = env.CLIPROXYAPI_MANAGEMENT_URL;
  const secretKey = env.MANAGEMENT_API_KEY;

  if (!secretKey) {
    return {
      syncStatus: "failed",
      syncMessage: "Backend sync unavailable - management API key not configured"
    };
  }

  try {
    const getRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
      headers: { "Authorization": `Bearer ${secretKey}` }
    });
    
    if (!getRes.ok) {
      logger.error({ status: getRes.status }, "Failed to fetch current config from Management API");
      return {
        syncStatus: "failed",
        syncMessage: `Backend sync failed - provider ${operation === "create" ? "created" : "updated"} but may not work immediately`
      };
    }

    const configData = await getRes.json() as Record<string, unknown>;
    const openAiCompatibility = configData["openai-compatibility"];
    const currentList: ManagementProviderEntry[] = Array.isArray(openAiCompatibility)
      ? openAiCompatibility.filter(isManagementProviderEntry)
      : [];

    const newEntry = {
      name: providerData.providerId,
      prefix: providerData.prefix,
      "base-url": providerData.baseUrl,
      "api-key-entries": [{ 
        "api-key": providerData.apiKey,
        ...(providerData.proxyUrl ? { "proxy-url": providerData.proxyUrl } : {})
      }],
      models: providerData.models.map(m => ({ name: m.upstreamName, alias: m.alias })),
      "excluded-models": providerData.excludedModels.map(e => e.pattern),
      ...(providerData.headers ? { headers: providerData.headers } : {})
    };

    let newList: unknown[];
    if (operation === "create") {
      newList = [...currentList, newEntry];
    } else {
      // Update: replace existing entry with same providerId
      newList = currentList.map((entry) => 
        entry.name === providerData.providerId ? newEntry : entry
      );
    }

    const putRes = await fetchWithTimeout(`${managementUrl}/openai-compatibility`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}` 
      },
      body: JSON.stringify(newList)
    });

    if (!putRes.ok) {
      logger.error({ status: putRes.status }, `Failed to sync custom provider to Management API (${operation})`);
      return {
        syncStatus: "failed",
        syncMessage: `Backend sync failed - provider ${operation === "create" ? "created" : "updated"} but may not work immediately`
      };
    }

    invalidateProxyModelsCache();

    return {
      syncStatus: "ok"
    };

  } catch (syncError) {
    logger.error({ err: syncError }, `Failed to sync custom provider to Management API (${operation})`);
    return {
      syncStatus: "failed",
      syncMessage: `Backend sync failed - provider ${operation === "create" ? "created" : "updated"} but may not work immediately`
    };
  }
}

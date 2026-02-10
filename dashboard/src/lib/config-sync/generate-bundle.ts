import crypto from "crypto";
import { prisma } from "@/lib/db";
import { buildAvailableModelsFromProxy, extractOAuthModelAliases, getProxyUrl, type McpEntry, type ModelDefinition } from "@/lib/config-generators/opencode";
import { buildOhMyOpenCodeConfig } from "@/lib/config-generators/oh-my-opencode";
import { fetchProxyModels, type ProxyModel } from "@/lib/config-generators/shared";
import { validateFullConfig, type OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { ConfigData, OAuthAccount } from "@/lib/config-generators/shared";
import { proxyModelsCache, CACHE_TTL, CACHE_KEYS } from "@/lib/cache";

async function fetchProxyModelsCached(proxyUrl: string, apiKey: string): Promise<ProxyModel[]> {
  const cacheKey = CACHE_KEYS.proxyModels(proxyUrl, apiKey);
  const cached = proxyModelsCache.get(cacheKey) as ProxyModel[] | null;
  if (cached) return cached;

  const models = await fetchProxyModels(proxyUrl, apiKey);
  proxyModelsCache.set(cacheKey, models, CACHE_TTL.PROXY_MODELS);
  return models;
}

interface ManagementFetchParams {
  path: string;
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    (key) =>
      JSON.stringify(key) + ":" + stableStringify((obj as Record<string, unknown>)[key])
  );
  return "{" + pairs.join(",") + "}";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const filtered = value.filter((item): item is string => typeof item === "string");
  return filtered.length > 0 ? filtered : null;
}

function getFrozenExcludedModels(frozenConfig: unknown): string[] | null {
  if (!isRecord(frozenConfig)) return null;
  
  if (Array.isArray(frozenConfig.excludedModels)) {
    return readStringArray(frozenConfig.excludedModels);
  }
  
  if (isRecord(frozenConfig.modelPreference)) {
    const modelPref = frozenConfig.modelPreference;
    if (Array.isArray(modelPref.excludedModels)) {
      return readStringArray(modelPref.excludedModels);
    }
  }
  
  return null;
}

function getFrozenOverrides(frozenConfig: unknown): OhMyOpenCodeFullConfig | undefined {
  if (!isRecord(frozenConfig)) return undefined;
  
  if (isRecord(frozenConfig.overrides)) {
    return validateFullConfig(frozenConfig.overrides);
  }
  
  if (isRecord(frozenConfig.agentModelOverride)) {
    const agentOverride = frozenConfig.agentModelOverride;
    if (isRecord(agentOverride.overrides)) {
      return validateFullConfig(agentOverride.overrides);
    }
  }
  
  return undefined;
}

async function fetchManagementJson({ path }: ManagementFetchParams) {
  try {
    const baseUrl =
      process.env.CLIPROXYAPI_MANAGEMENT_URL ||
      "http://cliproxyapi:8317/v0/management";
    const res = await fetch(`${baseUrl}/${path}`, {
      headers: {
        Authorization: `Bearer ${process.env.MANAGEMENT_API_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractApiKeyStrings(data: unknown): string[] {
  if (typeof data !== "object" || data === null) return [];
  const record = data as Record<string, unknown>;
  const keys = record["api-keys"];
  if (!Array.isArray(keys)) return [];
  return keys.filter((key): key is string => typeof key === "string");
}

function extractOAuthAccounts(data: unknown): OAuthAccount[] {
   if (typeof data !== "object" || data === null) return [];
   const record = data as Record<string, unknown>;
   const files = record["files"];
   if (!Array.isArray(files)) return [];
   return files
     .filter(
       (entry): entry is Record<string, unknown> =>
         typeof entry === "object" && entry !== null && "name" in entry
     )
     .map((entry) => ({
       id: typeof entry.id === "string" ? entry.id : String(entry.name),
       name: String(entry.name),
       type: typeof entry.type === "string" ? entry.type : undefined,
       provider: typeof entry.provider === "string" ? entry.provider : undefined,
       disabled:
         typeof entry.disabled === "boolean" ? entry.disabled : undefined,
     }));
}

interface CustomProviderEntry {
  name: string;
  prefix?: string;
  "base-url": string;
  "api-key-entries": Array<{
    "api-key": string;
    "proxy-url"?: string;
  }>;
  models: Array<{
    name: string;
    alias: string;
  }>;
  "excluded-models"?: string[];
  headers?: Record<string, unknown>;
}

function extractCustomProviders(data: unknown): CustomProviderEntry[] {
  if (typeof data !== "object" || data === null) return [];
  const record = data as Record<string, unknown>;
  const providers = record["openai-compatibility"];
  if (!Array.isArray(providers)) return [];
  return providers.filter(
    (entry): entry is CustomProviderEntry =>
      typeof entry === "object" &&
      entry !== null &&
      "name" in entry &&
      "base-url" in entry &&
      "api-key-entries" in entry &&
      "models" in entry
  );
}

function buildCustomProviderModels(
  customProviders: CustomProviderEntry[]
): Record<string, ModelDefinition> {
  const models: Record<string, ModelDefinition> = {};
  
  for (const provider of customProviders) {
    for (const model of provider.models) {
      const modelId = `${provider.name}/${model.alias}`;
      models[modelId] = {
        name: model.alias,
        context: 200000,
        output: 64000,
        attachment: true,
        reasoning: false,
        modalities: { input: ["text", "image"], output: ["text"] },
      };
    }
  }
  
  return models;
}

interface ConfigBundle {
  version: string;
  opencode: Record<string, unknown>;
  ohMyOpencode: Record<string, unknown> | null;
}

export async function generateConfigBundle(userId: string, syncApiKey?: string | null): Promise<ConfigBundle> {
  // 1. Fetch management config
  const managementConfig = await fetchManagementJson({ path: "config" });

  // 2. Fetch auth-files from management API (for OAuth accounts)
  const authFilesData = await fetchManagementJson({ path: "auth-files" });
  const oauthAccounts = extractOAuthAccounts(authFilesData);

   // 3. Fetch api-keys from management API
   const apiKeysData = await fetchManagementJson({ path: "api-keys" });
   const apiKeyStrings = extractApiKeyStrings(apiKeysData);

   // 4. Fetch custom providers from management API (contains API keys)
   const customProvidersData = await fetchManagementJson({ path: "config" });
   const customProviders = extractCustomProviders(customProvidersData);

   // 5. Fetch user's ModelPreference, AgentModelOverride, UserApiKey, and ConfigSubscription from Prisma
   const [modelPreference, agentOverride, userApiKey, subscription] = await Promise.all([
     prisma.modelPreference.findUnique({ where: { userId } }),
     prisma.agentModelOverride.findUnique({ where: { userId } }),
     prisma.userApiKey.findFirst({
       where: { userId },
       orderBy: { createdAt: "asc" },
       select: { key: true },
     }),
     prisma.configSubscription.findUnique({
       where: { userId },
       include: { template: true },
     }),
   ]);

  // 6. Parse frozen config if subscription exists
  const frozenExcludedModels = subscription?.frozenConfig 
    ? getFrozenExcludedModels(subscription.frozenConfig)
    : null;
  const frozenOverrides = subscription?.frozenConfig
    ? getFrozenOverrides(subscription.frozenConfig)
    : undefined;
  
  // 7. Check if subscription is active and template exists
  const hasActiveSubscription = subscription?.isActive && subscription.template?.isActive;
  
  // 8. Load publisher's live config if subscription is active and no frozen data available
  let publisherModelPreference = null;
  let publisherAgentOverride = null;
  
  if (hasActiveSubscription && !frozenExcludedModels && !frozenOverrides && subscription?.template) {
    const publisherId = subscription.template.userId;
    [publisherModelPreference, publisherAgentOverride] = await Promise.all([
      prisma.modelPreference.findUnique({ where: { userId: publisherId } }),
      prisma.agentModelOverride.findUnique({ where: { userId: publisherId } }),
    ]);
  }

  // 9. Determine which config to use for model selection
  let effectiveExcludedModels: string[];
  if (frozenExcludedModels !== null) {
    effectiveExcludedModels = frozenExcludedModels;
  } else if (hasActiveSubscription && publisherModelPreference) {
    effectiveExcludedModels = publisherModelPreference.excludedModels;
  } else {
    effectiveExcludedModels = modelPreference?.excludedModels || [];
  }
  
  const subscriberOverrides = agentOverride?.overrides ? validateFullConfig(agentOverride.overrides) : undefined;
  const publisherOverrides = publisherAgentOverride?.overrides ? validateFullConfig(publisherAgentOverride.overrides) : undefined;
  
  // 10. Determine base overrides (frozen, live publisher, or subscriber)
  let baseOverrides: OhMyOpenCodeFullConfig | undefined;
  if (frozenOverrides !== undefined) {
    baseOverrides = frozenOverrides;
  } else if (hasActiveSubscription && publisherOverrides) {
    baseOverrides = publisherOverrides;
  } else {
    baseOverrides = subscriberOverrides;
  }
  
  // 11. Merge overrides: use base (frozen/publisher), merge subscriber MCPs and plugins on top
  let agentOverrides: OhMyOpenCodeFullConfig | undefined;
  if (frozenOverrides !== undefined || (hasActiveSubscription && publisherOverrides)) {
    agentOverrides = {
      ...baseOverrides,
      mcpServers: [
        ...(baseOverrides?.mcpServers ?? []),
        ...(subscriberOverrides?.mcpServers ?? []),
      ],
      customPlugins: [
        ...(baseOverrides?.customPlugins ?? []),
        ...(subscriberOverrides?.customPlugins ?? []),
      ],
    };
  } else {
    agentOverrides = subscriberOverrides;
  }

   const excludedModels = new Set(effectiveExcludedModels);
   
   for (const provider of customProviders) {
     if (Array.isArray(provider["excluded-models"])) {
       for (const pattern of provider["excluded-models"]) {
         excludedModels.add(pattern);
       }
     }
   }

   let resolvedSyncApiKey: string | null = null;
   if (syncApiKey) {
     const syncKeyRecord = await prisma.userApiKey.findUnique({
       where: { id: syncApiKey },
       select: { key: true },
     });
     resolvedSyncApiKey = syncKeyRecord?.key || null;
   }

   const apiKey = resolvedSyncApiKey || userApiKey?.key || (apiKeyStrings.length > 0 ? apiKeyStrings[0] : "no-api-key-create-one-in-dashboard");

   const proxyUrl = getProxyUrl();
   const proxyModels = apiKey !== "no-api-key-create-one-in-dashboard"
     ? await fetchProxyModelsCached(proxyUrl, apiKey)
     : [];
   const allModels: Record<string, ModelDefinition> = {
     ...buildAvailableModelsFromProxy(proxyModels),
     ...extractOAuthModelAliases(managementConfig as ConfigData | null, oauthAccounts),
     ...buildCustomProviderModels(customProviders),
   };

   const filteredModels = Object.fromEntries(
     Object.entries(allModels).filter(([modelId]) => !excludedModels.has(modelId))
   );

   const modelEntries: Record<string, Record<string, unknown>> = {};
   const sortedFilteredIds = Object.keys(filteredModels).sort();
   for (const id of sortedFilteredIds) {
     const def = filteredModels[id];
     const entry: Record<string, unknown> = {
       name: def.name,
       attachment: def.attachment,
       modalities: def.modalities,
       limit: { context: def.context, output: def.output },
     };
     if (def.reasoning) {
       entry.reasoning = true;
     }
     if (def.options) {
       entry.options = def.options;
     }
     modelEntries[id] = entry;
   }

   const firstModelId = sortedFilteredIds[0] ?? "gemini-2.5-flash";

   const mcpEntries: McpEntry[] = agentOverrides?.mcpServers ?? [];
   const customPlugins = agentOverrides?.customPlugins ?? [];
   
   const defaultPlugins = ["opencode-cliproxyapi-sync@latest", "oh-my-opencode@latest", "opencode-anthropic-auth@latest"];
   const pluginSet = new Set([...defaultPlugins, ...customPlugins]);
   const plugins = Array.from(pluginSet).sort();

   const providers: Record<string, Record<string, unknown>> = {
     cliproxyapi: {
       npm: "@ai-sdk/openai-compatible",
       name: "CLIProxyAPI",
       options: {
         baseURL: `${proxyUrl}/v1`,
         apiKey,
       },
       models: modelEntries,
     },
   };

   if (customProviders.length > 0) {
     const openaiCompatibilityProviders: CustomProviderEntry[] = [];
     for (const provider of customProviders) {
       if (provider["api-key-entries"] && provider["api-key-entries"].length > 0) {
         openaiCompatibilityProviders.push(provider);
       }
     }

     if (openaiCompatibilityProviders.length > 0) {
       providers.cliproxyapi = {
         ...providers.cliproxyapi,
         "openai-compatibility": openaiCompatibilityProviders.map((cp) => ({
           name: cp.name,
           prefix: cp.prefix,
           "base-url": cp["base-url"],
           "api-key-entries": cp["api-key-entries"],
           models: cp.models,
           ...(cp["excluded-models"] ? { "excluded-models": cp["excluded-models"] } : {}),
           ...(cp.headers ? { headers: cp.headers } : {}),
         })),
       };
     }
   }

   const opencodeConfig: Record<string, unknown> = {
     $schema: "https://opencode.ai/config.json",
     plugin: plugins,
     provider: providers,
     model: `cliproxyapi/${firstModelId}`,
   };

   if (mcpEntries.length > 0) {
    const mcpServers: Record<string, Record<string, unknown>> = {};
    for (const mcp of mcpEntries) {
      if (mcp.type === "remote") {
        mcpServers[mcp.name] = {
          type: "remote",
          url: mcp.url,
        };
      } else if (mcp.type === "local") {
        mcpServers[mcp.name] = {
          type: "local",
          command: mcp.command,
        };
      }
    }
    opencodeConfig.mcp = mcpServers;
  }

   const ohMyOpencodeConfig = buildOhMyOpenCodeConfig(
     sortedFilteredIds,
     agentOverrides
   );

   // 11. Compute version hash
   const bundleForHash = {
     opencode: opencodeConfig,
     ohMyOpencode: ohMyOpencodeConfig,
   };
   const version = crypto
     .createHash("sha256")
     .update(stableStringify(bundleForHash))
     .digest("hex");

  // 12. Return bundle
  return {
    version,
    opencode: opencodeConfig,
    ohMyOpencode: ohMyOpencodeConfig,
  };
}

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { buildAvailableModels, PROXY_URL, type McpEntry } from "@/lib/config-generators/opencode";
import { buildAvailableModelIds, buildOhMyOpenCodeConfig } from "@/lib/config-generators/oh-my-opencode";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { ConfigData, OAuthAccount, ModelsDevData } from "@/lib/config-generators/shared";

interface ManagementFetchParams {
  path: string;
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
    return frozenConfig.overrides as OhMyOpenCodeFullConfig;
  }
  
  if (isRecord(frozenConfig.agentModelOverride)) {
    const agentOverride = frozenConfig.agentModelOverride;
    if (isRecord(agentOverride.overrides)) {
      return agentOverride.overrides as OhMyOpenCodeFullConfig;
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

async function fetchModelsDevData() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://models.dev/api.json", {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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

  // 3. Fetch models.dev data
  const modelsDevData: ModelsDevData | null = await fetchModelsDevData();

  // 4. Fetch api-keys from management API
  const apiKeysData = await fetchManagementJson({ path: "api-keys" });
  const apiKeyStrings = extractApiKeyStrings(apiKeysData);

  // 5. Fetch user's ModelPreference, AgentModelOverride, UserApiKey, and ConfigSubscription from Prisma
  const [modelPreference, agentOverride, userApiKey, subscription] = await Promise.all([
    prisma.modelPreference.findUnique({ where: { userId } }),
    prisma.agentModelOverride.findUnique({ where: { userId } }),
    prisma.userApiKey.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
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
  
  const subscriberOverrides = agentOverride?.overrides as OhMyOpenCodeFullConfig | undefined;
  const publisherOverrides = publisherAgentOverride?.overrides as OhMyOpenCodeFullConfig | undefined;
  
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

  // 13. Extract excluded models from effective config
  const excludedModels = new Set(effectiveExcludedModels);

  // 7. Build available models and filter out excluded
  const allModels = buildAvailableModels(
    managementConfig as ConfigData | null,
    oauthAccounts,
    modelsDevData
  );

  const filteredModels = Object.fromEntries(
    Object.entries(allModels).filter(([modelId]) => !excludedModels.has(modelId))
  );

  let resolvedSyncApiKey: string | null = null;
  if (syncApiKey) {
    const syncKeyRecord = await prisma.userApiKey.findUnique({
      where: { id: syncApiKey },
      select: { key: true },
    });
    resolvedSyncApiKey = syncKeyRecord?.key || null;
  }

  const apiKey = resolvedSyncApiKey || userApiKey?.key || (apiKeyStrings.length > 0 ? apiKeyStrings[0] : "your-api-key");

  // 9. Build opencode config object (replicate generateConfigJson but return object)
  const modelEntries: Record<string, Record<string, unknown>> = {};
  for (const [id, def] of Object.entries(filteredModels)) {
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

  const firstModelId = Object.keys(filteredModels)[0] ?? "gemini-2.5-flash";

  const mcpEntries: McpEntry[] = agentOverrides?.mcpServers ?? [];
  const customPlugins = agentOverrides?.customPlugins ?? [];
  
  const defaultPlugins = ["opencode-cliproxyapi-sync@latest", "oh-my-opencode@latest", "opencode-anthropic-auth@latest"];
  const pluginSet = new Set([...defaultPlugins, ...customPlugins]);
  const plugins = Array.from(pluginSet);

  const opencodeConfig: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    plugin: plugins,
    provider: {
      cliproxyapi: {
        npm: "@ai-sdk/openai-compatible",
        name: "CLIProxyAPI",
        options: {
          baseURL: `${PROXY_URL}/v1`,
          apiKey,
        },
        models: modelEntries,
      },
    },
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

  // 10. Build oh-my-opencode config
  const availableModelIds = buildAvailableModelIds(
    managementConfig as ConfigData | null,
    oauthAccounts,
    modelsDevData
  );
  const filteredModelIds = availableModelIds.filter(
    (modelId) => !excludedModels.has(modelId)
  );
  const ohMyOpencodeConfig = buildOhMyOpenCodeConfig(
    filteredModelIds,
    modelsDevData,
    agentOverrides
  );

  // 11. Compute version hash
  const bundleForHash = {
    opencode: opencodeConfig,
    ohMyOpencode: ohMyOpencodeConfig,
  };
  const version = crypto
    .createHash("sha256")
    .update(JSON.stringify(bundleForHash))
    .digest("hex");

  // 12. Return bundle
  return {
    version,
    opencode: opencodeConfig,
    ohMyOpencode: ohMyOpencodeConfig,
  };
}

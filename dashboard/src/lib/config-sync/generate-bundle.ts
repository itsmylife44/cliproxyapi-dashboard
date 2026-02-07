import crypto from "crypto";
import { prisma } from "@/lib/db";
import { buildAvailableModels, PROXY_URL, type McpEntry } from "@/lib/config-generators/opencode";
import { buildAvailableModelIds, buildOhMyOpenCodeConfig } from "@/lib/config-generators/oh-my-opencode";
import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import type { ConfigData, OAuthAccount, ModelsDevData } from "@/lib/config-generators/shared";

interface ManagementFetchParams {
  path: string;
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

  // 5. Fetch user's ModelPreference, AgentModelOverride, and UserApiKey from Prisma
  const [modelPreference, agentOverride, userApiKey] = await Promise.all([
    prisma.modelPreference.findUnique({ where: { userId } }),
    prisma.agentModelOverride.findUnique({ where: { userId } }),
    prisma.userApiKey.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const agentOverrides = agentOverride?.overrides as OhMyOpenCodeFullConfig | undefined;

  // 6. Extract excluded models from preferences
  const excludedModels = new Set(modelPreference?.excludedModels || []);

  // 7. Build available models and filter out excluded
  const allModels = buildAvailableModels(
    managementConfig as ConfigData | null,
    oauthAccounts,
    modelsDevData
  );

  const filteredModels = Object.fromEntries(
    Object.entries(allModels).filter(([modelId]) => !excludedModels.has(modelId))
  );

  // 8. Get API key: prefer syncApiKey from token, then user's key, then global fallback, then placeholder
  const apiKey = syncApiKey || userApiKey?.key || (apiKeyStrings.length > 0 ? apiKeyStrings[0] : "your-api-key");

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
      if (mcp.type === "http") {
        mcpServers[mcp.name] = {
          type: "http",
          url: mcp.url,
        };
      } else if (mcp.type === "stdio") {
        const args = mcp.args ?? [];
        mcpServers[mcp.name] = {
          command: mcp.command,
          ...(args.length > 0 && { args }),
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

import {
  isRecord,
  type ProxyModel,
} from "./shared";

export type { OAuthAccount, ConfigData } from "./shared";

export function getProxyUrl(): string {
  return process.env.API_URL || "";
}

export function getInternalProxyUrl(): string {
  const managementUrl = process.env.CLIPROXYAPI_MANAGEMENT_URL || "http://cliproxyapi:8317/v0/management";
  try {
    const url = new URL(managementUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://cliproxyapi:8317";
  }
}

export interface ModelDefinition {
  name: string;
  context: number;
  output: number;
  attachment: boolean;
  reasoning: boolean;
  modalities: { input: string[]; output: string[] };
  options?: Record<string, unknown>;
  /** The owned_by value from the proxy, used to determine provider routing */
  ownedBy?: string;
}

/**
 * Determines if a model should use the OpenAI Responses API provider (@ai-sdk/openai)
 * instead of the generic Chat Completions provider (@ai-sdk/openai-compatible).
 *
 * Models with owned_by="openai" are served through Codex OAuth tokens and route
 * through OpenAI's Responses API (/v1/responses), which uses a different SSE
 * protocol (event: response.created) than Chat Completions (data: {...}).
 */
export function isOpenAIResponsesModel(ownedBy: string): boolean {
  return ownedBy === "openai";
}

const DEFAULT_MODALITIES: { input: string[]; output: string[] } = { input: ["text", "image"], output: ["text"] };

function inferModelDefinition(modelId: string, ownedBy: string): ModelDefinition {
  const isReasoning = modelId.includes("thinking") ||
    modelId.includes("opus") ||
    modelId.includes("codex") ||
    modelId.includes("pro") ||
    modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4");

  let options: Record<string, unknown> | undefined;
  if (isReasoning) {
    if (modelId.includes("thinking") || ownedBy === "anthropic") {
      options = { thinking: { type: "enabled", budgetTokens: 10000 } };
    } else if (ownedBy === "openai" || modelId.includes("codex")) {
      options = { reasoning: { effort: "medium" } };
    }
  }

  let context = 200000;
  let output = 64000;
  if (ownedBy === "google" || ownedBy === "antigravity") {
    context = 1048576;
    output = 65536;
  } else if (ownedBy === "openai") {
    context = 400000;
    output = 128000;
  }

  const name = modelId
    .replace(/-\d{8}$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    name,
    context,
    output,
    attachment: true,
    reasoning: isReasoning,
    modalities: DEFAULT_MODALITIES,
    options,
    ownedBy,
  };
}

export function buildAvailableModelsFromProxy(
  proxyModels: ProxyModel[]
): Record<string, ModelDefinition> {
  const models: Record<string, ModelDefinition> = {};
  for (const pm of proxyModels) {
    models[pm.id] = inferModelDefinition(pm.id, pm.owned_by);
  }
  return models;
}

interface OAuthModelAlias {
  name: string;
  alias: string;
}

export function extractOAuthModelAliases(config: import("./shared").ConfigData | null, oauthAccounts: import("./shared").OAuthAccount[]): Record<string, ModelDefinition> {
   if (!config) return {};
   const aliases = config["oauth-model-alias"];
   if (!isRecord(aliases)) return {};

   const models: Record<string, ModelDefinition> = {};
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
      if (typeof alias.alias === "string" && typeof alias.name === "string") {
          const thinking = alias.alias.includes("thinking");
          models[alias.alias] = {
            name: `${alias.name} (via ${provider})`,
            context: 200000,
            output: 64000,
            attachment: true,
            reasoning: thinking,
            modalities: DEFAULT_MODALITIES,
            options: thinking
              ? { thinking: { type: "enabled", budgetTokens: 10000 } }
              : undefined,
          };
        }
     }
   }
   return models;
}

interface McpBaseFields {
  name: string;
  enabled?: boolean;
  environment?: Record<string, string>;
}

export type McpEntry =
  | (McpBaseFields & { type: "local"; command: string[] })
  | (McpBaseFields & { type: "remote"; url: string });

export interface LspEntry {
  language: string;
  command: string;
  extensions?: string[];
}

export interface GenerateConfigOptions {
  plugins?: string[];
  mcps?: McpEntry[];
  lsps?: LspEntry[];
}

export function generateConfigJson(
   apiKey: string,
   models: Record<string, ModelDefinition>,
   proxyUrl: string,
   options?: GenerateConfigOptions
 ): string {
   // Split models by provider type: OpenAI Responses API vs Chat Completions
   const openaiModelEntries: Record<string, Record<string, unknown>> = {};
   const compatModelEntries: Record<string, Record<string, unknown>> = {};
   for (const [id, def] of Object.entries(models)) {
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
     if (def.ownedBy && isOpenAIResponsesModel(def.ownedBy)) {
       openaiModelEntries[id] = entry;
     } else {
       compatModelEntries[id] = entry;
     }
   }
 
   const allModelIds = Object.keys(models);
   const firstModelId = allModelIds[0] ?? "gemini-2.5-flash";
   // Determine default model provider prefix
   const firstModel = models[firstModelId];
   const defaultModelProvider = firstModel?.ownedBy && isOpenAIResponsesModel(firstModel.ownedBy)
     ? "cliproxyapi-openai"
     : "cliproxyapi";
 
   const plugins = options?.plugins ?? [
     "opencode-cliproxyapi-sync@latest",
     "oh-my-opencode@latest",
     "opencode-anthropic-auth@latest",
   ];
 
   const providers: Record<string, Record<string, unknown>> = {};

   // Chat Completions provider for non-OpenAI models
   if (Object.keys(compatModelEntries).length > 0) {
     providers.cliproxyapi = {
       npm: "@ai-sdk/openai-compatible",
       name: "CLIProxyAPI",
       options: {
         baseURL: `${proxyUrl}/v1`,
         apiKey,
       },
       models: compatModelEntries,
     };
   }

   // OpenAI Responses API provider for OpenAI/Codex models
   if (Object.keys(openaiModelEntries).length > 0) {
     providers["cliproxyapi-openai"] = {
       npm: "@ai-sdk/openai",
       name: "CLIProxyAPI OpenAI",
       options: {
         baseURL: `${proxyUrl}/v1`,
         apiKey,
       },
       models: openaiModelEntries,
     };
   }

   const configObj: Record<string, unknown> = {
     $schema: "https://opencode.ai/config.json",
     plugin: plugins,
     provider: providers,
     model: `${defaultModelProvider}/${firstModelId}`,
   };

  if (options?.mcps && options.mcps.length > 0) {
    const mcpServers: Record<string, Record<string, unknown>> = {};
    for (const mcp of options.mcps) {
      const mcpEntry: Record<string, unknown> = {};
      if (mcp.type === "remote") {
        mcpEntry.type = "remote";
        mcpEntry.url = mcp.url;
      } else if (mcp.type === "local") {
        mcpEntry.type = "local";
        mcpEntry.command = mcp.command;
      }
      if (mcp.enabled !== undefined) {
        mcpEntry.enabled = mcp.enabled;
      }
      if (mcp.environment && Object.keys(mcp.environment).length > 0) {
        mcpEntry.environment = mcp.environment;
      }
      mcpServers[mcp.name] = mcpEntry;
    }
    configObj.mcp = mcpServers;
  }

  if (options?.lsps && options.lsps.length > 0) {
    const lspServers: Record<string, Record<string, unknown>> = {};
    for (const lsp of options.lsps) {
      const commandArray = lsp.command.trim().split(/\s+/);
      const lspEntry: Record<string, unknown> = {
        command: commandArray,
      };
      if (lsp.extensions && lsp.extensions.length > 0) {
        lspEntry.extensions = lsp.extensions;
      }
      lspServers[lsp.language] = lspEntry;
    }
    configObj.lsp = lspServers;
  }

  return JSON.stringify(configObj, null, 2);
}

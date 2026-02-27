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
}

const DEFAULT_MODALITIES: { input: string[]; output: string[] } = { input: ["text", "image"], output: ["text"] };

/**
 * Detect whether a model supports reasoning/thinking variants.
 * Narrow heuristic: only models explicitly named as thinking/reasoning,
 * or OpenAI o-series reasoning models. Avoids false positives on
 * generic names like "pro" or "opus" (non-thinking variants).
 */
function supportsReasoning(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (id.includes("thinking") || id.includes("reasoning")) return true;
  if (id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) return true;
  return false;
}

function inferModelDefinition(modelId: string, ownedBy: string): ModelDefinition {
  const isReasoning = supportsReasoning(modelId);

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
          models[alias.alias] = {
            name: `${alias.name} (via ${provider})`,
            context: 200000,
            output: 64000,
            attachment: true,
            reasoning: supportsReasoning(alias.alias),
            modalities: DEFAULT_MODALITIES,
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
   const modelEntries: Record<string, Record<string, unknown>> = {};
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
     modelEntries[id] = entry;
   }
   const firstModelId = Object.keys(models)[0] ?? "gemini-2.5-flash";
 
   const plugins = options?.plugins ?? [
     "opencode-cliproxyapi-sync@latest",
     "oh-my-opencode@latest",
     "opencode-anthropic-auth@latest",
   ];
 
   const configObj: Record<string, unknown> = {
     $schema: "https://opencode.ai/config.json",
     plugin: plugins,
     provider: {
       cliproxyapi: {
         npm: "@ai-sdk/openai-compatible",
         name: "CLIProxyAPI",
         options: {
           baseURL: `${proxyUrl}/v1`,
           apiKey,
         },
         models: modelEntries,
       },
     },
     model: `cliproxyapi/${firstModelId}`,
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

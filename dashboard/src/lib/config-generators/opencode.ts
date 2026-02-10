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

export type McpEntry =
  | { name: string; type: "local"; command: string[] }
  | { name: string; type: "remote"; url: string };

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
     if (def.options) {
       entry.options = def.options;
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

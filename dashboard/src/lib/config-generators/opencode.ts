import {
  isRecord,
  type ProxyModel,
} from "./shared";
import { modelsDevCache, CACHE_TTL, CACHE_KEYS } from "@/lib/cache";

export type { OAuthAccount, ConfigData } from "./shared";

export function getProxyUrl(): string {
  const apiUrl = process.env.API_URL?.trim();
  if (apiUrl) {
    return apiUrl;
  }

  const managementUrl = process.env.CLIPROXYAPI_MANAGEMENT_URL?.trim();
  if (!managementUrl) {
    return "";
  }

  try {
    const url = new URL(managementUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
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

export interface ModelsDevLimits {
  context: number;
  output: number;
}

const MODELS_DEV_URL = "https://models.dev/api.json";

/**
 * Primary providers whose model data takes priority when the same model ID
 * appears across multiple providers in the models.dev registry.
 */
const PRIORITY_PROVIDERS = [
  "anthropic", "openai", "google", "google-vertex",
  "xai", "deepseek", "mistral", "cohere", "amazon-bedrock",
];

/**
 * Fetch model context/output limits from models.dev (same source OpenCode uses).
 * Results are cached for 1 hour. Returns a flat map of modelId → {context, output}.
 * On failure, returns an empty map so the caller falls back to heuristics.
 */
export async function fetchModelsDevLimits(): Promise<Record<string, ModelsDevLimits>> {
  const cacheKey = CACHE_KEYS.modelsDev();
  const cached = modelsDevCache.get(cacheKey) as Record<string, ModelsDevLimits> | null;
  if (cached) return cached;

  try {
    const res = await fetch(MODELS_DEV_URL, {
      headers: { "User-Agent": "cliproxyapi-dashboard" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) {
      await res.body?.cancel();
      return {};
    }

    const data: Record<string, unknown> = await res.json();
    const lookup: Record<string, ModelsDevLimits> = {};

    // First pass: collect all models from every provider
    for (const prov of Object.values(data)) {
      if (!isRecord(prov) || !isRecord(prov.models)) continue;
      for (const [modelId, model] of Object.entries(prov.models)) {
        if (!isRecord(model) || !isRecord(model.limit)) continue;
        const ctx = model.limit.context;
        const out = model.limit.output;
        if (typeof ctx !== "number" || typeof out !== "number") continue;
        if (!lookup[modelId]) {
          lookup[modelId] = { context: ctx, output: out };
        }
      }
    }

    // Second pass: let priority providers override (they have the canonical values)
    for (const pid of PRIORITY_PROVIDERS) {
      const prov = data[pid];
      if (!isRecord(prov) || !isRecord(prov.models)) continue;
      for (const [modelId, model] of Object.entries(prov.models)) {
        if (!isRecord(model) || !isRecord(model.limit)) continue;
        const ctx = model.limit.context;
        const out = model.limit.output;
        if (typeof ctx !== "number" || typeof out !== "number") continue;
        lookup[modelId] = { context: ctx, output: out };
      }
    }

    modelsDevCache.set(cacheKey, lookup, CACHE_TTL.MODELS_DEV);
    return lookup;
  } catch {
    return {};
  }
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

export function inferModelDefinition(
  modelId: string,
  ownedBy: string,
  modelsDevLimits: Record<string, ModelsDevLimits>,
): ModelDefinition {
  const isReasoning = supportsReasoning(modelId);

  const devLimits = modelsDevLimits[modelId];
  let context: number;
  let output: number;

  if (devLimits) {
    context = devLimits.context;
    output = devLimits.output;
  } else {
    context = 200000;
    output = 64000;
    if (ownedBy === "google" || ownedBy === "antigravity") {
      context = 1048576;
      output = 65536;
    } else if (ownedBy === "openai") {
      context = 400000;
      output = 128000;
    }
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

/**
 * Deduplicate proxy models: prefer dot-notation (claude-opus-4.1) over
 * hyphenated (claude-opus-4-1), and drop dated variants (-20250514) when
 * the undated version exists. The proxy rotates accounts regardless of
 * which alias is used, so duplicates just clutter the config.
 */
function deduplicateProxyModels(proxyModels: ProxyModel[]): ProxyModel[] {
  const idSet = new Set(proxyModels.map((m) => m.id));
  
  const filtered = proxyModels.filter((pm) => {
    const id = pm.id;
    
    // 1. Drop dated variants (-YYYYMMDD) if the undated base exists
    const dateMatch = id.match(/^(.+)-\d{8}$/);
    if (dateMatch) {
      const base = dateMatch[1];
      if (idSet.has(base)) return false;
      // Also check if dot-notation of the base exists
      // e.g. claude-opus-4-1-20250805 -> base claude-opus-4-1 -> check claude-opus-4.1
      const dotBase = hyphenatedToDot(base);
      if (dotBase !== base && idSet.has(dotBase)) return false;
    }
    
    // 2. Drop hyphenated version if dot-notation exists
    //    e.g. claude-opus-4-1 -> claude-opus-4.1 exists -> drop
    const dotVersion = hyphenatedToDot(id);
    if (dotVersion !== id && idSet.has(dotVersion)) return false;
    
    return true;
  });

  return filtered.map((pm) => {
    const dotId = hyphenatedToDot(pm.id);
    return dotId !== pm.id ? { ...pm, id: dotId } : pm;
  });
}

/**
 * Convert hyphenated version numbers to dot notation.
 * claude-opus-4-1 -> claude-opus-4.1
 * claude-sonnet-4-5 -> claude-sonnet-4.5
 * Only converts trailing number-number patterns that look like versions.
 */
function hyphenatedToDot(id: string): string {
  // Match patterns like -4-1, -4-5, -3-7 at the end or before another hyphen segment
  // Be careful not to convert things like gpt-4o-2024 or claude-3-5-haiku
  // Strategy: convert the LAST occurrence of digit-digit that looks like a version
  return id.replace(/(\d+)-(\d+)$/, "$1.$2");
}

export function buildAvailableModelsFromProxy(
  proxyModels: ProxyModel[],
  modelsDevLimits: Record<string, ModelsDevLimits> = {},
): Record<string, ModelDefinition> {
  const deduplicated = deduplicateProxyModels(proxyModels);
  const models: Record<string, ModelDefinition> = {};
  for (const pm of deduplicated) {
    models[pm.id] = inferModelDefinition(pm.id, pm.owned_by, modelsDevLimits);
  }
  return models;
}

interface OAuthModelAlias {
  name: string;
  alias: string;
}

export function extractOAuthModelAliases(
  config: import("./shared").ConfigData | null,
  oauthAccounts: import("./shared").OAuthAccount[],
  modelsDevLimits: Record<string, ModelsDevLimits> = {},
): Record<string, ModelDefinition> {
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
          const devLimits = modelsDevLimits[alias.alias];
          models[alias.alias] = {
            name: `${alias.name} (via ${provider})`,
            context: devLimits?.context ?? 200000,
            output: devLimits?.output ?? 64000,
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

export interface PermissionConfig {
  edit?: "allow" | "deny";
  bash?: {
    git?: "allow" | "deny";
    test?: "allow" | "deny";
    [command: string]: "allow" | "deny" | undefined;
  };
}

export interface GenerateConfigOptions {
  plugins?: string[];
  mcps?: McpEntry[];
  lsps?: LspEntry[];
  defaultModel?: string;
  permission?: PermissionConfig;
}

function resolveConfigModel(
  models: Record<string, ModelDefinition>,
  options?: GenerateConfigOptions,
): string {
  const manualModel = options?.defaultModel?.trim();
  if (manualModel) {
    return manualModel.includes("/") ? manualModel : `cliproxyapi/${manualModel}`;
  }

  const fallbackModelId = Object.keys(models)[0] ?? "gemini-2.5-flash";
  return `cliproxyapi/${fallbackModelId}`;
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
   const configModel = resolveConfigModel(models, options);
 
   const plugins = options?.plugins ?? [
     "opencode-cliproxyapi-sync@latest",
     "oh-my-openagent@latest",
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
       model: configModel,
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

  if (options?.permission) {
    configObj.permission = options.permission;
  }

  return JSON.stringify(configObj, null, 2);
}

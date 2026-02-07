import {
  PROVIDER_KEYS,
  type ModelsDevModel,
  isRecord,
  hasProvider,
  getActiveOAuthProviderTypes,
} from "./shared";

export type { OAuthAccount, ConfigData, ModelsDevData } from "./shared";

export const PROXY_URL = process.env.CLIPROXYAPI_PROXY_URL || "https://proxy.loen-api.xyz";

export interface ModelDefinition {
  name: string;
  context: number;
  output: number;
  attachment: boolean;
  reasoning: boolean;
  modalities: { input: string[]; output: string[] };
  options?: Record<string, unknown>;
}

export const GEMINI_MODELS: Record<string, ModelDefinition> = {
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash", context: 1048576, output: 65535,
    attachment: true, reasoning: false, modalities: { input: ["text", "image"], output: ["text"] },
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro", context: 1048576, output: 65535,
    attachment: true, reasoning: false, modalities: { input: ["text", "image"], output: ["text"] },
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash", context: 1048576, output: 65535,
    attachment: true, reasoning: false, modalities: { input: ["text", "image"], output: ["text"] },
  },
};

export const CLAUDE_MODELS: Record<string, ModelDefinition> = {
  "claude-sonnet-4-5-20250514": {
    name: "Claude Sonnet 4.5", context: 200000, output: 64000,
    attachment: true, reasoning: false, modalities: { input: ["text", "image"], output: ["text"] },
  },
  "claude-opus-4-5-20250414": {
    name: "Claude Opus 4.5", context: 200000, output: 64000,
    attachment: true, reasoning: false, modalities: { input: ["text", "image"], output: ["text"] },
  },
};

export const CODEX_MODELS: Record<string, ModelDefinition> = {
  "codex-mini-latest": {
    name: "Codex Mini", context: 200000, output: 100000,
    attachment: true, reasoning: true, modalities: { input: ["text", "image"], output: ["text"] },
    options: { reasoning: { effort: "medium" } },
  },
  "o4-mini": {
    name: "O4 Mini", context: 200000, output: 100000,
    attachment: true, reasoning: true, modalities: { input: ["text", "image"], output: ["text"] },
    options: { reasoning: { effort: "medium" } },
  },
};

interface OAuthModelAlias {
  name: string;
  alias: string;
}

interface OpenAICompatProvider {
  name: string;
  prefix?: string;
  models?: string[];
}

const DEFAULT_MODALITIES: { input: string[]; output: string[] } = { input: ["text", "image"], output: ["text"] };

function resolveModalities(
  modalities: { input?: string[]; output?: string[] } | undefined
): { input: string[]; output: string[] } {
  if (!modalities) return DEFAULT_MODALITIES;
  return {
    input: modalities.input ?? DEFAULT_MODALITIES.input,
    output: modalities.output ?? DEFAULT_MODALITIES.output,
  };
}

function isThinkingModel(modelId: string): boolean {
  return modelId.includes("thinking");
}

function inferReasoningOptions(modelId: string, reasoning: boolean): Record<string, unknown> | undefined {
  if (!reasoning) return undefined;

  if (modelId.includes("thinking") || modelId.includes("claude")) {
    return { thinking: { type: "enabled", budgetTokens: 10000 } };
  }

  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) {
    return { reasoning: { effort: "medium" } };
  }

  if (modelId.includes("codex")) {
    return { reasoning: { effort: "medium" } };
  }

  return undefined;
}

function shouldExcludeModel(modelId: string): boolean {
  return (
    modelId.includes("embedding") ||
    modelId.includes("tts") ||
    modelId.includes("live") ||
    modelId.includes("preview-tts")
  );
}

export function extractOpenAICompatModels(config: import("./shared").ConfigData | null): Record<string, ModelDefinition> {
  if (!config) return {};
  const compat = config["openai-compatibility"];
  if (!Array.isArray(compat)) return {};

  const models: Record<string, ModelDefinition> = {};
  for (const entry of compat) {
    if (!isRecord(entry)) continue;
    const providerEntry = entry as unknown as OpenAICompatProvider;
    const prefix = typeof providerEntry.prefix === "string" ? providerEntry.prefix : "";
    const entryModels = providerEntry.models;
    if (Array.isArray(entryModels)) {
      for (const model of entryModels) {
        if (typeof model === "string") {
          const modelId = prefix ? `${prefix}${model}` : model;
          const reasoning = isThinkingModel(modelId);
          models[modelId] = {
            name: `${model} (${providerEntry.name || "OpenAI Compatible"})`,
            context: 128000,
            output: 16384,
            attachment: true,
            reasoning,
            modalities: DEFAULT_MODALITIES,
            options: reasoning ? { thinking: { type: "enabled", budgetTokens: 10000 } } : undefined,
          };
        }
      }
    }
  }
  return models;
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
          const thinking = isThinkingModel(alias.alias);
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

function enrichModelDefinition(
  modelId: string,
  fallback: ModelDefinition,
  modelsDevData: import("./shared").ModelsDevData | null,
  providerKey: string
): ModelDefinition {
  if (!modelsDevData) return fallback;
  
  const provider = modelsDevData[providerKey];
  if (!provider?.models) return fallback;
  
  const model = provider.models[modelId];
  if (!model) return fallback;
  
  return {
    name: model.name || fallback.name,
    context: model.limit?.context || fallback.context,
    output: model.limit?.output || fallback.output,
    attachment: model.attachment ?? fallback.attachment,
    reasoning: model.reasoning ?? fallback.reasoning,
    modalities: model.modalities ? resolveModalities(model.modalities) : fallback.modalities,
    options: fallback.options,
  };
}

export function buildAvailableModels(
  config: import("./shared").ConfigData | null,
  oauthAccounts: import("./shared").OAuthAccount[],
  modelsDevData: import("./shared").ModelsDevData | null
): Record<string, ModelDefinition> {
  const models: Record<string, ModelDefinition> = {};

  if (hasProvider(config, PROVIDER_KEYS.GEMINI)) {
    for (const [modelId, fallback] of Object.entries(GEMINI_MODELS)) {
      models[modelId] = enrichModelDefinition(modelId, fallback, modelsDevData, "google");
    }
    if (modelsDevData?.google?.models) {
      for (const [modelId, model] of Object.entries(modelsDevData.google.models)) {
        if (models[modelId]) continue;
        if (shouldExcludeModel(modelId)) continue;
        const reasoning = model.reasoning ?? false;
        models[modelId] = {
          name: model.name || modelId,
          context: model.limit?.context || 128000,
          output: model.limit?.output || 16384,
          attachment: model.attachment ?? true,
          reasoning,
          modalities: resolveModalities(model.modalities),
          options: inferReasoningOptions(modelId, reasoning),
        };
      }
    }
  }

  if (hasProvider(config, PROVIDER_KEYS.CLAUDE)) {
    for (const [modelId, fallback] of Object.entries(CLAUDE_MODELS)) {
      models[modelId] = enrichModelDefinition(modelId, fallback, modelsDevData, "anthropic");
    }
    if (modelsDevData?.anthropic?.models) {
      for (const [modelId, model] of Object.entries(modelsDevData.anthropic.models)) {
        if (models[modelId]) continue;
        if (shouldExcludeModel(modelId)) continue;
        const reasoning = model.reasoning ?? false;
        models[modelId] = {
          name: model.name || modelId,
          context: model.limit?.context || 200000,
          output: model.limit?.output || 64000,
          attachment: model.attachment ?? true,
          reasoning,
          modalities: resolveModalities(model.modalities),
          options: inferReasoningOptions(modelId, reasoning),
        };
      }
    }
  }

  if (hasProvider(config, PROVIDER_KEYS.CODEX)) {
    for (const [modelId, fallback] of Object.entries(CODEX_MODELS)) {
      models[modelId] = enrichModelDefinition(modelId, fallback, modelsDevData, "openai");
    }
    if (modelsDevData?.openai?.models) {
      for (const [modelId, model] of Object.entries(modelsDevData.openai.models)) {
        if (models[modelId]) continue;
        if (shouldExcludeModel(modelId)) continue;
        const reasoning = model.reasoning ?? false;
        models[modelId] = {
          name: model.name || modelId,
          context: model.limit?.context || 128000,
          output: model.limit?.output || 16384,
          attachment: model.attachment ?? true,
          reasoning,
          modalities: resolveModalities(model.modalities),
          options: inferReasoningOptions(modelId, reasoning),
        };
      }
    }
  }

  // Add models for active OAuth accounts when no API key is configured
  const activeOAuthTypes = getActiveOAuthProviderTypes(oauthAccounts);

  if (!hasProvider(config, PROVIDER_KEYS.CLAUDE) && activeOAuthTypes.has("claude")) {
    for (const [modelId, fallback] of Object.entries(CLAUDE_MODELS)) {
      if (!models[modelId]) {
        models[modelId] = enrichModelDefinition(modelId, fallback, modelsDevData, "anthropic");
      }
    }
    if (modelsDevData?.anthropic?.models) {
      for (const [modelId, model] of Object.entries(modelsDevData.anthropic.models)) {
        if (models[modelId]) continue;
        if (shouldExcludeModel(modelId)) continue;
        const reasoning = model.reasoning ?? false;
        models[modelId] = {
          name: model.name || modelId,
          context: model.limit?.context || 200000,
          output: model.limit?.output || 64000,
          attachment: model.attachment ?? true,
          reasoning,
          modalities: resolveModalities(model.modalities),
          options: inferReasoningOptions(modelId, reasoning),
        };
      }
    }
  }

  if (!hasProvider(config, PROVIDER_KEYS.GEMINI) && (activeOAuthTypes.has("gemini-cli") || activeOAuthTypes.has("antigravity"))) {
    for (const [modelId, fallback] of Object.entries(GEMINI_MODELS)) {
      if (!models[modelId]) {
        models[modelId] = enrichModelDefinition(modelId, fallback, modelsDevData, "google");
      }
    }
    if (modelsDevData?.google?.models) {
      for (const [modelId, model] of Object.entries(modelsDevData.google.models)) {
        if (models[modelId]) continue;
        if (shouldExcludeModel(modelId)) continue;
        const reasoning = model.reasoning ?? false;
        models[modelId] = {
          name: model.name || modelId,
          context: model.limit?.context || 128000,
          output: model.limit?.output || 16384,
          attachment: model.attachment ?? true,
          reasoning,
          modalities: resolveModalities(model.modalities),
          options: inferReasoningOptions(modelId, reasoning),
        };
      }
    }
  }

  if (!hasProvider(config, PROVIDER_KEYS.CODEX) && activeOAuthTypes.has("codex")) {
    for (const [modelId, fallback] of Object.entries(CODEX_MODELS)) {
      if (!models[modelId]) {
        models[modelId] = enrichModelDefinition(modelId, fallback, modelsDevData, "openai");
      }
    }
    if (modelsDevData?.openai?.models) {
      for (const [modelId, model] of Object.entries(modelsDevData.openai.models)) {
        if (models[modelId]) continue;
        if (shouldExcludeModel(modelId)) continue;
        const reasoning = model.reasoning ?? false;
        models[modelId] = {
          name: model.name || modelId,
          context: model.limit?.context || 128000,
          output: model.limit?.output || 16384,
          attachment: model.attachment ?? true,
          reasoning,
          modalities: resolveModalities(model.modalities),
          options: inferReasoningOptions(modelId, reasoning),
        };
      }
    }
  }

   if (hasProvider(config, PROVIDER_KEYS.OPENAI_COMPAT)) {
     Object.assign(models, extractOpenAICompatModels(config));
   }

   const oauthModels = extractOAuthModelAliases(config, oauthAccounts);
   Object.assign(models, oauthModels);

  return models;
}

export type McpEntry =
  | { name: string; type: "stdio"; command: string; args?: string[] }
  | { name: string; type: "http"; url: string };

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
          baseURL: `${PROXY_URL}/v1`,
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

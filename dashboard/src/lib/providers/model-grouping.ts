export const MODEL_PROVIDER_ORDER = [
  "Claude",
  "Gemini",
  "Antigravity",
  "OpenAI/Codex",
  "OpenAI-Compatible",
  "Other",
] as const;

export type ModelProviderName = (typeof MODEL_PROVIDER_ORDER)[number];

export interface ModelGroup {
  provider: ModelProviderName;
  models: string[];
}

function isModelProviderName(value: string): value is ModelProviderName {
  return (MODEL_PROVIDER_ORDER as readonly string[]).includes(value);
}

export function detectModelProvider(
  modelId: string,
  modelSourceMap?: Map<string, string>
): ModelProviderName {
  const source = modelSourceMap?.get(modelId);
  if (source && isModelProviderName(source)) {
    return source;
  }

  const lower = modelId.toLowerCase();

  if (lower.startsWith("claude-")) return "Claude";
  if (lower.startsWith("gemini-")) return "Gemini";
  if (lower.startsWith("antigravity-")) return "Antigravity";
  if (
    lower.startsWith("gpt-") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("o4") ||
    lower.includes("codex")
  ) {
    return "OpenAI/Codex";
  }
  if (
    lower.startsWith("openrouter/") ||
    lower.startsWith("groq/") ||
    lower.startsWith("xai/") ||
    lower.startsWith("deepseek/") ||
    lower.startsWith("anthropic/") ||
    lower.startsWith("google/")
  ) {
    return "OpenAI-Compatible";
  }

  return "Other";
}

export function groupModelsByProvider(
  models: string[],
  modelSourceMap?: Map<string, string>
): ModelGroup[] {
  const grouped = new Map<ModelProviderName, string[]>();

  for (const model of models) {
    const provider = detectModelProvider(model, modelSourceMap);
    const existing = grouped.get(provider) ?? [];
    existing.push(model);
    grouped.set(provider, existing);
  }

  for (const providerModels of grouped.values()) {
    providerModels.sort((a, b) => a.localeCompare(b));
  }

  return MODEL_PROVIDER_ORDER.map((provider) => ({
    provider,
    models: grouped.get(provider) ?? [],
  })).filter((group) => group.models.length > 0);
}

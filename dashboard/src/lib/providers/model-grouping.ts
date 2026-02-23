/**
 * Maps CLIProxyAPIPlus `owned_by` values to display-friendly provider names.
 * Unknown owned_by values are title-cased automatically.
 */
const OWNED_BY_DISPLAY: Record<string, string> = {
  anthropic: "Claude",
  "github-copilot": "Copilot",
  google: "Gemini",
  antigravity: "Antigravity",
  openai: "OpenAI/Codex",
  moonshot: "Kimi",
  "perplexity-pro": "Perplexity",
  zai: "ZAI",
  kiro: "Kiro",
  iflow: "iFlow",
  qwen: "Qwen",
};

/** Display order for known providers. Unknown providers sort after these. */
export const MODEL_PROVIDER_ORDER = [
  "Claude",
  "Copilot",
  "Gemini",
  "Antigravity",
  "OpenAI/Codex",
  "Kimi",
  "Perplexity",
  "ZAI",
  "Kiro",
  "iFlow",
  "Qwen",
  "OpenAI-Compatible",
  "Other",
] as const;

export type ModelProviderName = (typeof MODEL_PROVIDER_ORDER)[number] | (string & {});

export interface ModelGroup {
  provider: string;
  models: string[];
}

/**
 * Resolve owned_by to a display-friendly provider name.
 * Used by buildSourceMap in page.tsx.
 */
export function resolveOwnedByDisplay(ownedBy: string): string {
  if (OWNED_BY_DISPLAY[ownedBy]) {
    return OWNED_BY_DISPLAY[ownedBy];
  }

  return ownedBy
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Detect which provider group a model belongs to.
 * Prefers modelSourceMap (owned_by-derived) over name-prefix heuristics.
 */
export function detectModelProvider(
  modelId: string,
  modelSourceMap?: Map<string, string>
): string {
  const source = modelSourceMap?.get(modelId);
  if (source) {
    return source;
  }

  // Fallback: name-prefix heuristics for models without source info
  const lower = modelId.toLowerCase();

  if (lower.startsWith("claude-")) return "Claude";
  if (lower.startsWith("gemini-")) return "Gemini";
  if (lower.startsWith("antigravity-")) return "Antigravity";
  if (lower.startsWith("kimi-")) return "Kimi";
  if (lower.startsWith("perplexity-")) return "Perplexity";
  if (lower.startsWith("glm-")) return "ZAI";
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
  const grouped = new Map<string, string[]>();

  for (const model of models) {
    const provider = detectModelProvider(model, modelSourceMap);
    const existing = grouped.get(provider) ?? [];
    existing.push(model);
    grouped.set(provider, existing);
  }

  for (const providerModels of grouped.values()) {
    providerModels.sort((a, b) => a.localeCompare(b));
  }

  // Known providers first (in display order), then unknown providers alphabetically
  const result: ModelGroup[] = [];

  for (const provider of MODEL_PROVIDER_ORDER) {
    const models = grouped.get(provider);
    if (models && models.length > 0) {
      result.push({ provider, models });
      grouped.delete(provider);
    }
  }

  // Remaining (unknown) providers
  const unknownProviders = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  for (const provider of unknownProviders) {
    const models = grouped.get(provider);
    if (models && models.length > 0) {
      result.push({ provider, models });
    }
  }

  return result;
}

/**
 * Default model pricing database.
 *
 * Prices are in USD per 1 million tokens.
 * Users can override these via the Settings page (persisted in localStorage).
 *
 * When a model is not found, we attempt prefix matching:
 *   "claude-sonnet-4.5-xxx" → matches "claude-sonnet-4.5"
 * If still unmatched the request is tagged as "unpriced".
 */

export interface ModelPrice {
  /** Display name for the model family */
  displayName: string;
  /** USD per 1M input tokens */
  inputPer1M: number;
  /** USD per 1M output tokens */
  outputPer1M: number;
  /** Optional: provider grouping */
  provider: string;
}

/**
 * Built-in pricing table.  Keep alphabetically sorted by key.
 * Source: official pricing pages as of April 2026.
 */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPrice> = {
  // ── Anthropic ──────────────────────────────────────────────
  "claude-haiku": {
    displayName: "Claude Haiku",
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    provider: "Anthropic",
  },
  "claude-sonnet-4": {
    displayName: "Claude Sonnet 4",
    inputPer1M: 3,
    outputPer1M: 15,
    provider: "Anthropic",
  },
  "claude-sonnet-4.5": {
    displayName: "Claude Sonnet 4.5",
    inputPer1M: 3,
    outputPer1M: 15,
    provider: "Anthropic",
  },
  "claude-opus-4": {
    displayName: "Claude Opus 4",
    inputPer1M: 15,
    outputPer1M: 75,
    provider: "Anthropic",
  },
  "claude-opus-4.6": {
    displayName: "Claude Opus 4.6",
    inputPer1M: 15,
    outputPer1M: 75,
    provider: "Anthropic",
  },

  // ── OpenAI ─────────────────────────────────────────────────
  "gpt-4o": {
    displayName: "GPT-4o",
    inputPer1M: 2.5,
    outputPer1M: 10,
    provider: "OpenAI",
  },
  "gpt-4o-mini": {
    displayName: "GPT-4o Mini",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    provider: "OpenAI",
  },
  "gpt-5": {
    displayName: "GPT-5",
    inputPer1M: 2.5,
    outputPer1M: 10,
    provider: "OpenAI",
  },
  "gpt-5.2": {
    displayName: "GPT-5.2",
    inputPer1M: 2.5,
    outputPer1M: 10,
    provider: "OpenAI",
  },
  "o3": {
    displayName: "o3",
    inputPer1M: 10,
    outputPer1M: 40,
    provider: "OpenAI",
  },
  "o3-mini": {
    displayName: "o3-mini",
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    provider: "OpenAI",
  },
  "o4-mini": {
    displayName: "o4-mini",
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    provider: "OpenAI",
  },

  // ── Google ─────────────────────────────────────────────────
  "gemini-2.5-pro": {
    displayName: "Gemini 2.5 Pro",
    inputPer1M: 1.25,
    outputPer1M: 10,
    provider: "Google",
  },
  "gemini-2.5-flash": {
    displayName: "Gemini 2.5 Flash",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    provider: "Google",
  },

  // ── Perplexity ─────────────────────────────────────────────
  "sonar": {
    displayName: "Sonar",
    inputPer1M: 1,
    outputPer1M: 1,
    provider: "Perplexity",
  },
  "sonar-pro": {
    displayName: "Sonar Pro",
    inputPer1M: 3,
    outputPer1M: 15,
    provider: "Perplexity",
  },
  "sonar-reasoning": {
    displayName: "Sonar Reasoning",
    inputPer1M: 1,
    outputPer1M: 5,
    provider: "Perplexity",
  },
  "sonar-reasoning-pro": {
    displayName: "Sonar Reasoning Pro",
    inputPer1M: 2,
    outputPer1M: 8,
    provider: "Perplexity",
  },
  "sonar-deep-research": {
    displayName: "Sonar Deep Research",
    inputPer1M: 2,
    outputPer1M: 8,
    provider: "Perplexity",
  },
};

const LOCALSTORAGE_KEY = "cliproxy-custom-pricing";

/**
 * Resolve the price for a given model name.
 *
 * 1. Exact match against user overrides → built-in table
 * 2. Longest-prefix match (e.g. "claude-sonnet-4.5-20260620" → "claude-sonnet-4.5")
 * 3. null if no match found
 */
export function resolveModelPrice(model: string, customPricing?: Record<string, ModelPrice>): ModelPrice | null {
  const lowerModel = model.toLowerCase();
  const merged = { ...DEFAULT_MODEL_PRICING, ...customPricing };

  // Exact match
  if (merged[lowerModel]) return merged[lowerModel];

  // Prefix match: try progressively shorter prefixes
  const keys = Object.keys(merged).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lowerModel.startsWith(key)) return merged[key];
  }

  // Try matching without provider prefix (e.g. "cliproxyapi/sonar-pro" → "sonar-pro")
  const withoutPrefix = lowerModel.includes("/") ? lowerModel.split("/").pop()! : null;
  if (withoutPrefix) {
    if (merged[withoutPrefix]) return merged[withoutPrefix];
    for (const key of keys) {
      if (withoutPrefix.startsWith(key)) return merged[key];
    }
  }

  return null;
}

/**
 * Calculate estimated cost for a set of tokens.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  price: ModelPrice
): number {
  return (inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M;
}

/**
 * Load user-customized pricing from localStorage.
 */
export function loadCustomPricing(): Record<string, ModelPrice> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save user-customized pricing to localStorage.
 */
export function saveCustomPricing(pricing: Record<string, ModelPrice>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(pricing));
}

/**
 * Format a USD amount for display.
 */
export function formatUSD(amount: number): string {
  if (amount >= 100) return `$${amount.toFixed(0)}`;
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(4)}`;
}

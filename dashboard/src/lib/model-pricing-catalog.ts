import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { DEFAULT_MODEL_PRICING, type ModelPrice } from "@/lib/model-pricing";

const MODELS_DEV_URL = "https://models.dev/api.json";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const SYSTEM_SETTING_KEY = "live_model_pricing_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const COLD_START_WAIT_MS = 120;

let cachedCatalog: Record<string, ModelPrice> | null = null;
let cachedAt = 0;
let inflightRefresh: Promise<Record<string, ModelPrice>> | null = null;

interface ModelsDevResponse {
  [providerKey: string]: {
    name?: string;
    models?: Record<string, {
      name?: string;
      cost?: {
        input?: number;
        output?: number;
        cache_read?: number;
      };
    }>;
  };
}

interface OpenRouterModelsResponse {
  data?: Array<{
    id?: string;
    name?: string;
    pricing?: {
      prompt?: string;
      completion?: string;
      input_cache_read?: string;
    };
  }>;
}

function isValidNonNegativeRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function inferCacheAccounting(provider: string, modelId: string): "included" | "separate" {
  const p = provider.toLowerCase();
  const id = modelId.toLowerCase();
  if (p.includes("anthropic") || id.startsWith("claude")) {
    return "separate";
  }
  return "included";
}

function normalizeProviderLabel(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === "openai") return "OpenAI";
  if (lower === "anthropic") return "Anthropic";
  if (lower === "google" || lower === "google-vertex" || lower === "gemini") return "Google";
  if (lower === "xai" || lower === "x-ai") return "xAI";
  if (lower === "deepseek") return "DeepSeek";
  if (lower === "zhipuai" || lower === "z-ai" || lower === "zai") return "Zhipu AI";
  if (lower === "moonshotai" || lower === "moonshot") return "Moonshot AI";
  if (lower === "qwen" || lower === "alibaba") return "Alibaba";
  if (lower === "minimax") return "MiniMax";
  if (lower === "xiaomi" || lower === "mimo") return "Xiaomi";
  if (lower === "perplexity") return "Perplexity";
  return raw.trim() || "Unknown";
}

function mergeWithBuiltInDefaults(liveCatalog: Record<string, ModelPrice>): Record<string, ModelPrice> {
  // Built-in table always takes precedence over scraped catalogs so curated
  // long-context / peak tiers and exact cache accounting are preserved.
  const merged: Record<string, ModelPrice> = { ...liveCatalog };
  for (const [key, price] of Object.entries(DEFAULT_MODEL_PRICING)) {
    merged[key.toLowerCase()] = price;
  }
  return merged;
}

async function fetchModelsDevCatalog(): Promise<Record<string, ModelPrice>> {
  const result: Record<string, ModelPrice> = {};
  const res = await fetch(MODELS_DEV_URL, {
    headers: { "User-Agent": "CLIProxyAPI-Dashboard/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`models.dev returned ${res.status}`);
  }
  const data = (await res.json()) as ModelsDevResponse;

  for (const [providerKey, providerObj] of Object.entries(data)) {
    if (!providerObj || typeof providerObj !== "object" || !providerObj.models) continue;
    const provider = normalizeProviderLabel(providerObj.name ?? providerKey);
    for (const [modelId, modelInfo] of Object.entries(providerObj.models)) {
      const cost = modelInfo?.cost;
      if (!cost || !isValidNonNegativeRate(cost.input) || !isValidNonNegativeRate(cost.output)) continue;
      // Never treat $0 / free entries as authoritative API prices.
      if (cost.input === 0 && cost.output === 0) continue;

      const key = modelId.toLowerCase();
      if (!result[key]) {
        result[key] = {
          displayName: modelInfo.name?.trim() || modelId,
          inputPer1M: cost.input,
          outputPer1M: cost.output,
          ...(isValidNonNegativeRate(cost.cache_read) ? { cacheReadPer1M: cost.cache_read } : {}),
          cacheAccounting: inferCacheAccounting(provider, key),
          provider,
        };
      }
    }
  }
  return result;
}

async function fetchOpenRouterCatalog(): Promise<Record<string, ModelPrice>> {
  const result: Record<string, ModelPrice> = {};
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { "User-Agent": "CLIProxyAPI-Dashboard/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`openrouter returned ${res.status}`);
  }
  const json = (await res.json()) as OpenRouterModelsResponse;

  for (const item of json.data ?? []) {
    if (!item.id || !item.pricing) continue;
    const promptPerToken = Number(item.pricing.prompt);
    const completionPerToken = Number(item.pricing.completion);
    if (!Number.isFinite(promptPerToken) || !Number.isFinite(completionPerToken)) continue;
    if (promptPerToken < 0 || completionPerToken < 0) continue;
    // Never treat $0 / free entries as authoritative API prices.
    if (promptPerToken === 0 && completionPerToken === 0) continue;

    const inputPer1M = Number((promptPerToken * 1_000_000).toFixed(6));
    const outputPer1M = Number((completionPerToken * 1_000_000).toFixed(6));
    const cacheReadRaw =
      item.pricing.input_cache_read !== undefined ? Number(item.pricing.input_cache_read) : Number.NaN;
    const cacheReadPer1M =
      Number.isFinite(cacheReadRaw) && cacheReadRaw >= 0
        ? Number((cacheReadRaw * 1_000_000).toFixed(6))
        : undefined;

    const fullId = item.id.toLowerCase();
    const slashIdx = fullId.indexOf("/");
    const rawProvider = slashIdx > 0 ? fullId.slice(0, slashIdx) : "Unknown";
    const provider = normalizeProviderLabel(rawProvider);
    const bareId = slashIdx > 0 ? fullId.slice(slashIdx + 1) : fullId;
    const entry: ModelPrice = {
      displayName: item.name?.trim() || item.id,
      inputPer1M,
      outputPer1M,
      ...(cacheReadPer1M !== undefined ? { cacheReadPer1M } : {}),
      cacheAccounting: inferCacheAccounting(provider, bareId),
      provider,
    };

    result[fullId] = entry;
    if (!result[bareId]) {
      result[bareId] = entry;
    }
  }
  return result;
}

function isValidModelPrice(value: unknown): value is ModelPrice {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.displayName === "string" &&
    isValidNonNegativeRate(candidate.inputPer1M) &&
    isValidNonNegativeRate(candidate.outputPer1M) &&
    typeof candidate.provider === "string"
  );
}

async function readPersistedCatalog(): Promise<Record<string, ModelPrice> | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SYSTEM_SETTING_KEY },
    });
    if (!setting?.value) return null;

    const parsed = JSON.parse(setting.value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const validated: Record<string, ModelPrice> = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidModelPrice(entry)) {
        validated[key.toLowerCase()] = entry;
      }
    }
    if (Object.keys(validated).length === 0) return null;
    return mergeWithBuiltInDefaults(validated);
  } catch (err) {
    logger.debug({ err }, "Failed to read persisted live model pricing cache");
    return null;
  }
}

async function writePersistedCatalog(liveCatalog: Record<string, ModelPrice>): Promise<void> {
  if (Object.keys(liveCatalog).length === 0) return;
  try {
    await prisma.systemSetting.upsert({
      where: { key: SYSTEM_SETTING_KEY },
      update: { value: JSON.stringify(liveCatalog) },
      create: { key: SYSTEM_SETTING_KEY, value: JSON.stringify(liveCatalog) },
    });
  } catch (err) {
    logger.debug({ err }, "Failed to persist live model pricing cache");
  }
}

async function refreshPricingCatalog(): Promise<Record<string, ModelPrice>> {
  const [modelsDevResult, openRouterResult] = await Promise.allSettled([
    fetchModelsDevCatalog(),
    fetchOpenRouterCatalog(),
  ]);

  const liveCatalog: Record<string, ModelPrice> = {};
  if (modelsDevResult.status === "fulfilled") {
    Object.assign(liveCatalog, modelsDevResult.value);
  } else {
    logger.warn({ err: modelsDevResult.reason }, "Failed to fetch models.dev pricing catalog");
  }

  if (openRouterResult.status === "fulfilled") {
    Object.assign(liveCatalog, openRouterResult.value);
  } else {
    logger.warn({ err: openRouterResult.reason }, "Failed to fetch OpenRouter pricing catalog");
  }

  if (Object.keys(liveCatalog).length > 0) {
    const merged = mergeWithBuiltInDefaults(liveCatalog);
    cachedCatalog = merged;
    cachedAt = Date.now();
    await writePersistedCatalog(liveCatalog);
    return merged;
  }

  // Both upstream sources failed or returned empty: fall back to last persisted
  // catalog in SystemSetting before falling back to built-in defaults.
  const persisted = await readPersistedCatalog();
  if (persisted) {
    cachedCatalog = persisted;
    cachedAt = Date.now();
    return persisted;
  }

  const defaults = mergeWithBuiltInDefaults({});
  cachedCatalog = defaults;
  cachedAt = Date.now();
  return defaults;
}

/**
 * Returns the merged pricing table (live upstream catalogs + built-in overrides),
 * using an in-memory TTL cache with DB `SystemSetting` fallback on cold start or
 * upstream failure. Never claims a model is free ($0) when its API price is unknown.
 */
export async function getMergedModelPricing(): Promise<Record<string, ModelPrice>> {
  const now = Date.now();
  if (cachedCatalog && now - cachedAt < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  if (!inflightRefresh) {
    inflightRefresh = refreshPricingCatalog().finally(() => {
      inflightRefresh = null;
    });
  }

  if (cachedCatalog) {
    return cachedCatalog;
  }

  // Avoid blocking cold requests on external pricing endpoints: return DB cache or
  // built-in pricing if upstream catalogs take more than 120ms, while warming in background.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fallback = new Promise<Record<string, ModelPrice>>((resolve) => {
    timer = setTimeout(() => {
      void readPersistedCatalog().then((persisted) => {
        resolve(persisted ?? DEFAULT_MODEL_PRICING);
      });
    }, COLD_START_WAIT_MS);
  });

  try {
    return await Promise.race([inflightRefresh, fallback]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

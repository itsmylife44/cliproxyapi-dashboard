export const QUOTA_PROVIDERS = ["all", "antigravity", "claude", "codex", "gemini-cli", "github-copilot", "kimi"] as const;

export const QUOTA_STATUSES = ["all", "active", "warning", "error", "disabled"] as const;

export type QuotaQueryProvider = (typeof QUOTA_PROVIDERS)[number];
export type QuotaQueryStatus = (typeof QUOTA_STATUSES)[number];

export interface QuotaQueryState {
  q: string;
  provider: QuotaQueryProvider;
  status: QuotaQueryStatus;
  page: number;
}

interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}

export const DEFAULT_QUOTA_QUERY_STATE: QuotaQueryState = {
  q: "",
  provider: "all",
  status: "all",
  page: 1,
};

function normalizeQuery(value: string | null | undefined) {
  return value?.trim() ?? DEFAULT_QUOTA_QUERY_STATE.q;
}

const QUOTA_PROVIDER_ALIASES: Record<string, QuotaQueryProvider> = {
  // GitHub Copilot
  github: "github-copilot",
  "github-copilot": "github-copilot",
  copilot: "github-copilot",
  // Gemini (CLIProxyAPI reports both forms)
  gemini: "gemini-cli",
  "gemini-cli": "gemini-cli",
  // Identity aliases so canonicalization is idempotent for API-reported raws
  claude: "claude",
  anthropic: "claude",
  codex: "codex",
  openai: "codex",
  antigravity: "antigravity",
  kimi: "kimi",
};

/**
 * Canonicalizes a raw provider string (as reported on a QuotaAccount) to a
 * QuotaQueryProvider if it matches a known filter option. Returns null when
 * the raw value has no mapping — callers can decide whether to treat it as
 * "other" (shown only under the "all" filter).
 */
export function canonicalizeQuotaProvider(raw: string | null | undefined): QuotaQueryProvider | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (QUOTA_PROVIDERS.includes(normalized as QuotaQueryProvider) && normalized !== "all") {
    return normalized as QuotaQueryProvider;
  }
  return QUOTA_PROVIDER_ALIASES[normalized] ?? null;
}

function normalizeProvider(value: string | null | undefined): QuotaQueryProvider {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return DEFAULT_QUOTA_QUERY_STATE.provider;
  if (QUOTA_PROVIDERS.includes(normalized as QuotaQueryProvider)) {
    return normalized as QuotaQueryProvider;
  }
  return QUOTA_PROVIDER_ALIASES[normalized] ?? DEFAULT_QUOTA_QUERY_STATE.provider;
}

function normalizeStatus(value: string | null | undefined): QuotaQueryStatus {
  const normalized = value?.trim().toLowerCase();
  return QUOTA_STATUSES.includes(normalized as QuotaQueryStatus)
    ? (normalized as QuotaQueryStatus)
    : DEFAULT_QUOTA_QUERY_STATE.status;
}

function normalizePage(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_QUOTA_QUERY_STATE.page;
  }

  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) {
    return DEFAULT_QUOTA_QUERY_STATE.page;
  }

  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : DEFAULT_QUOTA_QUERY_STATE.page;
}

export function normalizeQuotaQueryState(query: {
  q?: string | null;
  provider?: string | null;
  status?: string | null;
  page?: string | number | null;
}): QuotaQueryState {
  return {
    q: normalizeQuery(query.q),
    provider: normalizeProvider(query.provider),
    status: normalizeStatus(query.status),
    page: normalizePage(query.page),
  };
}

export function parseQuotaQueryState(searchParams: URLSearchParams | ReadonlyURLSearchParamsLike): QuotaQueryState {
  return normalizeQuotaQueryState({
    q: searchParams.get("q"),
    provider: searchParams.get("provider"),
    status: searchParams.get("status"),
    page: searchParams.get("page"),
  });
}

export function buildQuotaSearch(query: QuotaQueryState) {
  const normalized = normalizeQuotaQueryState(query);
  const params = new URLSearchParams();

  if (normalized.q) params.set("q", normalized.q);
  if (normalized.provider !== DEFAULT_QUOTA_QUERY_STATE.provider) params.set("provider", normalized.provider);
  if (normalized.status !== DEFAULT_QUOTA_QUERY_STATE.status) params.set("status", normalized.status);
  if (normalized.page !== DEFAULT_QUOTA_QUERY_STATE.page) params.set("page", String(normalized.page));

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function buildQuotaToolbarQuery(
  query: QuotaQueryState,
  updates: Partial<Pick<QuotaQueryState, "q" | "provider" | "status">>
): QuotaQueryState {
  return {
    ...query,
    ...updates,
    page: 1,
  };
}

export function clearQuotaToolbarQuery(): QuotaQueryState {
  return { ...DEFAULT_QUOTA_QUERY_STATE };
}

export const PROVIDER = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CODEX: "codex",
  XAI: "xai",
  VERTEX: "vertex",
  INTERACTIONS: "interactions",
  META: "meta",
  OPENAI_COMPAT: "openai-compatibility",
} as const;

export type Provider = (typeof PROVIDER)[keyof typeof PROVIDER];

export const PROVIDER_ENDPOINT = {
  [PROVIDER.CLAUDE]: "/claude-api-key",
  [PROVIDER.GEMINI]: "/gemini-api-key",
  [PROVIDER.CODEX]: "/codex-api-key",
  [PROVIDER.XAI]: "/xai-api-key",
  [PROVIDER.VERTEX]: "/vertex-api-key",
  [PROVIDER.INTERACTIONS]: "/interactions-api-key",
  [PROVIDER.META]: "/meta-api-key",
  [PROVIDER.OPENAI_COMPAT]: "/openai-compatibility",
} as const;

/** config.yaml lists that make a provider count as configured. */
export const PROVIDER_CONFIG_KEYS = Object.values(PROVIDER_ENDPOINT).map((endpoint) => endpoint.slice(1));

export const OAUTH_PROVIDER = {
  CLAUDE: "claude",
  GEMINI_CLI: "gemini-cli",
  CODEX: "codex",
  ANTIGRAVITY: "antigravity",
  IFLOW: "iflow",
  KIMI: "kimi",
  KIMI_AI: "kimi-ai",
  COPILOT: "copilot",
  KIRO: "kiro",
  CURSOR: "cursor",
  KILO: "kilo",
  GITLAB: "gitlab",
  QWEN: "qwen",
  XAI: "xai",
  DEVIN: "devin",
  META: "meta",
} as const;

export type OAuthProvider = (typeof OAUTH_PROVIDER)[keyof typeof OAUTH_PROVIDER];

/**
 * Maps the raw provider/type strings the CLIProxyAPI management service exposes
 * on auth files to our canonical OAuth provider identifiers.
 *
 * Ownership records are written with canonical identifiers (e.g. `copilot`),
 * so every lookup that derives a provider from a management-service auth file
 * MUST pass the raw value through this function before querying or keying
 * ownership rows.
 */
const OAUTH_PROVIDER_ALIASES: Record<string, OAuthProvider> = {
  claude: OAUTH_PROVIDER.CLAUDE,
  anthropic: OAUTH_PROVIDER.CLAUDE,
  "gemini-cli": OAUTH_PROVIDER.GEMINI_CLI,
  gemini: OAUTH_PROVIDER.GEMINI_CLI,
  codex: OAUTH_PROVIDER.CODEX,
  openai: OAUTH_PROVIDER.CODEX,
  antigravity: OAUTH_PROVIDER.ANTIGRAVITY,
  iflow: OAUTH_PROVIDER.IFLOW,
  kimi: OAUTH_PROVIDER.KIMI,
  "kimi-ai": OAUTH_PROVIDER.KIMI_AI,
  copilot: OAUTH_PROVIDER.COPILOT,
  "github-copilot": OAUTH_PROVIDER.COPILOT,
  github: OAUTH_PROVIDER.COPILOT,
  kiro: OAUTH_PROVIDER.KIRO,
  cursor: OAUTH_PROVIDER.CURSOR,
  kilo: OAUTH_PROVIDER.KILO,
  gitlab: OAUTH_PROVIDER.GITLAB,
  qwen: OAUTH_PROVIDER.QWEN,
  xai: OAUTH_PROVIDER.XAI,
  devin: OAUTH_PROVIDER.DEVIN,
  meta: OAUTH_PROVIDER.META,
};

export function canonicalizeOAuthProvider(raw: string | null | undefined): OAuthProvider | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return OAUTH_PROVIDER_ALIASES[normalized] ?? null;
}

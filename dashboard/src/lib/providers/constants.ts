export const PROVIDER = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CODEX: "codex",
  OPENAI_COMPAT: "openai-compatibility",
} as const;

export type Provider = (typeof PROVIDER)[keyof typeof PROVIDER];

export const PROVIDER_ENDPOINT = {
  [PROVIDER.CLAUDE]: "/claude-api-key",
  [PROVIDER.GEMINI]: "/gemini-api-key",
  [PROVIDER.CODEX]: "/codex-api-key",
  [PROVIDER.OPENAI_COMPAT]: "/openai-compatibility",
} as const;

export const OAUTH_PROVIDER = {
  CLAUDE: "claude",
  GEMINI_CLI: "gemini-cli",
  CODEX: "codex",
  ANTIGRAVITY: "antigravity",
  IFLOW: "iflow",
  KIMI: "kimi",
  QWEN: "qwen",
} as const;

export type OAuthProvider = (typeof OAUTH_PROVIDER)[keyof typeof OAUTH_PROVIDER];

export interface QuotaModel {
  id: string;
  displayName: string;
  remainingFraction?: number | null;
  resetTime: string | null;
}

export interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction?: number | null;
  resetTime: string | null;
  models: QuotaModel[];
}

export interface QuotaAccount {
  auth_index: string;
  provider: string;
  email?: string | null;
  supported: boolean;
  error?: string;
  groups?: QuotaGroup[];
  raw?: unknown;
}

export interface QuotaResponse {
  accounts: QuotaAccount[];
}

export const PROVIDERS = {
  ALL: "all",
  ANTIGRAVITY: "antigravity",
  CLAUDE: "claude",
  CODEX: "codex",
  COPILOT: "github-copilot",
  KIMI: "kimi",
} as const;

export type ProviderType = (typeof PROVIDERS)[keyof typeof PROVIDERS];

export interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  resetTime: string | null;
  isShortTerm: boolean;
}

export interface ProviderSummary {
  provider: string;
  totalAccounts: number;
  healthyAccounts: number;
  errorAccounts: number;
  windowCapacities: WindowCapacity[];
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  threshold: number;
  enabled: boolean;
  providers: string[];
  checkInterval: number;
  cooldown: number;
}

export interface CheckAlertResult {
  checked?: boolean;
  skipped?: boolean;
  reason?: string;
  alertsSent?: number;
  breachedCount?: number;
  accounts?: Array<{
    provider: string;
    account: string;
    window: string;
    capacity: number;
    belowThreshold: boolean;
  }>;
}

export const ALERT_PROVIDERS = [
  { key: "claude", label: "Claude" },
  { key: "antigravity", label: "Antigravity" },
  { key: "codex", label: "Codex" },
  { key: "github-copilot", label: "Copilot" },
  { key: "kimi", label: "Kimi" },
] as const;

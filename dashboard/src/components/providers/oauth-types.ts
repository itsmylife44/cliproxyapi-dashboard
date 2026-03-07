import { useToast } from "@/components/ui/toast";
import type { CurrentUserLike } from "@/components/providers/api-key-section";

export type ShowToast = ReturnType<typeof useToast>["showToast"];

export interface OAuthSectionProps {
  showToast: ShowToast;
  currentUser: CurrentUserLike | null;
  refreshProviders: () => Promise<void>;
  onAccountCountChange: (count: number) => void;
}

export const OAUTH_PROVIDERS = [
  {
    id: "claude" as const,
    name: "Claude Code",
    description: "Anthropic Claude (Pro/Max subscription)",
    authEndpoint: "/api/management/anthropic-auth-url?is_webui=true",
    requiresCallback: true,
  },
  {
    id: "gemini-cli" as const,
    name: "Gemini CLI",
    description: "Google Gemini (via Google OAuth)",
    authEndpoint: "/api/management/gemini-cli-auth-url?project_id=ALL&is_webui=true",
    requiresCallback: true,
  },
  {
    id: "codex" as const,
    name: "Codex",
    description: "OpenAI Codex (Plus/Pro subscription)",
    authEndpoint: "/api/management/codex-auth-url?is_webui=true",
    requiresCallback: true,
  },
  {
    id: "antigravity" as const,
    name: "Antigravity",
    description: "Google Antigravity (via Google OAuth)",
    authEndpoint: "/api/management/antigravity-auth-url?is_webui=true",
    requiresCallback: true,
  },
  {
    id: "iflow" as const,
    name: "iFlow",
    description: "iFlytek iFlow (via OAuth)",
    authEndpoint: "/api/management/iflow-auth-url?is_webui=true",
    requiresCallback: true,
  },
  {
    id: "kimi" as const,
    name: "Kimi",
    description: "Moonshot AI Kimi (device OAuth)",
    authEndpoint: "/api/management/kimi-auth-url?is_webui=true",
    requiresCallback: false,
  },
  {
    id: "qwen" as const,
    name: "Qwen Code",
    description: "Alibaba Qwen Code (device OAuth)",
    authEndpoint: "/api/management/qwen-auth-url?is_webui=true",
    requiresCallback: false,
  },
  {
    id: "copilot" as const,
    name: "GitHub Copilot",
    description: "GitHub Copilot (via GitHub device OAuth)",
    authEndpoint: "/api/management/github-auth-url?is_webui=true",
    requiresCallback: false,
  },
  {
    id: "kiro" as const,
    name: "Kiro",
    description: "AWS CodeWhisperer / Kiro (device OAuth)",
    authEndpoint: "/api/management/kiro-auth-url?is_webui=true",
    requiresCallback: false,
  },
] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type OAuthProviderId = OAuthProvider["id"];

export const OAUTH_STATUS_POLL_INTERVAL_MS = 5000;
export const OAUTH_STATUS_POLL_INTERVAL_HIDDEN_MS = 10000;
export const MAX_POLL_ATTEMPTS = 60;
export const MAX_NO_CALLBACK_ATTEMPTS = 25;
export const NO_CALLBACK_RETRY_DELAY_MS = 3000;
export const MAX_IMPORT_FILE_SIZE = 1024 * 1024;
export const STATUS_MESSAGE_MAX_LENGTH = 40;

export const MODAL_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  WAITING: "waiting",
  SUBMITTING: "submitting",
  POLLING: "polling",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type ModalStatus = (typeof MODAL_STATUS)[keyof typeof MODAL_STATUS];

export const CALLBACK_VALIDATION = {
  EMPTY: "empty",
  INVALID: "invalid",
  VALID: "valid",
} as const;

export type CallbackValidation = (typeof CALLBACK_VALIDATION)[keyof typeof CALLBACK_VALIDATION];

export interface OAuthAccountWithOwnership {
  id: string;
  accountName: string;
  accountEmail: string | null;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
  status: "active" | "error" | "disabled" | string;
  statusMessage: string | null;
  unavailable: boolean;
}

export interface AuthUrlResponse {
  status?: string;
  url?: string;
  state?: string;
  user_code?: string;
  method?: string;
  verification_uri?: string;
}

export interface AuthStatusResponse {
  status?: string;
  error?: string;
  verification_url?: string;
  user_code?: string;
  url?: string;
}

export interface OAuthCallbackResponse {
  status?: number;
  error?: string;
}

export const getOAuthProviderById = (id: OAuthProviderId | null) =>
  OAUTH_PROVIDERS.find((provider) => provider.id === id) || null;

export function isTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

export const validateCallbackUrl = (value: string) => {
  if (!value.trim()) {
    return { status: CALLBACK_VALIDATION.EMPTY, message: "Paste the full URL." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return { status: CALLBACK_VALIDATION.INVALID, message: "That doesn't look like a valid URL." };
  }

  const code = parsedUrl.searchParams.get("code");
  const state = parsedUrl.searchParams.get("state");

  if (!code || !state) {
    return { status: CALLBACK_VALIDATION.INVALID, message: "URL must include both code and state parameters." };
  }

  return { status: CALLBACK_VALIDATION.VALID, message: "Callback URL looks good. Ready to submit." };
};

export function parseStatusMessage(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return parsed.error.message;
    if (typeof parsed?.message === "string") return parsed.message;
    return raw;
  } catch {
    return raw;
  }
}

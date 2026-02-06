"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

// ── API Key Providers ──────────────────────────────────────────────────────────

const PROVIDER_IDS = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CODEX: "codex",
  OPENAI: "openai-compatibility",
} as const;

type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

const PROVIDERS = [
  {
    id: PROVIDER_IDS.CLAUDE,
    name: "Claude (Anthropic)",
    description: "Official Anthropic API",
    endpoint: "/api/management/claude-api-key",
    responseKey: "claude-api-key",
    icon: "🤖",
    defaultBaseUrl: "",
  },
  {
    id: PROVIDER_IDS.GEMINI,
    name: "Gemini (Google)",
    description: "Google Gemini API",
    endpoint: "/api/management/gemini-api-key",
    responseKey: "gemini-api-key",
    icon: "✨",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
  },
  {
    id: PROVIDER_IDS.CODEX,
    name: "OpenAI / Codex",
    description: "OpenAI API including GPT models",
    endpoint: "/api/management/codex-api-key",
    responseKey: "codex-api-key",
    icon: "🔮",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    id: PROVIDER_IDS.OPENAI,
    name: "OpenAI Compatible",
    description: "Custom providers like OpenRouter",
    endpoint: "/api/management/openai-compatibility",
    responseKey: "openai-compatibility",
    icon: "🔌",
    defaultBaseUrl: "",
  },
] as const;

type ProviderConfig = (typeof PROVIDERS)[number];

interface ApiKeyEntry {
  "api-key": string;
  prefix?: string;
  "base-url"?: string;
  "proxy-url"?: string;
  headers?: Record<string, string>;
  "excluded-models"?: string[];
}

interface OpenAIKeyEntry {
  "api-key": string;
}

interface OpenAIProviderEntry {
  name: string;
  prefix?: string;
  "base-url"?: string;
  "api-key-entries": OpenAIKeyEntry[];
  models?: string[];
  headers?: Record<string, string>;
}

interface OpenAIProviderState {
  name: string;
  prefix?: string;
  baseUrl?: string;
  apiKeys: string[];
}

interface ProviderState {
  keys: string[];
  openAIProviders: OpenAIProviderState[];
}

// ── OAuth Providers ────────────────────────────────────────────────────────────

const OAUTH_PROVIDERS = [
  {
    id: "claude" as const,
    name: "Claude Code",
    description: "Anthropic Claude (Pro/Max subscription)",
    authEndpoint: "/api/management/anthropic-auth-url?is_webui=true",
  },
  {
    id: "gemini-cli" as const,
    name: "Gemini CLI",
    description: "Google Gemini (via Google OAuth)",
    authEndpoint: "/api/management/gemini-cli-auth-url?project_id=ALL&is_webui=true",
  },
  {
    id: "codex" as const,
    name: "Codex",
    description: "OpenAI Codex (Plus/Pro subscription)",
    authEndpoint: "/api/management/codex-auth-url?is_webui=true",
  },
  {
    id: "antigravity" as const,
    name: "Antigravity",
    description: "Google Antigravity (via Google OAuth)",
    authEndpoint: "/api/management/antigravity-auth-url?is_webui=true",
  },
] as const;

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
type OAuthProviderId = OAuthProvider["id"];

const MODAL_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  WAITING: "waiting",
  SUBMITTING: "submitting",
  POLLING: "polling",
  SUCCESS: "success",
  ERROR: "error",
} as const;

type ModalStatus = (typeof MODAL_STATUS)[keyof typeof MODAL_STATUS];

const CALLBACK_VALIDATION = {
  EMPTY: "empty",
  INVALID: "invalid",
  VALID: "valid",
} as const;

type CallbackValidation =
  (typeof CALLBACK_VALIDATION)[keyof typeof CALLBACK_VALIDATION];

interface AuthFileEntry {
  id: string;
  name: string;
  type?: string;
  provider?: string;
  label?: string;
  status?: string;
  disabled?: boolean;
  email?: string;
}

interface AuthFilesResponse {
  files?: AuthFileEntry[];
}

interface AuthUrlResponse {
  status?: string;
  url?: string;
  state?: string;
}

interface AuthStatusResponse {
  status?: string;
  error?: string;
}

interface OAuthCallbackResponse {
  status?: number;
  error?: string;
}

// ── Utility Functions ──────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const maskKey = (value: string) => {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const getOAuthProviderById = (id: OAuthProviderId | null) =>
  OAUTH_PROVIDERS.find((provider) => provider.id === id) || null;

const validateCallbackUrl = (value: string) => {
  if (!value.trim()) {
    return { status: CALLBACK_VALIDATION.EMPTY, message: "Paste the full URL." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return {
      status: CALLBACK_VALIDATION.INVALID,
      message: "That doesn't look like a valid URL.",
    };
  }

  const code = parsedUrl.searchParams.get("code");
  const state = parsedUrl.searchParams.get("state");

  if (!code || !state) {
    return {
      status: CALLBACK_VALIDATION.INVALID,
      message: "URL must include both code and state parameters.",
    };
  }

  return {
    status: CALLBACK_VALIDATION.VALID,
    message: "Callback URL looks good. Ready to submit.",
  };
};

const extractApiKeys = (data: unknown, responseKey: string) => {
  if (!isRecord(data)) return [];
  const value = data[responseKey];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const apiKeyValue = entry["api-key"];
      if (typeof apiKeyValue !== "string") return null;
      return apiKeyValue;
    })
    .filter((entry): entry is string => typeof entry === "string");
};

const isOpenAIProviderState = (
  entry: OpenAIProviderState | null
): entry is OpenAIProviderState => entry !== null;

const extractOpenAIProviders = (data: unknown): OpenAIProviderState[] => {
  if (!isRecord(data)) return [];
  const value = data["openai-compatibility"];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): OpenAIProviderState | null => {
      if (!isRecord(entry)) return null;
      const name = entry.name;
      const apiKeyEntries = entry["api-key-entries"];
      if (typeof name !== "string" || !Array.isArray(apiKeyEntries)) return null;
      const keys = apiKeyEntries
        .map((keyEntry) => {
          if (!isRecord(keyEntry)) return null;
          const apiKeyValue = keyEntry["api-key"];
          return typeof apiKeyValue === "string" ? apiKeyValue : null;
        })
        .filter((key): key is string => typeof key === "string");
      const provider: OpenAIProviderState = {
        name,
        apiKeys: keys,
      };
      if (typeof entry.prefix === "string") {
        provider.prefix = entry.prefix;
      }
      if (typeof entry["base-url"] === "string") {
        provider.baseUrl = entry["base-url"];
      }
      return provider;
    })
    .filter(isOpenAIProviderState);
};

const extractOpenAIEntriesForPut = (data: unknown): OpenAIProviderEntry[] => {
  if (!isRecord(data)) return [];
  const value = data["openai-compatibility"];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const name = entry.name;
      const apiKeyEntries = entry["api-key-entries"];
      if (typeof name !== "string" || !Array.isArray(apiKeyEntries)) return null;
      const keys = apiKeyEntries
        .map((keyEntry) => {
          if (!isRecord(keyEntry)) return null;
          const apiKeyValue = keyEntry["api-key"];
          return typeof apiKeyValue === "string" ? { "api-key": apiKeyValue } : null;
        })
        .filter((key): key is OpenAIKeyEntry => key !== null);
      const providerEntry: OpenAIProviderEntry = {
        name,
        "api-key-entries": keys,
      };
      if (typeof entry.prefix === "string") {
        providerEntry.prefix = entry.prefix;
      }
      if (typeof entry["base-url"] === "string") {
        providerEntry["base-url"] = entry["base-url"];
      }
      if (Array.isArray(entry.models)) {
        providerEntry.models = entry.models.filter((model) => typeof model === "string");
      }
      if (isRecord(entry.headers)) {
        const headers: Record<string, string> = {};
        Object.entries(entry.headers).forEach(([key, value]) => {
          if (typeof value === "string") {
            headers[key] = value;
          }
        });
        providerEntry.headers = headers;
      }
      return providerEntry;
    })
    .filter((entry): entry is OpenAIProviderEntry => entry !== null);
};

const loadProvidersData = async (): Promise<Record<ProviderId, ProviderState>> => {
  const newConfigs: Record<ProviderId, ProviderState> = {
    [PROVIDER_IDS.CLAUDE]: { keys: [], openAIProviders: [] },
    [PROVIDER_IDS.GEMINI]: { keys: [], openAIProviders: [] },
    [PROVIDER_IDS.CODEX]: { keys: [], openAIProviders: [] },
    [PROVIDER_IDS.OPENAI]: { keys: [], openAIProviders: [] },
  };

  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(provider.endpoint);
      if (res.ok) {
        const data = await res.json();
        if (provider.id === PROVIDER_IDS.OPENAI) {
          const openAIProviders = extractOpenAIProviders(data);
          const keys = openAIProviders.flatMap((entry) => entry.apiKeys);
          newConfigs[provider.id] = { keys, openAIProviders };
        } else {
          const keys = extractApiKeys(data, provider.responseKey);
          newConfigs[provider.id] = { keys, openAIProviders: [] };
        }
      } else {
        newConfigs[provider.id] = { keys: [], openAIProviders: [] };
      }
    } catch {
      newConfigs[provider.id] = { keys: [], openAIProviders: [] };
    }
  }

  return newConfigs;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const [configs, setConfigs] = useState<Record<ProviderId, ProviderState>>(() => {
    const initialState: Record<ProviderId, ProviderState> = {
      [PROVIDER_IDS.CLAUDE]: { keys: [], openAIProviders: [] },
      [PROVIDER_IDS.GEMINI]: { keys: [], openAIProviders: [] },
      [PROVIDER_IDS.CODEX]: { keys: [], openAIProviders: [] },
      [PROVIDER_IDS.OPENAI]: { keys: [], openAIProviders: [] },
    };
    return initialState;
  });
  const [modalProvider, setModalProvider] = useState<ProviderId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [prefix, setPrefix] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [providerName, setProviderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<AuthFileEntry[]>([]);
  const [oauthAccountsLoading, setOauthAccountsLoading] = useState(true);
  const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false);
  const [oauthModalStatus, setOauthModalStatus] = useState<ModalStatus>(MODAL_STATUS.IDLE);
  const [selectedOAuthProviderId, setSelectedOAuthProviderId] = useState<OAuthProviderId | null>(null);
  const [authState, setAuthState] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [callbackValidation, setCallbackValidation] = useState<CallbackValidation>(CALLBACK_VALIDATION.EMPTY);
  const [callbackMessage, setCallbackMessage] = useState("Paste the full URL.");
  const [oauthErrorMessage, setOauthErrorMessage] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingAttemptsRef = useRef(0);
  const selectedOAuthProviderIdRef = useRef<OAuthProviderId | null>(null);
  const authStateRef = useRef<string | null>(null);

  const selectedOAuthProvider = getOAuthProviderById(selectedOAuthProviderId);

  // ── API Key handlers ───────────────────────────────────────────────────────

  const refreshProviders = async () => {
    setLoading(true);
    const newConfigs = await loadProvidersData();
    setConfigs(newConfigs);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const newConfigs = await loadProvidersData();
      if (!isMounted) return;
      setConfigs(newConfigs);
      setLoading(false);
    };
    setLoading(true);
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const resetForm = () => {
    setApiKey("");
    setPrefix("");
    setBaseUrl("");
    setProviderName("");
  };

  const openModal = (providerId: ProviderId) => {
    setModalProvider(providerId);
    resetForm();
  };

  const closeModal = () => {
    setModalProvider(null);
    resetForm();
  };

  const handleAddKey = async () => {
    if (!modalProvider) return;
    if (!apiKey.trim()) {
      showToast("API key is required", "error");
      return;
    }
    if (modalProvider === PROVIDER_IDS.OPENAI && !providerName.trim()) {
      showToast("Provider name is required for OpenAI compatibility", "error");
      return;
    }

    setSaving(true);
    const provider = PROVIDERS.find((item) => item.id === modalProvider);
    if (!provider) {
      setSaving(false);
      return;
    }

    try {
      const listRes = await fetch(provider.endpoint);
      if (!listRes.ok) {
        showToast("Failed to load current keys", "error");
        setSaving(false);
        return;
      }
      const data = await listRes.json();

      if (provider.id === PROVIDER_IDS.OPENAI) {
        const existing = extractOpenAIEntriesForPut(data);
        const newEntry: OpenAIProviderEntry = {
          name: providerName.trim(),
          "api-key-entries": [{ "api-key": apiKey.trim() }],
          models: [],
          headers: {},
        };
        if (prefix.trim()) {
          newEntry.prefix = prefix.trim();
        }
        if (baseUrl.trim()) {
          newEntry["base-url"] = baseUrl.trim();
        }
        const res = await fetch(provider.endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([...existing, newEntry]),
        });
        if (!res.ok) {
          showToast("Failed to save provider key", "error");
          setSaving(false);
          return;
        }
      } else {
        const currentEntries = extractApiKeys(data, provider.responseKey).map((key) => ({
          "api-key": key,
        }));
        const newEntry: ApiKeyEntry = { "api-key": apiKey.trim() };
        if (prefix.trim()) {
          newEntry.prefix = prefix.trim();
        }
        const res = await fetch(provider.endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([...currentEntries, newEntry]),
        });
        if (!res.ok) {
          showToast("Failed to save provider key", "error");
          setSaving(false);
          return;
        }
      }

      showToast("Provider key added", "success");
      closeModal();
      await refreshProviders();
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (provider: ProviderConfig, key: string) => {
    if (!confirm("Are you sure you want to remove this key?")) return;
    try {
      const res = await fetch(
        `${provider.endpoint}?api-key=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        showToast("Failed to delete provider key", "error");
        return;
      }
      showToast("Provider key deleted", "success");
      refreshProviders();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleDeleteOpenAIProvider = async (providerNameValue: string) => {
    if (!confirm("Are you sure you want to remove this provider?")) return;
    try {
      const res = await fetch(
        `/api/management/openai-compatibility?name=${encodeURIComponent(providerNameValue)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        showToast("Failed to delete provider", "error");
        return;
      }
      showToast("Provider deleted", "success");
      refreshProviders();
    } catch {
      showToast("Network error", "error");
    }
  };

  // ── OAuth handlers ─────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingAttemptsRef.current = 0;
  }, []);

  const loadAccounts = useCallback(async () => {
    setOauthAccountsLoading(true);
    try {
      const res = await fetch("/api/management/auth-files");
      if (!res.ok) {
        showToast("Failed to load OAuth accounts", "error");
        setOauthAccountsLoading(false);
        return;
      }

      const data: AuthFilesResponse = await res.json();
      setAccounts(Array.isArray(data.files) ? data.files : []);
      setOauthAccountsLoading(false);
    } catch {
      setOauthAccountsLoading(false);
      showToast("Network error", "error");
      setOauthErrorMessage("Network error while loading accounts.");
    }
  }, [showToast]);

  useEffect(() => {
    void loadAccounts();
    return () => {
      stopPolling();
    };
  }, [loadAccounts, stopPolling]);

  const openAuthPopup = (url: string) => {
    // noopener makes window.open() return null — do not add it back
    const popup = window.open(url, "oauth", "width=600,height=800");
    return popup !== null;
  };

  const pollAuthStatus = (state: string) => {
    if (pollingIntervalRef.current !== null) {
      return;
    }

    pollingIntervalRef.current = window.setInterval(async () => {
      pollingAttemptsRef.current += 1;
      if (pollingAttemptsRef.current > 60) {
        stopPolling();
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("Timed out waiting for authorization.");
        return;
      }

      try {
        const res = await fetch(
          `/api/management/get-auth-status?state=${encodeURIComponent(state)}`
        );
        if (!res.ok) {
          stopPolling();
          setOauthModalStatus(MODAL_STATUS.ERROR);
          setOauthErrorMessage("Failed to check authorization status.");
          return;
        }

        const data: AuthStatusResponse = await res.json();
        if (data.status === "wait") {
          return;
        }

        if (data.status === "ok") {
          stopPolling();
          setOauthModalStatus(MODAL_STATUS.SUCCESS);
          showToast("OAuth account connected", "success");
          void loadAccounts();
          return;
        }

        if (data.status === "error") {
          stopPolling();
          setOauthModalStatus(MODAL_STATUS.ERROR);
          setOauthErrorMessage(data.error || "OAuth authorization failed.");
          return;
        }
      } catch {
        stopPolling();
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("Network error while polling authorization.");
      }
    }, 2000);
  };

  const resetOAuthModalState = () => {
    stopPolling();
    setOauthModalStatus(MODAL_STATUS.IDLE);
    selectedOAuthProviderIdRef.current = null;
    setSelectedOAuthProviderId(null);
    authStateRef.current = null;
    setAuthState(null);
    setCallbackUrl("");
    setCallbackValidation(CALLBACK_VALIDATION.EMPTY);
    setCallbackMessage("Paste the full URL.");
    setOauthErrorMessage(null);
  };

  const handleOAuthModalClose = () => {
    setIsOAuthModalOpen(false);
    resetOAuthModalState();
  };

  const handleOAuthConnect = async (providerId: OAuthProviderId) => {
    const provider = getOAuthProviderById(providerId);
    if (!provider) return;

    selectedOAuthProviderIdRef.current = providerId;
    setSelectedOAuthProviderId(providerId);
    setIsOAuthModalOpen(true);
    setOauthModalStatus(MODAL_STATUS.LOADING);
    setOauthErrorMessage(null);
    setCallbackUrl("");
    setCallbackValidation(CALLBACK_VALIDATION.EMPTY);
    setCallbackMessage("Paste the full URL.");

    try {
      const res = await fetch(provider.authEndpoint);
      if (!res.ok) {
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("Failed to start OAuth flow.");
        return;
      }

      const data: AuthUrlResponse = await res.json();
      if (!data.url || !data.state) {
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("OAuth response missing URL or state.");
        return;
      }

      const popupOpened = openAuthPopup(data.url);
      if (!popupOpened) {
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("Popup blocked. Allow pop-ups and try again.");
        return;
      }

      authStateRef.current = data.state;
      setAuthState(data.state);
      setOauthModalStatus(MODAL_STATUS.WAITING);
      showToast("OAuth window opened. Follow the steps below.", "info");
      pollAuthStatus(data.state);
    } catch {
      setOauthModalStatus(MODAL_STATUS.ERROR);
      setOauthErrorMessage("Network error while starting OAuth flow.");
    }
  };

  const handleCallbackChange = (value: string) => {
    setCallbackUrl(value);
    const validation = validateCallbackUrl(value);
    setCallbackValidation(validation.status);
    setCallbackMessage(validation.message);
  };

  const handleSubmitCallback = async () => {
    const currentProvider = selectedOAuthProviderIdRef.current;
    const currentState = authStateRef.current;
    if (!currentProvider || !currentState) {
      console.warn("[OAuth] Submit failed - provider:", currentProvider, "state:", currentState,
                   "stateFromState:", selectedOAuthProviderId, "providerFromState:", authState);
      setOauthModalStatus(MODAL_STATUS.ERROR);
      setOauthErrorMessage("Missing provider or state. Please restart the flow.");
      return;
    }

    const validation = validateCallbackUrl(callbackUrl);
    if (validation.status !== CALLBACK_VALIDATION.VALID) {
      setCallbackValidation(validation.status);
      setCallbackMessage(validation.message);
      return;
    }

    setOauthModalStatus(MODAL_STATUS.SUBMITTING);
    setOauthErrorMessage(null);

    try {
      const res = await fetch("/api/management/oauth-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: currentProvider,
          callbackUrl: callbackUrl.trim(),
        }),
      });

      const data: OAuthCallbackResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage(
          data.error || "Failed to relay the OAuth callback URL."
        );
        return;
      }

      stopPolling();
      setOauthModalStatus(MODAL_STATUS.POLLING);
      pollAuthStatus(currentState);
    } catch {
      setOauthModalStatus(MODAL_STATUS.ERROR);
      setOauthErrorMessage("Network error while submitting callback URL.");
    }
  };

  const handleToggleDisabled = async (account: AuthFileEntry) => {
    if (!account.name) return;
    try {
      const res = await fetch("/api/management/auth-files/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: account.name, disabled: !account.disabled }),
      });
      if (!res.ok) {
        showToast("Failed to update account status", "error");
        return;
      }
      showToast("Account status updated", "success");
      void loadAccounts();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleOAuthDelete = async (account: AuthFileEntry) => {
    if (!account.name) return;
    if (!confirm(`Remove OAuth account ${account.name}?`)) return;
    try {
      const res = await fetch(
        `/api/management/auth-files?name=${encodeURIComponent(account.name)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        showToast("Failed to remove OAuth account", "error");
        return;
      }
      showToast("OAuth account removed", "success");
      void loadAccounts();
    } catch {
      showToast("Network error", "error");
    }
  };

  const isOAuthSubmitDisabled =
    oauthModalStatus === MODAL_STATUS.LOADING ||
    oauthModalStatus === MODAL_STATUS.SUBMITTING ||
    oauthModalStatus === MODAL_STATUS.POLLING ||
    oauthModalStatus === MODAL_STATUS.SUCCESS ||
    callbackValidation !== CALLBACK_VALIDATION.VALID;

  // ── Render ─────────────────────────────────────────────────────────────────

   return (
     <div className="space-y-5">
       <div>
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           AI Provider Configuration
         </h1>
        <p className="mt-3 text-lg text-white/70">
          Configure API keys and authentication for your AI providers
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent>
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="size-12 animate-spin rounded-full border-4 border-white/20 border-t-purple-500"></div>
                <p className="text-white/80">Loading providers...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
         <>
           <div className="grid gap-4 lg:grid-cols-2">
            {PROVIDERS.map((provider) => {
              const config = configs[provider.id];
              const isOpenAI = provider.id === PROVIDER_IDS.OPENAI;
              const configuredCount = config.keys.length;
              const isConfigured = configuredCount > 0;

              return (
                <Card key={provider.id} className="relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl"></div>
                  
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-2xl backdrop-blur-xl">
                          {provider.icon}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{provider.name}</CardTitle>
                          <p className="mt-1 text-sm text-white/60">{provider.description}</p>
                        </div>
                      </div>
                      {isConfigured ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="rounded-full bg-gradient-to-r from-green-500/30 to-emerald-500/30 border border-green-400/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-green-300 shadow-lg shadow-green-500/10">
                            Active
                          </span>
                          <span className="text-xs text-white/50">{configuredCount} key{configuredCount !== 1 ? "s" : ""}</span>
                        </div>
                      ) : (
                        <span className="rounded-full bg-white/5 border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/50">
                          Inactive
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                     <div className="space-y-4">
                       {configuredCount === 0 ? (
                         <div className="rounded-xl border-l-4 border-purple-500/50 bg-gradient-to-r from-purple-500/5 to-transparent p-3">
                          <p className="text-sm font-medium text-white/80">No API keys configured</p>
                          <p className="mt-1 text-xs text-white/60">Add your first API key to get started</p>
                        </div>
                      ) : isOpenAI ? (
                        <div className="space-y-3">
                          {config.openAIProviders.map((openaiProvider, idx) => (
                            <div
                              key={openaiProvider.name}
                              className="group relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white">{openaiProvider.name}</h4>
                                    <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-300">
                                      {openaiProvider.apiKeys.length}
                                    </span>
                                  </div>
                                  {openaiProvider.baseUrl && (
                                    <p className="mt-1.5 truncate text-xs text-white/60">
                                      {openaiProvider.baseUrl}
                                    </p>
                                  )}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {openaiProvider.apiKeys.map((key) => (
                                      <div
                                        key={key}
                                        className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-3 py-1.5 font-mono text-xs text-white/80"
                                      >
                                        {maskKey(key)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <Button
                                  variant="danger"
                                  className="shrink-0 px-4 py-2 text-xs"
                                  onClick={() => handleDeleteOpenAIProvider(openaiProvider.name)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {config.keys.map((key, idx) => (
                            <div
                              key={key}
                              className="group flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-gradient-to-r from-white/5 to-white/[0.02] px-4 py-3 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/20 text-xs font-bold text-purple-300">
                                  {idx + 1}
                                </div>
                                <span className="font-mono text-sm text-white/90">{maskKey(key)}</span>
                              </div>
                              <Button
                                variant="danger"
                                className="px-3 py-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => handleDeleteKey(provider, key)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={() => openModal(provider.id)}
                          className="flex-1"
                        >
                          + Add API Key
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── OAuth Connected Accounts ──────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-2xl backdrop-blur-xl">
                  🔐
                </div>
                <div>
                  <CardTitle>Connected OAuth Accounts</CardTitle>
                  <p className="mt-1 text-sm text-white/60">
                    Manage your connected OAuth provider accounts
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {oauthAccountsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-purple-500"></div>
                    <p className="text-sm text-white/70">Loading accounts...</p>
                  </div>
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-xl border-l-4 border-white/30 bg-white/5 p-4 text-sm text-white/80 backdrop-blur-xl">
                  No OAuth accounts connected. Use the section below to connect accounts.
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id || account.name}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-white/20 bg-gradient-to-r from-white/5 to-white/[0.02] p-4 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {account.provider || account.type || "Unknown"}
                          </span>
                          <span
                            className={
                              account.disabled
                                ? "rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-xs font-medium text-white/50"
                                : account.status === "active"
                                  ? "rounded-full bg-gradient-to-r from-green-500/30 to-emerald-500/30 border border-green-400/50 px-2.5 py-0.5 text-xs font-medium text-green-300"
                                  : "rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-xs font-medium text-white/70"
                            }
                          >
                            {account.disabled ? "disabled" : account.status || "unknown"}
                          </span>
                        </div>
                        {(account.email || account.label) && (
                          <p className="mt-1 truncate text-xs text-white/60">
                            {account.email || account.label}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={account.disabled ? "secondary" : "ghost"}
                          className="px-3 py-1.5 text-xs"
                          onClick={() => handleToggleDisabled(account)}
                        >
                          {account.disabled ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          variant="danger"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => handleOAuthDelete(account)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Connect OAuth Account ────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Connect OAuth Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-xl border-l-4 border-blue-400/60 bg-blue-500/10 p-3 text-sm backdrop-blur-xl">
                <strong className="text-white">Note:</strong>{" "}
                <span className="text-white/90">
                  OAuth flows open in a new window. Make sure pop-ups are allowed.
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {OAUTH_PROVIDERS.map((provider) => (
                  <div
                    key={provider.id}
                    className="group flex flex-col justify-between rounded-xl border border-white/20 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">
                        {provider.name}
                      </div>
                      <p className="mt-2 text-sm text-white/60">
                        {provider.description}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleOAuthConnect(provider.id)}
                      className="mt-4 w-full"
                    >
                      Connect
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── API Key Add Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={modalProvider !== null} onClose={closeModal}>
        <ModalHeader>
          <ModalTitle>
            {modalProvider && PROVIDERS.find((p) => p.id === modalProvider)?.name} - Add API Key
          </ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-5">
            {modalProvider === PROVIDER_IDS.OPENAI && (
              <div>
                <label htmlFor="provider-name" className="mb-2 block text-sm font-semibold text-white">
                  Provider Name <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  name="provider-name"
                  value={providerName}
                  onChange={setProviderName}
                  placeholder="e.g., openrouter, together-ai"
                  required
                />
                <p className="mt-1.5 text-xs text-white/50">A unique identifier for this provider</p>
              </div>
            )}
            <div>
              <label htmlFor="api-key" className="mb-2 block text-sm font-semibold text-white">
                API Key <span className="text-red-400">*</span>
              </label>
              <Input
                type="password"
                name="api-key"
                value={apiKey}
                onChange={setApiKey}
                placeholder="sk-..."
                required
              />
              <p className="mt-1.5 text-xs text-white/50">Your API key will be encrypted and stored securely</p>
            </div>
            <div>
              <label htmlFor="prefix" className="mb-2 block text-sm font-semibold text-white">
                Model Prefix <span className="text-white/40">(Optional)</span>
              </label>
              <Input
                type="text"
                name="prefix"
                value={prefix}
                onChange={setPrefix}
                placeholder="e.g., gemini-, gpt-"
              />
              <p className="mt-1.5 text-xs text-white/50">Prefix to identify models from this key</p>
            </div>
            {modalProvider === PROVIDER_IDS.OPENAI && (
              <div>
                <label htmlFor="base-url" className="mb-2 block text-sm font-semibold text-white">
                  Base URL <span className="text-white/40">(Optional)</span>
                </label>
                <Input
                  type="text"
                  name="base-url"
                  value={baseUrl}
                  onChange={setBaseUrl}
                  placeholder="https://openrouter.ai/api/v1"
                />
                <p className="mt-1.5 text-xs text-white/50">The API endpoint for this provider</p>
              </div>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={handleAddKey} disabled={saving}>
            {saving ? "Adding..." : "Add API Key"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── OAuth Flow Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={isOAuthModalOpen} onClose={handleOAuthModalClose}>
        <ModalHeader>
          <ModalTitle>
            {selectedOAuthProvider ? `Connect ${selectedOAuthProvider.name}` : "Connect"}
          </ModalTitle>
        </ModalHeader>
        <ModalContent>
          {oauthModalStatus === MODAL_STATUS.LOADING && (
            <div className="rounded-xl border-l-4 border-white/30 bg-white/5 p-4 text-sm text-white/80 backdrop-blur-xl">
              Fetching authorization link...
            </div>
          )}

          {(oauthModalStatus === MODAL_STATUS.WAITING ||
            oauthModalStatus === MODAL_STATUS.SUBMITTING ||
            oauthModalStatus === MODAL_STATUS.POLLING ||
            oauthModalStatus === MODAL_STATUS.ERROR) && (
            <div className="space-y-4">
              <div className="rounded-xl border-l-4 border-purple-400/60 bg-white/10 p-4 text-sm backdrop-blur-xl">
                <div className="font-medium text-white">
                  Step-by-step
                </div>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-white/90">
                  <li>Log in and authorize in the popup window.</li>
                  <li>
                    After authorizing, the page will fail to load (this is
                    expected).
                  </li>
                  <li>
                    Our server runs remotely, so the OAuth redirect can&apos;t reach
                    it directly. Copy the FULL URL from the address bar.
                  </li>
                  <li>Paste the URL below and submit.</li>
                </ol>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-white/90">
                  Paste callback URL
                </div>
                <Input
                  type="text"
                  name="callbackUrl"
                  value={callbackUrl}
                  onChange={handleCallbackChange}
                  placeholder="https://localhost/callback?code=...&state=..."
                  disabled={
                    oauthModalStatus === MODAL_STATUS.SUBMITTING ||
                    oauthModalStatus === MODAL_STATUS.POLLING
                  }
                  className="font-mono"
                />
                <div
                  className={`mt-2 rounded-xl border-l-4 p-2 text-xs ${
                    callbackValidation === CALLBACK_VALIDATION.VALID
                      ? "border-green-400/60 bg-green-500/20 text-white backdrop-blur-xl"
                      : callbackValidation === CALLBACK_VALIDATION.INVALID
                        ? "border-red-400/60 bg-red-500/20 text-white backdrop-blur-xl"
                        : "border-white/30 bg-white/5 text-white/70 backdrop-blur-xl"
                  }`}
                >
                  {callbackMessage}
                </div>
              </div>
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.POLLING && (
            <div className="mt-4 rounded-xl border-l-4 border-blue-400/60 bg-blue-500/20 p-4 text-sm text-white backdrop-blur-xl">
              Callback submitted. Waiting for CLIProxyAPI to finish token
              exchange...
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.SUCCESS && (
            <div className="rounded-xl border-l-4 border-green-400/60 bg-green-500/20 p-4 text-sm text-white backdrop-blur-xl">
              OAuth account connected successfully.
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.ERROR && oauthErrorMessage && (
            <div className="rounded-xl border-l-4 border-red-400/60 bg-red-500/20 p-4 text-sm text-white backdrop-blur-xl">
              {oauthErrorMessage}
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={handleOAuthModalClose}>
            Close
          </Button>
          {oauthModalStatus !== MODAL_STATUS.SUCCESS && (
            <Button
              variant="secondary"
              onClick={handleSubmitCallback}
              disabled={isOAuthSubmitDisabled}
            >
              {oauthModalStatus === MODAL_STATUS.SUBMITTING
                ? "Submitting..."
                : oauthModalStatus === MODAL_STATUS.POLLING
                  ? "Waiting..."
                  : "Submit URL"}
            </Button>
          )}
          {oauthModalStatus === MODAL_STATUS.SUCCESS && (
            <Button variant="secondary" onClick={handleOAuthModalClose}>
              Done
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}

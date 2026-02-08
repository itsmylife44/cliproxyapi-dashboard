"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

// ── Types & Constants ──────────────────────────────────────────────────────────

const PROVIDER_IDS = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CODEX: "codex",
  OPENAI: "openai-compatibility",
} as const;

type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

interface CurrentUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface KeyWithOwnership {
  keyHash: string;
  maskedKey: string;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
}

interface OAuthAccountWithOwnership {
  id: string;
  accountName: string;
  accountEmail: string | null;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
}

const PROVIDERS = [
  {
    id: PROVIDER_IDS.CLAUDE,
    name: "Claude (Anthropic)",
    description: "Official Anthropic API",
    icon: "🤖",
  },
  {
    id: PROVIDER_IDS.GEMINI,
    name: "Gemini (Google)",
    description: "Google Gemini API",
    icon: "✨",
  },
  {
    id: PROVIDER_IDS.CODEX,
    name: "OpenAI / Codex",
    description: "OpenAI API including GPT models",
    icon: "🔮",
  },
  {
    id: PROVIDER_IDS.OPENAI,
    name: "OpenAI Compatible",
    description: "Custom providers like OpenRouter",
    icon: "🔌",
  },
] as const;

interface OwnerBadgeProps {
  ownerUsername: string | null;
  isOwn: boolean;
}

interface ProviderState {
  keys: KeyWithOwnership[];
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

// ── UI Components ──────────────────────────────────────────────────────────────

function OwnerBadge({ ownerUsername, isOwn }: OwnerBadgeProps) {
  if (isOwn) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border border-blue-400/50 px-2.5 py-1 text-xs font-bold text-blue-300 shadow-sm">
        <span className="size-1.5 rounded-full bg-blue-400 animate-pulse"></span>
        You
      </span>
    );
  }

  if (ownerUsername) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-xs font-medium text-white/70">
        <span className="size-1.5 rounded-full bg-purple-400"></span>
        {ownerUsername}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-white/40">
      <span className="size-1.5 rounded-full bg-white/20"></span>
      Team
    </span>
  );
}

// ── Utility Functions ──────────────────────────────────────────────────────────

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

const loadProvidersData = async (): Promise<Record<ProviderId, ProviderState>> => {
  const newConfigs: Record<ProviderId, ProviderState> = {
    [PROVIDER_IDS.CLAUDE]: { keys: [] },
    [PROVIDER_IDS.GEMINI]: { keys: [] },
    [PROVIDER_IDS.CODEX]: { keys: [] },
    [PROVIDER_IDS.OPENAI]: { keys: [] },
  };

  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(`/api/providers/keys?provider=${provider.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.keys)) {
          newConfigs[provider.id] = { keys: data.keys };
        }
      }
    } catch (error) {
      console.error(`Failed to load keys for ${provider.id}:`, error);
    }
  }

  return newConfigs;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [configs, setConfigs] = useState<Record<ProviderId, ProviderState>>(() => {
    const initialState: Record<ProviderId, ProviderState> = {
      [PROVIDER_IDS.CLAUDE]: { keys: [] },
      [PROVIDER_IDS.GEMINI]: { keys: [] },
      [PROVIDER_IDS.CODEX]: { keys: [] },
      [PROVIDER_IDS.OPENAI]: { keys: [] },
    };
    return initialState;
  });
  const [maxKeysPerUser, setMaxKeysPerUser] = useState<number>(10);
  const [modalProvider, setModalProvider] = useState<ProviderId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<OAuthAccountWithOwnership[]>([]);
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

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser({ id: data.id, username: data.username, isAdmin: data.isAdmin });
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  }, []);

  const loadMaxKeysPerUser = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const setting = data.settings?.find((s: { key: string; value: string }) => s.key === "max_provider_keys_per_user");
        if (setting) {
          const parsed = parseInt(setting.value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            setMaxKeysPerUser(parsed);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load max keys per user:", error);
    }
  }, [currentUser]);

  const refreshProviders = async () => {
    setLoading(true);
    const newConfigs = await loadProvidersData();
    setConfigs(newConfigs);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await loadCurrentUser();
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
  }, [loadCurrentUser]);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      void loadMaxKeysPerUser();
    }
  }, [currentUser, loadMaxKeysPerUser]);

   const resetForm = () => {
     setApiKey("");
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

    setSaving(true);

    try {
       const res = await fetch("/api/providers/keys", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           provider: modalProvider,
           apiKey: apiKey.trim(),
         }),
       });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          showToast("This API key has already been contributed", "error");
        } else if (res.status === 403) {
          showToast(data.error || "Key limit reached", "error");
        } else {
          showToast(data.error || "Failed to add provider key", "error");
        }
        setSaving(false);
        return;
      }

      showToast("Provider key added successfully", "success");
      closeModal();
      await refreshProviders();
    } catch (error) {
      console.error("Add key error:", error);
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (keyHash: string, provider: string) => {
    if (!confirm("Are you sure you want to remove this key?")) return;
    try {
      const res = await fetch(`/api/providers/keys/${keyHash}?provider=${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to delete provider key", "error");
        return;
      }
      showToast("Provider key deleted", "success");
      await refreshProviders();
    } catch (error) {
      console.error("Delete key error:", error);
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
      const res = await fetch("/api/providers/oauth");
      if (!res.ok) {
        showToast("Failed to load OAuth accounts", "error");
        setOauthAccountsLoading(false);
        return;
      }

      const data = await res.json();
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      setOauthAccountsLoading(false);
    } catch (error) {
      console.error("Load accounts error:", error);
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

  const handleOAuthDelete = async (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    if (!confirm(`Remove OAuth account ${account.accountName}?`)) return;
    try {
      const res = await fetch(`/api/providers/oauth/${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to remove OAuth account", "error");
        return;
      }
      showToast("OAuth account removed", "success");
      void loadAccounts();
    } catch (error) {
      console.error("Delete OAuth error:", error);
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
     <div className="space-y-8">
       <div>
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           AI Provider Configuration
         </h1>
        <p className="mt-3 text-lg text-white/70">
          Configure API keys and OAuth authentication for your AI providers
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
           {/* ── API Key Provider Management ───────────────────────────────────── */}
           <section className="space-y-4">
             <div className="flex items-center gap-3 border-b border-white/10 pb-3">
               <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-xl backdrop-blur-xl">
                 🔑
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white">API Key Providers</h2>
                 <p className="text-sm text-white/60">Manage API keys for direct provider access</p>
               </div>
             </div>

             <div className="grid gap-4 lg:grid-cols-2">
              {PROVIDERS.map((provider) => {
                const config = configs[provider.id];
                const userKeyCount = currentUser ? config.keys.filter((k) => k.isOwn).length : 0;
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
                        ) : (
                          <div className="space-y-2">
                            {config.keys.map((keyInfo, idx) => (
                              <div
                                key={keyInfo.keyHash}
                                className="group flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-gradient-to-r from-white/5 to-white/[0.02] px-4 py-3 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                                style={{ animationDelay: `${idx * 50}ms` }}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/20 text-xs font-bold text-purple-300 shrink-0">
                                    {idx + 1}
                                  </div>
                               <div className="flex flex-col min-w-0">
                                     <span className="font-mono text-sm text-white/90">{keyInfo.maskedKey}</span>
                                   </div>
                                  {currentUser && (
                                    <OwnerBadge
                                      ownerUsername={keyInfo.ownerUsername}
                                      isOwn={keyInfo.isOwn}
                                    />
                                  )}
                                </div>
                                {currentUser && (keyInfo.isOwn || currentUser.isAdmin) && (
                                  <Button
                                    variant="danger"
                                    className="px-3 py-1.5 text-xs shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={() => handleDeleteKey(keyInfo.keyHash, provider.id)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button 
                            onClick={() => openModal(provider.id)}
                            className="flex-1"
                            disabled={!currentUser}
                          >
                            + Add API Key
                          </Button>
                          {currentUser && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-xs text-white/70">
                              <span className="font-medium text-white/90">{userKeyCount}</span>
                              <span>/</span>
                              <span>{maxKeysPerUser}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
           </section>

           {/* ── OAuth Account Management ──────────────────────────────────────── */}
           <section className="space-y-4">
             <div className="flex items-center gap-3 border-b border-white/10 pb-3">
               <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-xl backdrop-blur-xl">
                 🔐
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white">OAuth Accounts</h2>
                 <p className="text-sm text-white/60">Connect and manage provider accounts via OAuth</p>
               </div>
             </div>

             {/* Connected OAuth Accounts */}
             <Card>
               <CardHeader>
                 <div className="flex items-center justify-between">
                   <div>
                     <CardTitle className="text-lg">Connected Accounts</CardTitle>
                     <p className="mt-1 text-sm text-white/60">
                       Active OAuth provider connections
                     </p>
                   </div>
                   {accounts.length > 0 && (
                     <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-bold text-white/80">
                       {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
                     </span>
                   )}
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
                     No OAuth accounts connected yet. Connect your first account below.
                   </div>
                 ) : (
                    <div className="space-y-3">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="group rounded-xl border border-white/20 bg-gradient-to-r from-white/5 to-white/[0.02] p-4 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-base font-bold text-white">
                                  {account.provider}
                                </span>
                                {currentUser && (
                                  <OwnerBadge
                                    ownerUsername={account.ownerUsername}
                                    isOwn={account.isOwn}
                                  />
                                )}
                              </div>
                              {account.accountEmail && (
                                <p className="truncate text-sm text-white/70">
                                  {account.accountEmail}
                                </p>
                              )}
                              <p className="truncate text-xs text-white/50 font-mono">
                                {account.accountName}
                              </p>
                            </div>
                            {currentUser && (account.isOwn || currentUser.isAdmin) && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="danger"
                                  className="px-4 py-2 text-xs"
                                  onClick={() => handleOAuthDelete(account.id)}
                                >
                                  Disconnect
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                 )}
               </CardContent>
             </Card>

             {/* Connect OAuth Account */}
             <Card>
               <CardHeader>
                 <CardTitle className="text-lg">Connect New Account</CardTitle>
                 <p className="mt-1 text-sm text-white/60">
                   Link OAuth provider accounts for subscription-based access
                 </p>
               </CardHeader>
               <CardContent>
                 <div className="mb-4 rounded-xl border-l-4 border-blue-400/60 bg-blue-500/10 p-3 text-sm backdrop-blur-xl">
                   <strong className="text-white">Note:</strong>{" "}
                   <span className="text-white/90">
                     OAuth flows open in a popup window. Make sure pop-ups are allowed in your browser.
                   </span>
                 </div>

                 <div className="grid gap-4 sm:grid-cols-2">
                   {OAUTH_PROVIDERS.map((provider) => (
                     <div
                       key={provider.id}
                       className="group flex flex-col justify-between rounded-xl border border-white/20 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-lg hover:shadow-purple-500/10"
                     >
                       <div className="space-y-2">
                         <div className="text-base font-bold text-white">
                           {provider.name}
                         </div>
                         <p className="text-sm text-white/60 leading-relaxed">
                           {provider.description}
                         </p>
                       </div>
                       <Button
                         variant="secondary"
                         onClick={() => handleOAuthConnect(provider.id)}
                         className="mt-4 w-full"
                       >
                         Connect {provider.name}
                       </Button>
                     </div>
                   ))}
                 </div>
               </CardContent>
              </Card>
           </section>

           {/* ── Admin Settings ────────────────────────────────────────────────── */}
           {currentUser?.isAdmin && (
             <section className="space-y-4">
               <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                 <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-xl backdrop-blur-xl">
                   ⚙️
                 </div>
                 <div>
                   <h2 className="text-xl font-bold text-white">Admin Settings</h2>
                   <p className="text-sm text-white/60">Configure provider key limits and policies</p>
                 </div>
               </div>

               <Card>
                 <CardHeader>
                   <CardTitle className="text-lg">Key Contribution Limits</CardTitle>
                   <p className="mt-1 text-sm text-white/60">
                     Control how many provider keys each user can contribute
                   </p>
                 </CardHeader>
                 <CardContent>
                   <div className="flex items-center gap-4">
                     <div className="flex-1">
                       <label htmlFor="max-keys" className="mb-2 block text-sm font-semibold text-white">
                         Max Keys Per User
                       </label>
                       <Input
                         type="number"
                         name="max-keys"
                         value={maxKeysPerUser.toString()}
                         onChange={(value) => {
                           const parsed = parseInt(value, 10);
                           if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
                             setMaxKeysPerUser(parsed);
                           }
                         }}
                       />
                       <p className="mt-1.5 text-xs text-white/50">
                         Maximum number of provider keys a single user can contribute (current: {maxKeysPerUser})
                       </p>
                     </div>
                     <Button
                       variant="secondary"
                       className="mt-6"
                       onClick={async () => {
                         try {
                           const res = await fetch("/api/admin/settings", {
                             method: "PUT",
                             headers: { "Content-Type": "application/json" },
                             body: JSON.stringify({
                               key: "max_provider_keys_per_user",
                               value: maxKeysPerUser.toString(),
                             }),
                           });
                           if (res.ok) {
                             showToast("Setting updated successfully", "success");
                           } else {
                             const data = await res.json();
                             showToast(data.error || "Failed to update setting", "error");
                           }
                         } catch (error) {
                           console.error("Update setting error:", error);
                           showToast("Network error", "error");
                         }
                       }}
                     >
                       Save
                     </Button>
                   </div>
                 </CardContent>
               </Card>
             </section>
           )}
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
                disabled={saving}
              />
              <p className="mt-1.5 text-xs text-white/50">Your API key will be stored securely and associated with your account</p>
            </div>
            {currentUser && (
              <div className="rounded-xl border-l-4 border-blue-400/60 bg-blue-500/10 p-3 text-sm backdrop-blur-xl">
                <p className="text-white/90">
                  <strong>Usage:</strong> You have contributed {currentUser ? configs[PROVIDER_IDS.CLAUDE].keys.filter((k) => k.isOwn).length + configs[PROVIDER_IDS.GEMINI].keys.filter((k) => k.isOwn).length + configs[PROVIDER_IDS.CODEX].keys.filter((k) => k.isOwn).length + configs[PROVIDER_IDS.OPENAI].keys.filter((k) => k.isOwn).length : 0} / {maxKeysPerUser} keys total
                </p>
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

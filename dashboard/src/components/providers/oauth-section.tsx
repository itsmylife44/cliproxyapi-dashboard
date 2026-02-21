"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { OwnerBadge, type CurrentUserLike } from "@/components/providers/api-key-section";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface OAuthSectionProps {
  showToast: ShowToast;
  currentUser: CurrentUserLike | null;
  refreshProviders: () => Promise<void>;
  onAccountCountChange: (count: number) => void;
}

const OAUTH_PROVIDERS = [
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

interface OAuthAccountWithOwnership {
  id: string;
  accountName: string;
  accountEmail: string | null;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
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

export function OAuthSection({
  showToast,
  currentUser,
  refreshProviders,
  onAccountCountChange,
}: OAuthSectionProps) {
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
  const noCallbackClaimTimeoutRef = useRef<number | null>(null);
  const noCallbackClaimAttemptsRef = useRef(0);
  const authStateRef = useRef<string | null>(null);
  const selectedOAuthProviderIdRef = useRef<OAuthProviderId | null>(null);
  const [accounts, setAccounts] = useState<OAuthAccountWithOwnership[]>([]);
  const [oauthAccountsLoading, setOauthAccountsLoading] = useState(true);
  const [showConfirmOAuthDelete, setShowConfirmOAuthDelete] = useState(false);
  const [pendingOAuthDelete, setPendingOAuthDelete] = useState<{ accountId: string; accountName: string } | null>(null);

  const selectedOAuthProvider = getOAuthProviderById(selectedOAuthProviderId);
  const selectedOAuthProviderRequiresCallback = selectedOAuthProvider?.requiresCallback ?? true;

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingAttemptsRef.current = 0;
  }, []);

  const stopNoCallbackClaimPolling = useCallback(() => {
    if (noCallbackClaimTimeoutRef.current !== null) {
      window.clearTimeout(noCallbackClaimTimeoutRef.current);
      noCallbackClaimTimeoutRef.current = null;
    }
    noCallbackClaimAttemptsRef.current = 0;
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
      const nextAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(nextAccounts);
      onAccountCountChange(nextAccounts.length);
      setOauthAccountsLoading(false);
    } catch {
      setOauthAccountsLoading(false);
      showToast("Network error", "error");
      setOauthErrorMessage("Network error while loading accounts.");
    }
  }, [onAccountCountChange, showToast]);

  const openAuthPopup = (url: string) => {
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
          await refreshProviders();
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
    stopNoCallbackClaimPolling();
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

  async function claimOAuthWithoutCallback(providerId: OAuthProviderId, state: string) {
    try {
      const res = await fetch("/api/management/oauth-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, state }),
      });

      const data: OAuthCallbackResponse = await res.json().catch(() => ({}));

      if (res.status === 202 || data.status === 202) {
        if (noCallbackClaimAttemptsRef.current >= 25) {
          stopNoCallbackClaimPolling();
          return;
        }

        noCallbackClaimAttemptsRef.current += 1;
        if (noCallbackClaimTimeoutRef.current !== null) {
          window.clearTimeout(noCallbackClaimTimeoutRef.current);
        }
        noCallbackClaimTimeoutRef.current = window.setTimeout(() => {
          void claimOAuthWithoutCallback(providerId, state);
        }, 3000);
        return;
      }

      if (!res.ok) {
        stopNoCallbackClaimPolling();
        stopPolling();
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage(data.error || "Failed to complete OAuth ownership claim.");
        return;
      }

      stopNoCallbackClaimPolling();
      void loadAccounts();
    } catch {
      if (noCallbackClaimAttemptsRef.current >= 25) {
        stopNoCallbackClaimPolling();
        return;
      }
      noCallbackClaimAttemptsRef.current += 1;
      if (noCallbackClaimTimeoutRef.current !== null) {
        window.clearTimeout(noCallbackClaimTimeoutRef.current);
      }
      noCallbackClaimTimeoutRef.current = window.setTimeout(() => {
        void claimOAuthWithoutCallback(providerId, state);
      }, 3000);
    }
  }

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

      if (provider.requiresCallback) {
        setOauthModalStatus(MODAL_STATUS.WAITING);
        setCallbackValidation(CALLBACK_VALIDATION.EMPTY);
        setCallbackMessage("Paste the full URL.");
        showToast("OAuth window opened. Follow the steps below.", "info");
      } else {
        setOauthModalStatus(MODAL_STATUS.POLLING);
        setCallbackValidation(CALLBACK_VALIDATION.VALID);
        setCallbackMessage("No callback URL needed. Complete sign-in in the popup window.");
        showToast("OAuth window opened. Complete sign-in in the popup.", "info");
        stopNoCallbackClaimPolling();
        void claimOAuthWithoutCallback(providerId, data.state);
      }

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

  const confirmDeleteOAuth = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    setPendingOAuthDelete({ accountId, accountName: account.accountName });
    setShowConfirmOAuthDelete(true);
  };

  const handleOAuthDelete = async () => {
    if (!pendingOAuthDelete) return;
    const { accountId } = pendingOAuthDelete;

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
      await refreshProviders();
      void loadAccounts();
    } catch {
      showToast("Network error", "error");
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAccounts();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      stopPolling();
      stopNoCallbackClaimPolling();
    };
  }, [loadAccounts, stopNoCallbackClaimPolling, stopPolling]);

  const isOAuthSubmitDisabled =
    oauthModalStatus === MODAL_STATUS.LOADING ||
    oauthModalStatus === MODAL_STATUS.SUBMITTING ||
    oauthModalStatus === MODAL_STATUS.POLLING ||
    oauthModalStatus === MODAL_STATUS.SUCCESS ||
    callbackValidation !== CALLBACK_VALIDATION.VALID;

  return (
    <>
      <section id="provider-oauth" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">OAuth Accounts</h2>
            <p className="text-xs text-slate-400">Subscription-based provider connections</p>
          </div>
          <span className="text-xs font-medium text-slate-400">{accounts.length} connected</span>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Connected Accounts</h3>
            <p className="mt-1 text-xs text-slate-500">Active OAuth provider connections</p>
          </div>
          {oauthAccountsLoading ? (
            <div className="flex items-center justify-center rounded-md border border-slate-700/70 bg-slate-900/25 p-8">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
                <p className="text-sm text-slate-400">Loading accounts...</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3 text-xs text-slate-400">
              No OAuth accounts connected yet. Connect your first account below.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/70 rounded-md border border-slate-700/70 bg-slate-900/25">
              {accounts.map((account) => (
                <div key={account.id} className="group p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{account.provider}</span>
                        {currentUser && (
                          <OwnerBadge ownerUsername={account.ownerUsername} isOwn={account.isOwn} />
                        )}
                      </div>
                      {account.accountEmail && (
                        <p className="truncate text-xs text-slate-300">{account.accountEmail}</p>
                      )}
                      <p className="truncate text-xs font-mono text-slate-500">{account.accountName}</p>
                    </div>
                    {currentUser && (account.isOwn || currentUser.isAdmin) && (
                      <div className="shrink-0">
                        <Button
                          variant="danger"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => confirmDeleteOAuth(account.id)}
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

          <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3 text-xs text-slate-400">
            <strong className="text-slate-200">Note:</strong> OAuth flows open in a popup window. Make sure pop-ups are allowed in your browser.
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Connect New Account</h3>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
            {OAUTH_PROVIDERS.map((provider, index) => (
              <div
                key={provider.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2.5",
                  index !== OAUTH_PROVIDERS.length - 1 && "border-b border-slate-700/70"
                )}
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-100">{provider.name}</div>
                  <p className="text-xs leading-relaxed text-slate-400">{provider.description}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleOAuthConnect(provider.id)}
                  className="shrink-0 px-2.5 py-1 text-xs"
                >
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            oauthModalStatus === MODAL_STATUS.ERROR) &&
            selectedOAuthProviderRequiresCallback && (
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

          {(oauthModalStatus === MODAL_STATUS.WAITING ||
            oauthModalStatus === MODAL_STATUS.POLLING ||
            oauthModalStatus === MODAL_STATUS.ERROR) &&
            !selectedOAuthProviderRequiresCallback && (
            <div className="rounded-xl border-l-4 border-purple-400/60 bg-white/10 p-4 text-sm backdrop-blur-xl">
              <div className="font-medium text-white">
                Device Authorization
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-white/90">
                <li>A browser window has opened with the authorization page.</li>
                <li>Log in and approve the access request.</li>
                <li>Once approved, this dialog will update automatically.</li>
              </ol>
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.POLLING && (
            <div className="mt-4 rounded-xl border-l-4 border-blue-400/60 bg-blue-500/20 p-4 text-sm text-white backdrop-blur-xl">
              {selectedOAuthProviderRequiresCallback
                ? "Callback submitted. Waiting for CLIProxyAPI to finish token exchange..."
                : "Waiting for CLIProxyAPI to finish OAuth authorization..."}
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
          {oauthModalStatus !== MODAL_STATUS.SUCCESS && selectedOAuthProviderRequiresCallback && (
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

      <ConfirmDialog
        isOpen={showConfirmOAuthDelete}
        onClose={() => {
          setShowConfirmOAuthDelete(false);
          setPendingOAuthDelete(null);
        }}
        onConfirm={handleOAuthDelete}
        title="Remove OAuth Account"
        message={`Remove OAuth account ${pendingOAuthDelete?.accountName}?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
      />
    </>
  );
}

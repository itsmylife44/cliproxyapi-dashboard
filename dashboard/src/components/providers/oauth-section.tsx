"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { CurrentUserLike } from "@/components/providers/api-key-section";
import { OAuthCredentialList, type OAuthAccountWithOwnership } from "@/components/providers/oauth-credential-list";
import { OAuthImportForm } from "@/components/providers/oauth-import-form";
import { OAuthActions } from "@/components/providers/oauth-actions";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface OAuthSectionProps {
  showToast: ShowToast;
  currentUser: CurrentUserLike | null;
  refreshProviders: () => Promise<void>;
  onAccountCountChange: (count: number) => void;
  incognitoBrowserEnabled?: boolean;
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
  {
    id: "cursor" as const,
    name: "Cursor",
    description: "Cursor IDE (via PKCE OAuth)",
    authEndpoint: "/api/management/cursor-auth-url?is_webui=true",
    requiresCallback: false,
  },
  {
    id: "codebuddy" as const,
    name: "CodeBuddy",
    description: "Tencent CodeBuddy (via browser OAuth)",
    authEndpoint: "/api/management/codebuddy-auth-url?is_webui=true",
    requiresCallback: false,
  },
] as const;

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type OAuthProviderId = OAuthProvider["id"];
const OAUTH_STATUS_POLL_INTERVAL_MS = 5000;
const OAUTH_STATUS_POLL_INTERVAL_HIDDEN_MS = 10000;

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
  user_code?: string;
  method?: string;
  verification_uri?: string;
}
interface AuthStatusResponse {
  status?: string;
  error?: string;
  verification_url?: string;
  user_code?: string;
  url?: string;
}

interface OAuthCallbackResponse {
  status?: number;
  error?: string;
}

const getOAuthProviderById = (id: OAuthProviderId | null) =>
  OAUTH_PROVIDERS.find((provider) => provider.id === id) || null;

function isTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

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
  incognitoBrowserEnabled = false,
}: OAuthSectionProps) {
  const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false);
  const [oauthModalStatus, setOauthModalStatus] = useState<ModalStatus>(MODAL_STATUS.IDLE);
  const [selectedOAuthProviderId, setSelectedOAuthProviderId] = useState<OAuthProviderId | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [callbackValidation, setCallbackValidation] = useState<CallbackValidation>(CALLBACK_VALIDATION.EMPTY);
  const [callbackMessage, setCallbackMessage] = useState("Paste the full URL.");
  const [oauthErrorMessage, setOauthErrorMessage] = useState<string | null>(null);
  const [authLaunchUrl, setAuthLaunchUrl] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingAttemptsRef = useRef(0);
  const noCallbackClaimTimeoutRef = useRef<number | null>(null);
  const noCallbackClaimAttemptsRef = useRef(0);
  const authStateRef = useRef<string | null>(null);
  const selectedOAuthProviderIdRef = useRef<OAuthProviderId | null>(null);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<{ verificationUrl: string; userCode: string } | null>(null);
  const deviceCodePopupOpenedRef = useRef(false);
  const incognitoRef = useRef(incognitoBrowserEnabled);
  incognitoRef.current = incognitoBrowserEnabled;
  const [accounts, setAccounts] = useState<OAuthAccountWithOwnership[]>([]);
  const [oauthAccountsLoading, setOauthAccountsLoading] = useState(true);
  const [showConfirmOAuthDelete, setShowConfirmOAuthDelete] = useState(false);
  const [pendingOAuthDelete, setPendingOAuthDelete] = useState<{ accountId: string; accountName: string } | null>(null);
  const [togglingAccountId, setTogglingAccountId] = useState<string | null>(null);
  const [claimingAccountName, setClaimingAccountName] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProviderId, setImportProviderId] = useState<OAuthProviderId | null>(null);
  const [importJsonContent, setImportJsonContent] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "validating" | "uploading" | "success" | "error">("idle");
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);

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
      const res = await fetch(API_ENDPOINTS.PROVIDERS.OAUTH);
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

  const toggleOAuthAccount = async (accountId: string, currentlyDisabled: boolean) => {
    setTogglingAccountId(accountId);
    try {
      const res = await fetch(`${API_ENDPOINTS.PROVIDERS.OAUTH}/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !currentlyDisabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(extractApiError(data, "Failed to update account"), "error");
      } else {
        showToast(`OAuth account ${!currentlyDisabled ? "disabled" : "enabled"}`, "success");
        await loadAccounts();
        await refreshProviders();
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setTogglingAccountId(null);
    }
  };

  const claimOAuthAccount = async (accountName: string) => {
    setClaimingAccountName(accountName);
    try {
      const res = await fetch(API_ENDPOINTS.PROVIDERS.OAUTH_CLAIM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(extractApiError(data, "Failed to claim account"), "error");
      } else {
        showToast("Account claimed successfully", "success");
        await loadAccounts();
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setClaimingAccountName(null);
    }
  };

  const openAuthPopup = (url: string) => {
    const popup = window.open(url, "oauth", "width=600,height=800");
    return popup !== null;
  };

  const pollAuthStatus = (state: string) => {
    if (pollingIntervalRef.current !== null) {
      return;
    }

    pollingIntervalRef.current = window.setInterval(async () => {
      if (!isTabVisible()) {
        return;
      }

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

        if (data.status === "device_code" && data.verification_url && data.user_code) {
          setDeviceCodeInfo({
            verificationUrl: data.verification_url,
            userCode: data.user_code,
          });
          setAuthLaunchUrl(data.verification_url);
          if (!deviceCodePopupOpenedRef.current && !incognitoRef.current) {
            deviceCodePopupOpenedRef.current = true;
            window.open(data.verification_url, "oauth", "width=600,height=800");
          }
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
          setOauthErrorMessage(extractApiError(data, "OAuth authorization failed."));
          return;
        }
      } catch {
        stopPolling();
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("Network error while polling authorization.");
      }
    }, isTabVisible() ? OAUTH_STATUS_POLL_INTERVAL_MS : OAUTH_STATUS_POLL_INTERVAL_HIDDEN_MS);
  };

  const resetOAuthModalState = () => {
    stopPolling();
    stopNoCallbackClaimPolling();
    setOauthModalStatus(MODAL_STATUS.IDLE);
    selectedOAuthProviderIdRef.current = null;
    setSelectedOAuthProviderId(null);
    authStateRef.current = null;
    setCallbackUrl("");
    setCallbackValidation(CALLBACK_VALIDATION.EMPTY);
    setCallbackMessage("Paste the full URL.");
    setOauthErrorMessage(null);
    setAuthLaunchUrl(null);
    setDeviceCodeInfo(null);
    deviceCodePopupOpenedRef.current = false;
  };

  const handleOAuthModalClose = () => {
    setIsOAuthModalOpen(false);
    resetOAuthModalState();
  };

  async function claimOAuthWithoutCallback(providerId: OAuthProviderId, state: string) {
    try {
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.OAUTH_CALLBACK, {
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
        setOauthErrorMessage(extractApiError(data, "Failed to complete OAuth ownership claim."));
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
    setAuthLaunchUrl(null);

    try {
      const res = await fetch(provider.authEndpoint);
      if (!res.ok) {
        const errorData: unknown = await res.json().catch(() => null);
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage(
          extractApiError(errorData, `Failed to start OAuth flow (HTTP ${res.status}).`)
        );
        return;
      }

      const data: AuthUrlResponse = await res.json();
      if (!data.state) {
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("OAuth response missing state.");
        return;
      }

      if (!data.url && data.method === "device_code") {
        authStateRef.current = data.state;
        setOauthModalStatus(MODAL_STATUS.POLLING);
        setCallbackValidation(CALLBACK_VALIDATION.VALID);
        setCallbackMessage("Waiting for device authorization details...");
        showToast("Initializing device authorization flow...", "info");
        pollAuthStatus(data.state);
        stopNoCallbackClaimPolling();
        void claimOAuthWithoutCallback(provider.id, data.state);
        return;
      }

      if (!data.url) {
        setOauthModalStatus(MODAL_STATUS.ERROR);
        setOauthErrorMessage("OAuth response missing URL.");
        return;
      }
      setAuthLaunchUrl(data.url);

      const shouldOpenPopup = !incognitoBrowserEnabled;
      if (shouldOpenPopup) {
        const popupOpened = openAuthPopup(data.url);
        if (!popupOpened) {
          setOauthModalStatus(MODAL_STATUS.ERROR);
          setOauthErrorMessage("Popup blocked. Allow pop-ups and try again.");
          return;
        }
      }
      authStateRef.current = data.state;
      if (provider.requiresCallback) {
        setOauthModalStatus(MODAL_STATUS.WAITING);
        setCallbackValidation(CALLBACK_VALIDATION.EMPTY);
        setCallbackMessage("Paste the full URL.");
        showToast(
          incognitoBrowserEnabled
            ? "Open the authorization URL below in a private/incognito window, then follow the steps."
            : "OAuth window opened. Follow the steps below.",
          "info"
        );
      } else {
        setOauthModalStatus(MODAL_STATUS.POLLING);
        setCallbackValidation(CALLBACK_VALIDATION.VALID);
        setCallbackMessage(
          incognitoBrowserEnabled
            ? "No callback URL needed. Open the authorization URL below in a private/incognito window."
            : "No callback URL needed. Complete sign-in in the popup window."
        );
        showToast(
          incognitoBrowserEnabled
            ? "Open the authorization URL below in a private/incognito window."
            : "OAuth window opened. Complete sign-in in the popup.",
          "info"
        );
        if (data.user_code && data.url) {
          setDeviceCodeInfo({
            verificationUrl: data.url,
            userCode: data.user_code,
          });
          deviceCodePopupOpenedRef.current = shouldOpenPopup;
        }
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
      console.warn("[OAuth] Submit failed - missing provider or state");
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
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.OAUTH_CALLBACK, {
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
          extractApiError(data, "Failed to relay the OAuth callback URL.")
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
      const res = await fetch(`${API_ENDPOINTS.PROVIDERS.OAUTH}/${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, "Failed to remove OAuth account"), "error");
        return;
      }
      showToast("OAuth account removed", "success");
      await refreshProviders();
      void loadAccounts();
    } catch {
      showToast("Network error", "error");
    }
  };

  const openImportModal = (providerId: OAuthProviderId) => {
    setImportProviderId(providerId);
    setImportJsonContent("");
    setImportFileName("");
    setImportStatus("idle");
    setImportErrorMessage(null);
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportProviderId(null);
    setImportJsonContent("");
    setImportFileName("");
    setImportStatus("idle");
    setImportErrorMessage(null);
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setImportFileName("");
      setImportJsonContent("");
      setImportErrorMessage("Please select a JSON file.");
      setImportStatus("error");
      return;
    }

    if (file.size > 1024 * 1024) {
      setImportFileName("");
      setImportJsonContent("");
      setImportErrorMessage("File is too large (max 1MB).");
      setImportStatus("error");
      return;
    }

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setImportJsonContent(content);
        validateImportJson(content);
      }
    };
    reader.onerror = () => {
      setImportErrorMessage("Failed to read file.");
      setImportStatus("error");
    };
    reader.readAsText(file);
  };

  const validateImportJson = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setImportErrorMessage("File must contain a JSON object, not an array.");
        setImportStatus("error");
        return false;
      }
      setImportErrorMessage(null);
      setImportStatus("idle");
      return true;
    } catch {
      setImportErrorMessage("Invalid JSON content.");
      setImportStatus("error");
      return false;
    }
  };

  const handleImportJsonChange = (value: string) => {
    setImportJsonContent(value);
    if (value.trim()) {
      validateImportJson(value);
    } else {
      setImportErrorMessage(null);
      setImportStatus("idle");
    }
  };

  const handleImportSubmit = async () => {
    if (!importProviderId || !importJsonContent.trim()) return;

    if (!validateImportJson(importJsonContent)) return;

    const fileName = importFileName || `${importProviderId}-credential.json`;

    setImportStatus("uploading");
    setImportErrorMessage(null);

    try {
      const res = await fetch(API_ENDPOINTS.PROVIDERS.OAUTH_IMPORT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: importProviderId,
          fileName,
          fileContent: importJsonContent.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setImportStatus("error");
        setImportErrorMessage(extractApiError(data, "Failed to import credential."));
        return;
      }

      setImportStatus("success");
      showToast("OAuth credential imported successfully", "success");
      await refreshProviders();
      void loadAccounts();
    } catch {
      setImportStatus("error");
      setImportErrorMessage("Network error while importing credential.");
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

  const importProviderName = importProviderId
    ? getOAuthProviderById(importProviderId)?.name || importProviderId
    : "";

  return (
    <>
      <div id="provider-oauth" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-black">OAuth Accounts</h2>
            <p className="text-xs text-[#777169]">Subscription-based provider connections</p>
          </div>
          <span className="text-xs font-medium text-[#777169]">{accounts.length} connected</span>
        </div>

        <div className="space-y-3">
          <OAuthCredentialList
            accounts={accounts}
            loading={oauthAccountsLoading}
            currentUser={currentUser}
            togglingAccountId={togglingAccountId}
            claimingAccountName={claimingAccountName}
            onToggle={toggleOAuthAccount}
            onDelete={confirmDeleteOAuth}
            onClaim={claimOAuthAccount}
          />

          <div className="rounded-sm border border-[#e5e5e5] bg-white p-3 text-xs text-[#777169]">
            <strong className="text-black">Note:</strong>{" "}
            {incognitoBrowserEnabled
              ? "Incognito mode is enabled. Browsers do not let the dashboard force-open a private window, so you will open the authorization URL manually."
              : "OAuth flows open in a popup window. Make sure pop-ups are allowed in your browser."}
          </div>

          <OAuthActions
            providers={OAUTH_PROVIDERS}
            onConnect={handleOAuthConnect}
            onImport={openImportModal}
          />
        </div>
      </div>

      <Modal isOpen={isOAuthModalOpen} onClose={handleOAuthModalClose}>
        <ModalHeader>
          <ModalTitle>
            {selectedOAuthProvider ? `Connect ${selectedOAuthProvider.name}` : "Connect"}
          </ModalTitle>
        </ModalHeader>
        <ModalContent>
          {oauthModalStatus === MODAL_STATUS.LOADING && (
            <div className="rounded-xl border-l-4 border-[#ccc] bg-[#f5f5f5] p-4 text-sm text-[#4e4e4e]">
              Fetching authorization link...
            </div>
          )}

          {authLaunchUrl && (oauthModalStatus === MODAL_STATUS.WAITING || oauthModalStatus === MODAL_STATUS.POLLING || oauthModalStatus === MODAL_STATUS.ERROR) && (
            <div className={`rounded-xl border-l-4 p-4 text-sm ${
              incognitoBrowserEnabled
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-[#e5e5e5] bg-[#f5f5f5] text-[#4e4e4e]"
            }`}>
              <div className="font-medium text-black">
                {incognitoBrowserEnabled ? "Open This URL In A Private Window" : "Authorization URL"}
              </div>
              <p className="mt-2 text-[#4e4e4e]">
                {incognitoBrowserEnabled
                  ? "Open this link manually in a new Firefox Private Window or browser incognito window, then continue the flow."
                  : "If the popup did not appear, open this link manually."}
              </p>
              <div className="mt-3 rounded-lg bg-[#f5f5f5] p-3">
                <input
                  readOnly
                  value={authLaunchUrl}
                  className="w-full bg-transparent font-mono text-xs text-black outline-none"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(authLaunchUrl);
                      showToast("Authorization URL copied", "success");
                    } catch {
                      showToast("Failed to copy authorization URL", "error");
                    }
                  }}
                >
                  Copy URL
                </Button>
                {!incognitoBrowserEnabled && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const popupOpened = openAuthPopup(authLaunchUrl);
                      if (!popupOpened) {
                        showToast("Popup blocked. Allow pop-ups and try again.", "error");
                      }
                    }}
                  >
                    Open Again
                  </Button>
                )}
              </div>
            </div>
          )}

          {(oauthModalStatus === MODAL_STATUS.WAITING ||
            oauthModalStatus === MODAL_STATUS.SUBMITTING ||
            oauthModalStatus === MODAL_STATUS.POLLING ||
            oauthModalStatus === MODAL_STATUS.ERROR) &&
            selectedOAuthProviderRequiresCallback && (
            <div className="space-y-4">
              <div className="rounded-xl border-l-4 border-[#ccc] bg-[#f0f0f0] p-4 text-sm">
                <div className="font-medium text-black">
                  Step-by-step
                </div>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-black">
                  <li>{incognitoBrowserEnabled ? "Open the authorization URL above in a private/incognito window and sign in there." : "Log in and authorize in the popup window."}</li>
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
                <div className="mb-2 text-xs font-medium text-black">
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
                      ? "border-green-300 bg-green-50 text-green-700"
                      : callbackValidation === CALLBACK_VALIDATION.INVALID
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-[#ccc] bg-[#f5f5f5] text-[#4e4e4e]"
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
            <div className="rounded-xl border-l-4 border-[#ccc] bg-[#f0f0f0] p-4 text-sm">
              <div className="font-medium text-black">
                Device Authorization
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-black">
                <li>{incognitoBrowserEnabled ? "Open the authorization URL above in a private/incognito window." : "A browser window has opened with the authorization page."}</li>
                <li>Log in and approve the access request.</li>
                <li>Once approved, this dialog will update automatically.</li>
              </ol>
              {deviceCodeInfo && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-[#f5f5f5] p-3">
                    <p className="text-xs font-medium text-[#777169]">Your authorization code:</p>
                    <p className="mt-1 select-all font-mono text-lg font-bold tracking-wider text-black">{deviceCodeInfo.userCode}</p>
                  </div>
                  <p className="text-xs text-[#777169]">
                    Enter this code at{" "}
                    <a href={deviceCodeInfo.verificationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      {deviceCodeInfo.verificationUrl}
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.POLLING && (
            <div className="mt-4 rounded-xl border-l-4 border-blue-300 bg-blue-50 p-4 text-sm text-blue-700">
              {selectedOAuthProviderRequiresCallback
                ? "Callback submitted. Waiting for CLIProxyAPI to finish token exchange..."
                : "Waiting for CLIProxyAPI to finish OAuth authorization..."}
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.SUCCESS && (
            <div className="rounded-xl border-l-4 border-green-300 bg-green-50 p-4 text-sm text-green-700">
              OAuth account connected successfully.
            </div>
          )}

          {oauthModalStatus === MODAL_STATUS.ERROR && oauthErrorMessage && (
            <div className="rounded-xl border-l-4 border-red-300 bg-red-50 p-4 text-sm text-red-700">
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

      <OAuthImportForm
        isOpen={isImportModalOpen}
        providerName={importProviderName}
        jsonContent={importJsonContent}
        fileName={importFileName}
        status={importStatus}
        errorMessage={importErrorMessage}
        onClose={closeImportModal}
        onFileSelect={handleImportFileSelect}
        onJsonChange={handleImportJsonChange}
        onSubmit={handleImportSubmit}
      />
    </>
  );
}

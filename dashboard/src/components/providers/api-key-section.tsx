"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type ShowToast = ReturnType<typeof useToast>["showToast"];

export const PROVIDER_IDS = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CODEX: "codex",
  OPENAI: "openai-compatibility",
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

export interface CurrentUserLike {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface KeyWithOwnership {
  keyHash: string;
  maskedKey: string;
  provider: string;
  ownerUsername: string | null;
  ownerUserId: string | null;
  isOwn: boolean;
}

interface OwnerBadgeProps {
  ownerUsername: string | null;
  isOwn: boolean;
}

export interface ProviderState {
  keys: KeyWithOwnership[];
}

export const PROVIDERS = [
  {
    id: PROVIDER_IDS.CLAUDE,
    name: "Claude (Anthropic)",
    description: "Official Anthropic API",
  },
  {
    id: PROVIDER_IDS.GEMINI,
    name: "Gemini (Google)",
    description: "Google Gemini API",
  },
  {
    id: PROVIDER_IDS.CODEX,
    name: "OpenAI / Codex",
    description: "OpenAI API including GPT models",
  },
  {
    id: PROVIDER_IDS.OPENAI,
    name: "OpenAI Compatible",
    description: "Custom providers like OpenRouter",
  },
] as const;

export const API_KEY_PROVIDERS = PROVIDERS.filter(
  (provider) => provider.id !== PROVIDER_IDS.OPENAI
);

export function OwnerBadge({ ownerUsername, isOwn }: OwnerBadgeProps) {
  if (isOwn) {
    return (
      <span className="inline-flex items-center rounded-sm border border-blue-400/50 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-200">
        You
      </span>
    );
  }

  if (ownerUsername) {
    return (
      <span className="inline-flex items-center rounded-sm border border-slate-600/70 bg-slate-800/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">
        {ownerUsername}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-sm border border-slate-700/70 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
      Team
    </span>
  );
}

interface ApiKeySectionProps {
  showToast: ShowToast;
  currentUser: CurrentUserLike | null;
  configs: Record<ProviderId, ProviderState>;
  maxKeysPerUser: number;
  refreshProviders: () => Promise<void>;
}

export function ApiKeySection({
  showToast,
  currentUser,
  configs,
  maxKeysPerUser,
  refreshProviders,
}: ApiKeySectionProps) {
  const [modalProvider, setModalProvider] = useState<ProviderId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirmKeyDelete, setShowConfirmKeyDelete] = useState(false);
  const [pendingKeyDelete, setPendingKeyDelete] = useState<{ keyHash: string; provider: string } | null>(null);

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
        const errorMessage = data.error?.message ?? data.error ?? "Failed to add provider key";
        if (res.status === 409) {
          showToast("This API key has already been contributed", "error");
        } else if (res.status === 403) {
          showToast(errorMessage, "error");
        } else {
          showToast(errorMessage, "error");
        }
        setSaving(false);
        return;
      }

      showToast("Provider key added successfully", "success");
      closeModal();
      await refreshProviders();
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteKey = (keyHash: string, provider: string) => {
    setPendingKeyDelete({ keyHash, provider });
    setShowConfirmKeyDelete(true);
  };

  const handleDeleteKey = async () => {
    if (!pendingKeyDelete) return;
    const { keyHash, provider } = pendingKeyDelete;

    try {
      const res = await fetch(`/api/providers/keys/${keyHash}?provider=${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error?.message ?? data.error ?? "Failed to delete provider key", "error");
        return;
      }
      showToast("Provider key deleted", "success");
      await refreshProviders();
    } catch {
      showToast("Network error", "error");
    }
  };

  const providerStats = API_KEY_PROVIDERS.map((provider) => ({
    id: provider.id,
    count: configs[provider.id]?.keys.length ?? 0,
  }));
  const totalApiKeys = providerStats.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      <section id="provider-api-keys" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">API Key Providers</h2>
            <p className="text-xs text-slate-400">Direct provider access keys</p>
          </div>
          <span className="text-xs font-medium text-slate-400">{totalApiKeys} keys total</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px] overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/20">
            <div className="grid grid-cols-[minmax(0,1.6fr)_96px_120px_128px] items-center border-b border-slate-700/70 bg-slate-900/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              <span>Provider</span>
              <span>Status</span>
              <span>Keys</span>
              <span>Actions</span>
            </div>
            {API_KEY_PROVIDERS.map((provider) => {
              const config = configs[provider.id];
              const userKeyCount = currentUser ? config.keys.filter((k) => k.isOwn).length : 0;
              const configuredCount = config.keys.length;
              const isConfigured = configuredCount > 0;

              return (
                <div key={provider.id} className="border-b border-slate-700/70 last:border-b-0">
                  <div className="grid grid-cols-[minmax(0,1.6fr)_96px_120px_128px] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{provider.name}</p>
                      <p className="truncate text-xs text-slate-400">{provider.description}</p>
                    </div>
                    <span className={`text-xs font-medium ${isConfigured ? "text-emerald-300" : "text-slate-400"}`}>
                      {isConfigured ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-slate-300">
                      {configuredCount} {configuredCount === 1 ? "key" : "keys"}
                    </span>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => openModal(provider.id)}
                        className="px-2.5 py-1 text-xs"
                        disabled={!currentUser}
                      >
                        Add Key
                      </Button>
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    {configuredCount === 0 ? (
                      <p className="text-xs text-slate-500">No API keys configured.</p>
                    ) : (
                      <div className="overflow-hidden rounded-sm border border-slate-700/60">
                        {config.keys.map((keyInfo) => (
                          <div
                            key={keyInfo.keyHash}
                            className="group flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-900/30 px-3 py-2 last:border-b-0"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-mono text-xs text-slate-200">{keyInfo.maskedKey}</span>
                              {currentUser && (
                                <OwnerBadge ownerUsername={keyInfo.ownerUsername} isOwn={keyInfo.isOwn} />
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {currentUser && (
                                <span className="text-[11px] text-slate-500">{userKeyCount}/{maxKeysPerUser}</span>
                              )}
                              {currentUser && (keyInfo.isOwn || currentUser.isAdmin) && (
                                <Button
                                  variant="danger"
                                  className="px-2 py-1 text-[11px]"
                                  onClick={() => confirmDeleteKey(keyInfo.keyHash, provider.id)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Modal isOpen={modalProvider !== null} onClose={closeModal}>
        <ModalHeader>
          <ModalTitle>
            {modalProvider && PROVIDERS.find((p) => p.id === modalProvider)?.name} - Add API Key
          </ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
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
              <div className="rounded-sm border-l-4 border-blue-400/60 bg-blue-500/10 p-3 text-sm">
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

      <ConfirmDialog
        isOpen={showConfirmKeyDelete}
        onClose={() => {
          setShowConfirmKeyDelete(false);
          setPendingKeyDelete(null);
        }}
        onConfirm={handleDeleteKey}
        title="Remove API Key"
        message="Are you sure you want to remove this key?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
      />
    </>
  );
}

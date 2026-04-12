"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HelpTooltip } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedKey(id ?? text);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  return { copiedKey, copy };
}

const EMPTY_KEYS: ApiKey[] = [];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(EMPTY_KEYS);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyNameInput, setKeyNameInput] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyToClipboard();
  const t = useTranslations("apiKeys");

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys");
      if (!res.ok) {
        showToast(t("toastLoadFailed"), "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const keys = Array.isArray(data.apiKeys) ? data.apiKeys : [];
      setApiKeys(keys);
      setLoading(false);
    } catch {
      showToast(t("toastNetworkError"), "error");
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchApiKeys();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    setCreating(true);

    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyNameInput.trim() || "Default" }),
      });

      if (!res.ok) {
        showToast(t("toastCreateFailed"), "error");
        setCreating(false);
        return;
      }

      const newKey = await res.json();
      showToast(t("toastCreateSuccess"), "success");
      setNewKeyValue(newKey.key);
      setIsCreateModalOpen(false);
      setIsModalOpen(true);
      setCreating(false);
      await fetchApiKeys();
    } catch {
      showToast(t("toastNetworkError"), "error");
      setCreating(false);
    }
  };

  const confirmDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowConfirm(true);
  };

  const handleDeleteKey = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;

    try {
      const res = await fetch(
        `/api/user/api-keys?id=${encodeURIComponent(id)}`,
        {
        method: "DELETE",
        }
      );

      if (!res.ok) {
        showToast(t("toastDeleteFailed"), "error");
        return;
      }

      showToast(t("toastDeleteSuccess"), "success");
      setApiKeys((prev) => prev.filter((item) => item.id !== id));
    } catch {
      showToast(t("toastNetworkError"), "error");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewKeyValue(null);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">API Keys</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Manage dashboard access keys for clients and integrations. <HelpTooltip content="API keys authenticate external tools (like the opencode-cliproxyapi-sync plugin) to access your dashboard configuration programmatically" /></p>
          </div>
          <Button onClick={() => { setKeyNameInput(""); setIsCreateModalOpen(true); }} disabled={creating} className="px-2.5 py-1 text-xs" data-testid="api-key-create-trigger">
            Create Key
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">Loading...</div>
      ) : apiKeys.length === 0 ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-8">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]" aria-hidden="true">
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                <circle cx="12" cy="11" r="2" />
                <path d="M12 13a4 4 0 014 4h-8a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">No API keys created yet</h3>
              <p className="text-xs text-[var(--text-muted)]">Create your first API key to access the dashboard programmatically</p>
            </div>
            <Button onClick={() => { setKeyNameInput(""); setIsCreateModalOpen(true); }} disabled={creating} className="px-3 py-1.5 text-xs">
              {t("createApiKeyButton")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <section className="min-w-[600px] overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_180px_160px_110px] border-b border-[var(--surface-border)] bg-[var(--surface-base)]/95 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <span>Name</span>
              <span>Created</span>
              <span>Last Used</span>
              <span>Actions</span>
            </div>
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] items-center border-b border-[var(--surface-border)] px-3 py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">{apiKey.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-[var(--text-muted)]">{apiKey.keyPreview}</p>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{new Date(apiKey.createdAt).toLocaleDateString()}</span>
              <span className="text-xs text-[var(--text-muted)]">{apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : "Never"}</span>
              <div className="flex justify-end">
                <Button variant="danger" onClick={() => confirmDelete(apiKey.id)} className="px-2.5 py-1 text-xs" data-testid={`api-key-delete-trigger-${apiKey.id}`}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          </section>
        </div>
      )}

      {/* ── Create Key Modal ── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>{t("createModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="key-name-input" className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
                Key Name
              </label>
              <Input
                type="text"
                name="key-name-input"
                value={keyNameInput}
                onChange={setKeyNameInput}
                placeholder={t("keyNamePlaceholder")}
                disabled={creating}
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">Give your key a descriptive name for easy identification</p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
            {t("cancelButton")}
          </Button>
          <Button onClick={handleCreateKey} disabled={creating}>
            {creating ? t("creatingButton") : t("createButton")}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={isModalOpen && newKeyValue !== null} onClose={handleCloseModal}>
        <ModalHeader>
          <ModalTitle>{t("newKeyModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm">
              <div className="mb-2 font-medium text-[var(--text-primary)]">Copy this key now</div>
              <div className="relative group">
                <div className="break-all rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 pr-12 font-mono text-xs text-[var(--text-primary)]">
                  {newKeyValue}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (newKeyValue) {
                      copy(newKeyValue, "modal");
                      showToast(t("toastCopied"), "success");
                    }
                  }}
                  className="absolute right-2.5 top-2.5 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] p-1.5 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  title="Copy API key"
                >
                  {copiedKey === "modal" ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
            <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
              <span className="text-amber-700">This key will only be shown once. Store it securely.</span>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={handleCloseModal}>{t("savedButton")}</Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingDeleteId(null);
        }}
        onConfirm={handleDeleteKey}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        confirmLabel={t("deleteConfirmButton")}
        cancelLabel={t("deleteConfirmCancelButton")}
        variant="danger"
      />
    </div>
  );
}

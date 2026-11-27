"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HelpTooltip } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { formatUSD } from "@/lib/model-pricing";

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  spendLimit: number | null;
  totalSpend: number;
}

function toDateInputValue(isoString: string | null): string {
  if (!isoString) return "";
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysDateInput(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isKeyExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const dt = new Date(expiresAt);
  return !Number.isNaN(dt.getTime()) && dt.getTime() <= Date.now();
}

function isSpendLimitReached(totalSpend: number, spendLimit: number | null): boolean {
  return spendLimit !== null && spendLimit >= 0 && totalSpend >= spendLimit;
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
  const [createExpiryInput, setCreateExpiryInput] = useState("");
  const [createSpendLimitInput, setCreateSpendLimitInput] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editExpiryInput, setEditExpiryInput] = useState("");
  const [editSpendLimitInput, setEditSpendLimitInput] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(() => new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyToClipboard();
  const t = useTranslations("apiKeys");
  const tc = useTranslations("common");

  const fetchApiKeys = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.USER.API_KEYS, { signal });
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
      if (signal?.aborted) return;
      showToast(t("toastNetworkError"), "error");
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchApiKeys(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchApiKeys]);

  const parseSpendLimitInput = (raw: string): { valid: boolean; value: number | null } => {
    const trimmed = raw.trim();
    if (!trimmed) return { valid: true, value: null };
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { valid: false, value: null };
    }
    return { valid: true, value: parsed };
  };

  const openCreateModal = () => {
    setKeyNameInput("");
    setCreateExpiryInput("");
    setCreateSpendLimitInput("");
    setIsCreateModalOpen(true);
  };

  const openEditModal = (apiKey: ApiKey) => {
    setEditingKey(apiKey);
    setEditNameInput(apiKey.name);
    setEditIsActive(apiKey.isActive);
    setEditExpiryInput(toDateInputValue(apiKey.expiresAt));
    setEditSpendLimitInput(apiKey.spendLimit !== null ? String(apiKey.spendLimit) : "");
  };

  const handleCreateKey = async () => {
    const parsedLimit = parseSpendLimitInput(createSpendLimitInput);
    if (!parsedLimit.valid) {
      showToast(t("toastInvalidSpendLimit"), "error");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch(API_ENDPOINTS.USER.API_KEYS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyNameInput.trim() || tc("default"),
          expiresAt: createExpiryInput.trim() || null,
          spendLimit: parsedLimit.value,
        }),
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

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    const parsedLimit = parseSpendLimitInput(editSpendLimitInput);
    if (!parsedLimit.valid) {
      showToast(t("toastInvalidSpendLimit"), "error");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(API_ENDPOINTS.USER.API_KEYS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingKey.id,
          name: editNameInput.trim() || tc("default"),
          isActive: editIsActive,
          expiresAt: editExpiryInput.trim() || null,
          spendLimit: parsedLimit.value,
        }),
      });

      if (!res.ok) {
        showToast(t("toastUpdateFailed"), "error");
        setSavingEdit(false);
        return;
      }

      showToast(t("toastUpdateSuccess"), "success");
      setEditingKey(null);
      setSavingEdit(false);
      await fetchApiKeys();
    } catch {
      showToast(t("toastNetworkError"), "error");
      setSavingEdit(false);
    }
  };

  const handleToggleKeyActive = async (apiKey: ApiKey) => {
    if (togglingIds.has(apiKey.id)) return;
    const nextActive = !apiKey.isActive;

    // Immediate optimistic UI update
    setApiKeys((prev) =>
      prev.map((item) => (item.id === apiKey.id ? { ...item, isActive: nextActive } : item))
    );
    setTogglingIds((prev) => new Set(prev).add(apiKey.id));

    try {
      const res = await fetch(API_ENDPOINTS.USER.API_KEYS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: apiKey.id,
          isActive: nextActive,
        }),
      });

      if (!res.ok) {
        setApiKeys((prev) =>
          prev.map((item) => (item.id === apiKey.id ? { ...item, isActive: !nextActive } : item))
        );
        showToast(t("toastUpdateFailed"), "error");
      }
    } catch {
      setApiKeys((prev) =>
        prev.map((item) => (item.id === apiKey.id ? { ...item, isActive: !nextActive } : item))
      );
      showToast(t("toastNetworkError"), "error");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(apiKey.id);
        return next;
      });
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
        `${API_ENDPOINTS.USER.API_KEYS}?id=${encodeURIComponent(id)}`,
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
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
          <Button
            onClick={openCreateModal}
            disabled={creating}
            className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs"
            data-testid="api-key-create-trigger"
          >
            {t('createKeyButton')}
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('pageDescription')} <HelpTooltip content={t('pageTooltip')} /></p>
      </div>

      {loading ? (
        <div className="border-t border-[var(--surface-border)] py-10 text-center text-sm text-[var(--text-muted)]">{t('loadingText')}</div>
      ) : apiKeys.length === 0 ? (
        <div className="border-t border-[var(--surface-border)] py-10">
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
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('emptyTitle')}</h3>
              <p className="text-xs text-[var(--text-muted)]">{t('emptyDescription')}</p>
            </div>
            <Button onClick={openCreateModal} disabled={creating} className="px-3 py-1.5 text-xs">
              {t("createApiKeyButton")}
            </Button>
          </div>
        </div>
      ) : (
        <section className="border-t border-b border-[var(--surface-border)]">
          <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1fr)_160px_140px_130px_130px_90px] border-b border-[var(--surface-border)] bg-[var(--surface-base)]/95 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] md:grid">
            <span>{t('tableHeaderName')}</span>
            <span>{t('tableHeaderSpend')}</span>
            <span>{t('tableHeaderExpiry')}</span>
            <span>{t('tableHeaderCreated')}</span>
            <span>{t('tableHeaderLastUsed')}</span>
            <span className="text-right">{t('tableHeaderActions')}</span>
          </div>
          {apiKeys.map((apiKey) => {
            const expired = isKeyExpired(apiKey.expiresAt);
            const limitReached = isSpendLimitReached(apiKey.totalSpend, apiKey.spendLimit);
            const inactive = !apiKey.isActive || expired || limitReached;
            const spendRatio =
              apiKey.spendLimit && apiKey.spendLimit > 0
                ? Math.min(100, (apiKey.totalSpend / apiKey.spendLimit) * 100)
                : 0;

            return (
              <div
                key={apiKey.id}
                role="button"
                tabIndex={0}
                onClick={() => openEditModal(apiKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEditModal(apiKey);
                  }
                }}
                className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-[var(--surface-border)] px-2 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]/60 md:grid-cols-[minmax(0,1fr)_160px_140px_130px_130px_90px] md:gap-0"
                data-testid={`api-key-row-${apiKey.id}`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className={`truncate text-xs font-medium ${inactive ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>
                      {apiKey.name}
                    </p>
                    {!apiKey.isActive && (
                      <span className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {t("disabledBadge")}
                      </span>
                    )}
                    {expired && (
                      <span className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                        {t("expiredBadge")}
                      </span>
                    )}
                    {limitReached && (
                      <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        {t("limitReachedBadge")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--text-muted)]">{apiKey.keyPreview}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-muted)] md:hidden">
                    <span className="tabular-nums">
                      {formatUSD(apiKey.totalSpend)}
                      {apiKey.spendLimit !== null ? ` / ${formatUSD(apiKey.spendLimit)}` : ""}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {apiKey.expiresAt
                        ? t("expiresOn", { date: new Date(apiKey.expiresAt).toLocaleDateString() })
                        : t("noExpiry")}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('tableHeaderLastUsed')}:{" "}
                      {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : t('neverUsed')}
                    </span>
                  </p>
                </div>

                <div className="hidden pr-3 md:block">
                  <div className="flex items-baseline gap-1 font-mono text-xs tabular-nums">
                    <span className={limitReached ? "font-semibold text-rose-600 dark:text-rose-400" : "text-[var(--text-primary)]"}>
                      {formatUSD(apiKey.totalSpend)}
                    </span>
                    {apiKey.spendLimit !== null && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        / {formatUSD(apiKey.spendLimit)}
                      </span>
                    )}
                  </div>
                  {apiKey.spendLimit !== null && apiKey.spendLimit > 0 && (
                    <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className={`h-full transition-all ${
                          limitReached
                            ? "bg-rose-500"
                            : spendRatio >= 80
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${spendRatio}%` }}
                      />
                    </div>
                  )}
                </div>

                <span
                  className={`hidden text-xs md:block ${
                    expired ? "font-medium text-rose-600 dark:text-rose-400" : "text-[var(--text-muted)]"
                  }`}
                >
                  {apiKey.expiresAt ? new Date(apiKey.expiresAt).toLocaleDateString() : t("noExpiry")}
                </span>

                <span className="hidden text-xs text-[var(--text-muted)] md:block">{new Date(apiKey.createdAt).toLocaleDateString()}</span>
                <span
                  className="hidden text-xs text-[var(--text-muted)] md:block"
                  title={apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : undefined}
                >
                  {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : t('neverUsed')}
                </span>
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={apiKey.isActive}
                    onClick={() => void handleToggleKeyActive(apiKey)}
                    disabled={togglingIds.has(apiKey.id)}
                    className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                      apiKey.isActive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                        : "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    }`}
                    data-testid={`api-key-toggle-trigger-${apiKey.id}`}
                  >
                    <span className={`size-2 rounded-full ${apiKey.isActive ? "bg-emerald-500" : "bg-[var(--text-muted)]"}`} />
                    {apiKey.isActive ? t("keyEnabled") : t("keyDisabled")}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Create Key Modal ── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>{t("createModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="key-name-input" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                {t('keyNameLabel')}
              </label>
              <Input
                type="text"
                name="key-name-input"
                value={keyNameInput}
                onChange={setKeyNameInput}
                placeholder={t("keyNamePlaceholder")}
                disabled={creating}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t('keyNameHint')}</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="create-expiry-input" className="text-xs font-semibold text-[var(--text-secondary)]">
                  {t("expiryDateLabel")}
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: t("preset7d"), days: 7 },
                    { label: t("preset30d"), days: 30 },
                    { label: t("preset90d"), days: 90 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setCreateExpiryInput(addDaysDateInput(preset.days))}
                      className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {createExpiryInput && (
                    <button
                      type="button"
                      onClick={() => setCreateExpiryInput("")}
                      className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {t("clearExpiry")}
                    </button>
                  )}
                </div>
              </div>
              <input
                id="create-expiry-input"
                type="date"
                value={createExpiryInput}
                onChange={(e) => setCreateExpiryInput(e.target.value)}
                disabled={creating}
                className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t("expiryDateHint")}</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="create-spend-limit-input" className="text-xs font-semibold text-[var(--text-secondary)]">
                  {t("spendLimitLabel")}
                </label>
                {createSpendLimitInput && (
                  <button
                    type="button"
                    onClick={() => setCreateSpendLimitInput("")}
                    className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {t("clearLimit")}
                  </button>
                )}
              </div>
              <input
                id="create-spend-limit-input"
                type="number"
                min="0"
                step="0.01"
                value={createSpendLimitInput}
                onChange={(e) => setCreateSpendLimitInput(e.target.value)}
                placeholder={t("spendLimitPlaceholder")}
                disabled={creating}
                className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t("spendLimitHint")}</p>
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

      {/* ── Edit Key Settings Modal (Click on API Key) ── */}
      <Modal isOpen={editingKey !== null} onClose={() => setEditingKey(null)}>
        <ModalHeader>
          <ModalTitle>{t("editModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          {editingKey && (() => {
            const draftLimitNum = editSpendLimitInput.trim() ? Number(editSpendLimitInput) : null;
            const validDraftLimit = draftLimitNum !== null && Number.isFinite(draftLimitNum) && draftLimitNum > 0 ? draftLimitNum : null;
            const ratio = validDraftLimit ? Math.min(100, (editingKey.totalSpend / validDraftLimit) * 100) : 0;
            const overDraftLimit = draftLimitNum !== null && Number.isFinite(draftLimitNum) && draftLimitNum >= 0 && editingKey.totalSpend >= draftLimitNum;

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/50 px-3 py-2">
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{editingKey.keyPreview}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-muted)]">{t("currentSpendLabel")}:</span>
                    <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatUSD(editingKey.totalSpend)}
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-key-name-input" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    {t("keyNameLabel")}
                  </label>
                  <Input
                    type="text"
                    name="edit-key-name-input"
                    value={editNameInput}
                    onChange={setEditNameInput}
                    placeholder={t("keyNamePlaceholder")}
                    disabled={savingEdit}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2.5">
                  <div className="pr-3">
                    <div className="text-xs font-semibold text-[var(--text-secondary)]">{t("keyStatusLabel")}</div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t("keyStatusHint")}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editIsActive}
                    onClick={() => setEditIsActive((prev) => !prev)}
                    disabled={savingEdit}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      editIsActive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${editIsActive ? "bg-emerald-500" : "bg-[var(--text-muted)]"}`} />
                    {editIsActive ? t("keyEnabled") : t("keyDisabled")}
                  </button>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="edit-expiry-input" className="text-xs font-semibold text-[var(--text-secondary)]">
                      {t("expiryDateLabel")}
                    </label>
                    <div className="flex items-center gap-1">
                      {[
                        { label: t("preset7d"), days: 7 },
                        { label: t("preset30d"), days: 30 },
                        { label: t("preset90d"), days: 90 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setEditExpiryInput(addDaysDateInput(preset.days))}
                          className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                        >
                          {preset.label}
                        </button>
                      ))}
                      {editExpiryInput && (
                        <button
                          type="button"
                          onClick={() => setEditExpiryInput("")}
                          className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {t("clearExpiry")}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    id="edit-expiry-input"
                    type="date"
                    value={editExpiryInput}
                    onChange={(e) => setEditExpiryInput(e.target.value)}
                    disabled={savingEdit}
                    className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t("expiryDateHint")}</p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="edit-spend-limit-input" className="text-xs font-semibold text-[var(--text-secondary)]">
                      {t("spendLimitLabel")}
                    </label>
                    {editSpendLimitInput && (
                      <button
                        type="button"
                        onClick={() => setEditSpendLimitInput("")}
                        className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        {t("clearLimit")}
                      </button>
                    )}
                  </div>
                  <input
                    id="edit-spend-limit-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editSpendLimitInput}
                    onChange={(e) => setEditSpendLimitInput(e.target.value)}
                    placeholder={t("spendLimitPlaceholder")}
                    disabled={savingEdit}
                    className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  {validDraftLimit !== null && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className={overDraftLimit ? "font-semibold text-rose-600 dark:text-rose-400" : "text-[var(--text-muted)]"}>
                          {formatUSD(editingKey.totalSpend)} / {formatUSD(validDraftLimit)} ({ratio.toFixed(1)}%)
                        </span>
                        {overDraftLimit && (
                          <span className="font-medium text-rose-600 dark:text-rose-400">{t("limitReachedBadge")}</span>
                        )}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className={`h-full transition-all ${
                            overDraftLimit
                              ? "bg-rose-500"
                              : ratio >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t("spendLimitHint")}</p>
                </div>
              </div>
            );
          })()}
        </ModalContent>
        <ModalFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="danger"
              onClick={() => {
                if (editingKey) {
                  const id = editingKey.id;
                  setEditingKey(null);
                  confirmDelete(id);
                }
              }}
              disabled={savingEdit}
            >
              {t("deleteButton")}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setEditingKey(null)} disabled={savingEdit}>
                {t("cancelButton")}
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? t("savingButton") : t("saveButton")}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </Modal>

      <Modal isOpen={isModalOpen && newKeyValue !== null} onClose={handleCloseModal}>
        <ModalHeader>
          <ModalTitle>{t("newKeyModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm">
              <div className="mb-2 font-medium text-[var(--text-primary)]">{t('copyThisKey')}</div>
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
                  title={t('copyButtonTitle')}
                >
                  {copiedKey === "modal" ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
            <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
              <span className="text-amber-700">{t('keyShownOnce')}</span>
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

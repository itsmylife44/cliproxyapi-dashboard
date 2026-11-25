"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { OwnerBadge, type CurrentUserLike } from "@/components/providers/api-key-section";

interface OAuthAccountWithOwnership {
  id: string;
  authId: string | null;
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

interface OAuthCredentialListProps {
  accounts: OAuthAccountWithOwnership[];
  loading: boolean;
  currentUser: CurrentUserLike | null;
  togglingAccountId: string | null;
  claimingAccountName: string | null;
  onToggle: (accountId: string, currentlyDisabled: boolean) => void;
  onDelete: (accountId: string) => void;
  onClaim: (accountName: string) => void;
}

function parseStatusMessage(raw: string | null): string | null {
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

function OAuthStatusBadge({
  status,
  statusMessage,
  unavailable,
}: {
  status: string;
  statusMessage: string | null;
  unavailable: boolean;
}) {
  const t = useTranslations("providers");
  const message = parseStatusMessage(statusMessage);

  if (status === "active" && !unavailable) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400" title={t("tokenValidTooltip")}>
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {t("statusActive")}
      </span>
    );
  }

  if (status === "error" || unavailable) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400"
        title={message || t("accountErrorTooltip")}
      >
        <span className="size-1.5 rounded-full bg-rose-500" />
        {message
          ? message.length > 36 ? `${message.slice(0, 36)}…` : message
          : t("statusError")}
      </span>
    );
  }

  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]" title={t("accountDisabledTooltip")}>
        <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
        {t("statusDisabled")}
      </span>
    );
  }

  return null;
}

export type { OAuthAccountWithOwnership };

export function OAuthCredentialList({
  accounts,
  loading,
  currentUser,
  togglingAccountId,
  claimingAccountName,
  onToggle,
  onDelete,
  onClaim,
}: OAuthCredentialListProps) {
  const t = useTranslations("providers");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRootRef.current?.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);

  const providerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acc of accounts) {
      counts.set(acc.provider, (counts.get(acc.provider) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [accounts]);

  const activeFilter =
    providerFilter === "all" || providerCounts.some(([prov]) => prov === providerFilter)
      ? providerFilter
      : "all";

  const filteredAccounts = useMemo(
    () => (activeFilter === "all" ? accounts : accounts.filter((a) => a.provider === activeFilter)),
    [accounts, activeFilter]
  );

  return (
    <div className="space-y-3">
      {providerCounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setProviderFilter("all")}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-[var(--accent)] text-[var(--surface-base)]"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("allFilter")} ({accounts.length})
          </button>
          {providerCounts.map(([prov, count]) => (
            <button
              key={prov}
              type="button"
              onClick={() => setProviderFilter(prov)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeFilter === prov
                  ? "bg-[var(--accent)] text-[var(--surface-base)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {prov} <span className="tabular-nums opacity-75">({count})</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center border-t border-b border-[var(--surface-border)] py-10">
          <div className="flex flex-col items-center gap-3">
            <div className="size-7 animate-spin rounded-full border-2 border-[var(--surface-border)] border-t-blue-500"></div>
            <p className="text-sm text-[var(--text-muted)]">{t("loadingAccounts")}</p>
          </div>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="border-t border-b border-[var(--surface-border)] py-8 text-center text-sm text-[var(--text-muted)]">
          {t("noAccountsConnected")}
        </div>
      ) : (
        <div ref={menuRootRef} className="divide-y divide-[var(--surface-border)] border-t border-b border-[var(--surface-border)]">
          {filteredAccounts.map((account) => {
            const canManage = Boolean(currentUser && (account.isOwn || currentUser.isAdmin));
            const canClaim = Boolean(currentUser?.isAdmin && !account.ownerUsername);
            const isMenuOpen = openMenuId === account.id;

            return (
              <div
                key={account.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="inline-flex shrink-0 rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-primary)]">
                    {account.provider}
                  </span>
                  <span className="truncate font-mono text-xs text-[var(--text-primary)]" title={account.accountEmail || account.accountName}>
                    {account.accountEmail || account.accountName}
                  </span>
                  {account.accountEmail && account.accountName !== account.accountEmail && (
                    <span className="hidden truncate font-mono text-[11px] text-[var(--text-muted)] md:inline" title={account.accountName}>
                      ({account.accountName})
                    </span>
                  )}
                  {currentUser && (
                    <OwnerBadge ownerUsername={account.ownerUsername} isOwn={account.isOwn} />
                  )}
                  <OAuthStatusBadge
                    status={account.status}
                    statusMessage={account.statusMessage}
                    unavailable={account.unavailable}
                  />
                </div>

                {canManage && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId((prev) => (prev === account.id ? null : account.id))}
                      aria-label={t("actionsAriaLabel")}
                      aria-expanded={isMenuOpen}
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </button>

                    {isMenuOpen && (
                      <div className="glass-card absolute right-0 top-8 z-30 min-w-[140px] overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] py-1 shadow-lg">
                        {canClaim && (
                          <button
                            type="button"
                            disabled={claimingAccountName === account.accountName}
                            onClick={() => {
                              setOpenMenuId(null);
                              onClaim(account.accountName);
                            }}
                            className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                          >
                            {claimingAccountName === account.accountName ? "..." : t("claimButton")}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={togglingAccountId === account.id}
                          onClick={() => {
                            setOpenMenuId(null);
                            onToggle(account.id, account.status === "disabled");
                          }}
                          className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                        >
                          {togglingAccountId === account.id
                            ? "..."
                            : account.status === "disabled"
                              ? t("enableButton")
                              : t("disableButton")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onDelete(account.id);
                          }}
                          className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
                        >
                          {t("disconnectButton")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

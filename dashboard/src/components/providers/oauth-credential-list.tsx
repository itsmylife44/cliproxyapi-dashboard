"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { OwnerBadge, type CurrentUserLike } from "@/components/providers/api-key-section";

interface OAuthQuotaGroupState {
  authId: string;
  groupId: string;
  label: string;
  effectiveStatus: string;
  manualSuspended: boolean;
  manualReason: string | null;
  autoSuspendedUntil: string | null;
  autoReason: string | null;
  sourceModel: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

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
  quotaGroups?: OAuthQuotaGroupState[];
}

interface OAuthCredentialListProps {
  accounts: OAuthAccountWithOwnership[];
  loading: boolean;
  currentUser: CurrentUserLike | null;
  togglingAccountId: string | null;
  claimingAccountName: string | null;
  quotaActionKey: string | null;
  onToggle: (accountId: string, currentlyDisabled: boolean) => void;
  onDelete: (accountId: string) => void;
  onClaim: (accountName: string) => void;
  onForceSuspend: (authId: string, groupId: string) => void;
  onLiftManual: (authId: string, groupId: string) => void;
  onClearCooldown: (authId: string, groupId: string) => void;
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
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600" title={t('tokenValidTooltip')}>
        <span className="size-1.5 rounded-full bg-emerald-400" />
        {t("statusActive")}
      </span>
    );
  }

  if (status === "error" || unavailable) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600"
        title={message || t('accountErrorTooltip')}
      >
        <span className="size-1.5 rounded-full bg-red-400" />
        {message
          ? message.length > 40 ? `${message.slice(0, 40)}…` : message
          : t("statusError")}
      </span>
    );
  }

  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]" title={t('accountDisabledTooltip')}>
        <span className="size-1.5 rounded-full bg-[#999]" />
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
  quotaActionKey,
  onToggle,
  onDelete,
  onClaim,
  onForceSuspend,
  onLiftManual,
  onClearCooldown,
}: OAuthCredentialListProps) {
  const t = useTranslations("providers");
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  const toggleExpanded = (accountId: string) => {
    setExpandedAccounts((current) => ({ ...current, [accountId]: !current[accountId] }));
  };

  return (
    <>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("connectedAccountsTitle")}</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t("connectedAccountsDescription")}</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--surface-border)] border-t-blue-500"></div>
            <p className="text-sm text-[var(--text-muted)]">{t("loadingAccounts")}</p>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 text-xs text-[var(--text-muted)]">
          {t("noAccountsConnected")}
        </div>
      ) : (
        <div className="divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
          {accounts.map((account) => (
            <div key={account.id} className="group p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{account.provider}</span>
                    {currentUser && (
                      <OwnerBadge ownerUsername={account.ownerUsername} isOwn={account.isOwn} />
                    )}
                    <OAuthStatusBadge status={account.status} statusMessage={account.statusMessage} unavailable={account.unavailable} />
                  </div>
                  {account.accountEmail && (
                    <p className="truncate text-xs text-[var(--text-secondary)]">{account.accountEmail}</p>
                  )}
                  <p className="truncate text-xs font-mono text-[var(--text-muted)]">{account.accountName}</p>
                  {Array.isArray(account.quotaGroups) && account.quotaGroups.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-700"
                      onClick={() => toggleExpanded(account.id)}
                    >
                      {expandedAccounts[account.id] ? "Hide quota groups" : `Show quota groups (${account.quotaGroups.length})`}
                    </button>
                  )}
                </div>
                {currentUser && (account.isOwn || currentUser.isAdmin) && (
                  <div className="flex shrink-0 items-center gap-2">
                    {currentUser.isAdmin && !account.ownerUsername && (
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        disabled={claimingAccountName === account.accountName}
                        onClick={() => onClaim(account.accountName)}
                      >
                        {claimingAccountName === account.accountName ? "..." : t("claimButton")}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      disabled={togglingAccountId === account.id}
                      onClick={() => onToggle(account.id, account.status === "disabled")}
                    >
                      {togglingAccountId === account.id ? "..." : account.status === "disabled" ? t("enableButton") : t("disableButton")}
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => onDelete(account.id)}
                    >
                      {t("disconnectButton")}
                    </Button>
                  </div>
                )}
              </div>
              {expandedAccounts[account.id] && Array.isArray(account.quotaGroups) && account.quotaGroups.length > 0 && (
                <div className="mt-3 space-y-2 rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/20 p-3">
                  {account.quotaGroups.map((group) => {
                    const actionBase = `${account.id}:${group.groupId}`;
                    const isManual = group.manualSuspended;
                    const hasAuto = Boolean(group.autoSuspendedUntil);
                    return (
                      <div
                        key={`${account.id}:${group.groupId}`}
                        className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text-primary)]">{group.label}</span>
                              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                {group.effectiveStatus.replaceAll("_", " ")}
                              </span>
                            </div>
                            {group.manualReason && (
                              <p className="text-xs text-[var(--text-secondary)]">Manual: {group.manualReason}</p>
                            )}
                            {group.autoSuspendedUntil && (
                              <p className="text-xs text-[var(--text-secondary)]">
                                Cooldown until {new Date(group.autoSuspendedUntil).toLocaleString()}
                                {group.autoReason ? ` (${group.autoReason})` : ""}
                              </p>
                            )}
                            {group.sourceModel && (
                              <p className="truncate text-xs text-[var(--text-muted)]">Source model: {group.sourceModel}</p>
                            )}
                            {group.updatedAt && (
                              <p className="text-[11px] text-[var(--text-muted)]">
                                Updated {new Date(group.updatedAt).toLocaleString()}
                                {group.updatedBy ? ` by ${group.updatedBy}` : ""}
                              </p>
                            )}
                          </div>
                          {currentUser?.isAdmin && account.authId && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                disabled={quotaActionKey === `${actionBase}:manual-on` || isManual}
                                onClick={() => onForceSuspend(account.authId as string, group.groupId)}
                              >
                                {quotaActionKey === `${actionBase}:manual-on` ? "..." : "Force suspend"}
                              </Button>
                              <Button
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                disabled={quotaActionKey === `${actionBase}:manual-off` || !isManual}
                                onClick={() => onLiftManual(account.authId as string, group.groupId)}
                              >
                                {quotaActionKey === `${actionBase}:manual-off` ? "..." : "Lift manual"}
                              </Button>
                              <Button
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                disabled={quotaActionKey === `${actionBase}:auto-clear` || !hasAuto}
                                onClick={() => onClearCooldown(account.authId as string, group.groupId)}
                              >
                                {quotaActionKey === `${actionBase}:auto-clear` ? "..." : "Clear cooldown"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

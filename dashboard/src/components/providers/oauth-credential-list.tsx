"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { OwnerBadge, type CurrentUserLike } from "@/components/providers/api-key-section";

interface OAuthAccountWithOwnership {
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
  onToggle,
  onDelete,
  onClaim,
}: OAuthCredentialListProps) {
  const t = useTranslations("providers");

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
            </div>
          ))}
        </div>
      )}
    </>
  );
}

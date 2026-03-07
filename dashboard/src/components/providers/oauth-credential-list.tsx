"use client";

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
  onToggle: (accountId: string, currentlyDisabled: boolean) => void;
  onDelete: (accountId: string) => void;
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
  const message = parseStatusMessage(statusMessage);

  if (status === "active" && !unavailable) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400" title="Token is valid and working">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }

  if (status === "error" || unavailable) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400"
        title={message || "Account has an error"}
      >
        <span className="size-1.5 rounded-full bg-red-400" />
        {message
          ? message.length > 40 ? `${message.slice(0, 40)}…` : message
          : "Error"}
      </span>
    );
  }

  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-400" title="Account is disabled">
        <span className="size-1.5 rounded-full bg-slate-400" />
        Disabled
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
  onToggle,
  onDelete,
}: OAuthCredentialListProps) {
  return (
    <>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Connected Accounts</h3>
        <p className="mt-1 text-xs text-slate-500">Active OAuth provider connections</p>
      </div>
      {loading ? (
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
                    <OAuthStatusBadge status={account.status} statusMessage={account.statusMessage} unavailable={account.unavailable} />
                  </div>
                  {account.accountEmail && (
                    <p className="truncate text-xs text-slate-300">{account.accountEmail}</p>
                  )}
                  <p className="truncate text-xs font-mono text-slate-500">{account.accountName}</p>
                </div>
                {currentUser && (account.isOwn || currentUser.isAdmin) && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      disabled={togglingAccountId === account.id}
                      onClick={() => onToggle(account.id, account.status === "disabled")}
                    >
                      {togglingAccountId === account.id ? "..." : account.status === "disabled" ? "Enable" : "Disable"}
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => onDelete(account.id)}
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
    </>
  );
}

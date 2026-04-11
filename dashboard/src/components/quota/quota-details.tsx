"use client";

import { cn } from "@/lib/utils";

interface QuotaModel {
  id: string;
  displayName: string;
  remainingFraction?: number | null;
  resetTime: string | null;
}

interface QuotaGroup {
  id: string;
  label: string;
  remainingFraction?: number | null;
  resetTime: string | null;
  models: QuotaModel[];
}

interface QuotaAccount {
  auth_index: string;
  provider: string;
  email?: string | null;
  supported: boolean;
  error?: string;
  groups?: QuotaGroup[];
  raw?: unknown;
}

function normalizeFraction(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function maskEmail(email: unknown): string {
  if (typeof email !== "string") return "unknown";
  const trimmed = email.trim();
  if (trimmed === "") return "unknown";

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const maskedLocal = local.length <= 3 ? `${local}***` : `${local.slice(0, 3)}***`;
  return `${maskedLocal}@${domain}`;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Unknown";

  try {
    const resetDate = new Date(isoDate);
    if (Number.isNaN(resetDate.getTime())) return "Unknown";
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();

    if (diffMs <= 0) return "Resetting...";

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `Resets in ${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    }
    return `Resets in ${minutes}m`;
  } catch {
    return "Unknown";
  }
}

function isShortTermGroup(group: QuotaGroup): boolean {
  const id = group.id.toLowerCase();
  const label = group.label.toLowerCase();
  return (
    id.includes("five-hour") ||
    id.includes("primary") ||
    id.includes("request") ||
    id.includes("token") ||
    label.includes("5h") ||
    label.includes("5m") ||
    label.includes("request") ||
    label.includes("token")
  );
}

function calcAccountWindowScores(groups: QuotaGroup[]): Record<string, { score: number; label: string; isShortTerm: boolean }> {
  const result: Record<string, { score: number; label: string; isShortTerm: boolean }> = {};
  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    result[group.id] = {
      score,
      label: group.label,
      isShortTerm: isShortTermGroup(group),
    };
  }
  return result;
}

function getCapacityBarClass(value: number): string {
  if (value > 0.6) return "bg-emerald-500/100/80";
  if (value > 0.2) return "bg-amber-500/100";
  return "bg-rose-500/100/80";
}

interface QuotaDetailsProps {
  filteredAccounts: QuotaAccount[];
  expandedCards: Record<string, boolean>;
  onToggleCard: (accountId: string) => void;
  loading: boolean;
}

export function QuotaDetails({ filteredAccounts, expandedCards, onToggleCard, loading }: QuotaDetailsProps) {
  return (
    <section id="quota-accounts" className="scroll-mt-24 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Accounts</h2>
      <div className="overflow-x-auto rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
        <div className="min-w-[650px]">
        <div className="grid grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px] border-b border-[var(--surface-border)] bg-[var(--surface-base)]/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          <span></span>
          <span>Account</span>
          <span>Provider</span>
          <span>Status</span>
          <span>Long-Term</span>
          <span>Short-Term</span>
        </div>

        {filteredAccounts.map((account) => {
          const isRowExpanded = expandedCards[account.auth_index];
          const scores = account.groups ? Object.values(calcAccountWindowScores(account.groups)) : [];
          const longScores = scores.filter((s) => !s.isShortTerm);
          const shortScores = scores.filter((s) => s.isShortTerm);
          const longMin = longScores.length > 0 ? Math.min(...longScores.map((s) => s.score)) : null;
          const shortMin = shortScores.length > 0 ? Math.min(...shortScores.map((s) => s.score)) : null;
          const statusLabel = account.supported ? (account.error ? "Error" : "Active") : "Unsupported";

          return (
            <div key={account.auth_index} className="border-b border-[var(--surface-border)] last:border-b-0">
              <button
                type="button"
                onClick={() => onToggleCard(account.auth_index)}
                 className="grid w-full grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px] items-center px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
               >
                 <span className={cn("text-xs text-[var(--text-muted)] transition-transform", isRowExpanded && "rotate-180")}>⌄</span>
                 <span className="truncate text-xs text-[var(--text-primary)]">{maskEmail(account.email)}</span>
                 <span className="truncate text-xs capitalize text-[var(--text-secondary)]">{account.provider}</span>
                <span className={cn("text-xs", account.error ? "text-rose-600" : account.supported ? "text-emerald-700" : "text-amber-700")}>{statusLabel}</span>
                <span className="block pr-3">
                  {longMin !== null ? (
                    <>
                      <span className="text-xs text-[var(--text-secondary)]">{Math.round(longMin * 100)}%</span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <span className={cn("block h-full", getCapacityBarClass(longMin))} style={{ width: `${Math.round(longMin * 100)}%` }} />
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </span>
                <span className="block pr-3">
                  {shortMin !== null ? (
                    <>
                      <span className="text-xs text-[var(--text-secondary)]">{Math.round(shortMin * 100)}%</span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <span className={cn("block h-full", getCapacityBarClass(shortMin))} style={{ width: `${Math.round(shortMin * 100)}%` }} />
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </span>
               </button>

                {isRowExpanded && (
                  <div className="border-t border-[var(--surface-border)] bg-[var(--surface-base)] px-4 py-3">
                    {account.error && (
                      <p className="mb-2 break-all text-xs text-rose-600">{account.error}</p>
                    )}
                    {!account.supported && !account.error && (
                      <p className="mb-2 text-xs text-amber-700">Quota monitoring not available for this provider.</p>
                    )}

                    {account.groups && account.groups.length > 0 && (
                      <div className="overflow-x-auto rounded-sm border border-[var(--surface-border)]">
                        <div className="min-w-[400px]">
                        {account.groups.map((group) => {
                          const fraction = normalizeFraction(group.remainingFraction);
                          const pct = fraction === null ? null : Math.round(fraction * 100);
                          return (
                            <div key={group.id} className="grid grid-cols-[minmax(0,1fr)_80px_160px] items-center border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 last:border-b-0">
                              <span className="truncate text-xs text-[var(--text-primary)]">{group.label}</span>
                              <span className="text-xs text-[var(--text-secondary)]">{pct === null ? "-" : `${pct}%`}</span>
                              <span className="truncate text-xs text-[var(--text-muted)]">{formatRelativeTime(group.resetTime)}</span>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
             </div>
           );
          })}
        </div>
        </div>

      {filteredAccounts.length === 0 && !loading && (
        <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">
          No accounts found for the selected filter.
        </div>
      )}
    </section>
  );
}

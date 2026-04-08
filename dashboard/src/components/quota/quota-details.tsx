"use client";

import { cn } from "@/lib/utils";
import { isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import {
  enrichModelFirstGroup,
  isModelFirstAccount,
  isModelFirstAccountQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstAccount,
  type QuotaAccount,
  type QuotaGroup,
} from "@/lib/model-first-monitoring";

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

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "Unknown";

  const resetDate = new Date(isoDate);
  if (Number.isNaN(resetDate.getTime())) return "Unknown";
  const diffMs = resetDate.getTime() - Date.now();

  if (diffMs <= 0) return "Resetting...";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `Resets in ${days}d ${hours}h`;
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${minutes}m`;
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
      isShortTerm: isShortTermQuotaWindow(group, groups),
    };
  }
  return result;
}

function getCapacityBarClass(value: number): string {
  if (value > 0.6) return "bg-emerald-500/80";
  if (value > 0.2) return "bg-amber-500";
  return "bg-rose-500/80";
}

interface QuotaDetailsProps {
  filteredAccounts: QuotaAccount[];
  expandedCards: Record<string, boolean>;
  onToggleCard: (accountId: string) => void;
  loading: boolean;
  modelFirstOnlyView: boolean;
}

export function QuotaDetails({
  filteredAccounts,
  expandedCards,
  onToggleCard,
  loading,
  modelFirstOnlyView,
}: QuotaDetailsProps) {
  const sections = (() => {
    if (filteredAccounts.length === 0) {
      return [];
    }

    const hasModelFirstAccounts = filteredAccounts.some((account) => isModelFirstAccount(account));
    const hasWindowAccounts = filteredAccounts.some((account) => !isModelFirstAccount(account));

    if (!hasModelFirstAccounts || !hasWindowAccounts) {
      return [
        {
          key: "all",
          title: null as string | null,
          accounts: filteredAccounts,
          modelFirstView: modelFirstOnlyView || hasModelFirstAccounts,
        },
      ];
    }

    const buckets = new Map<string, { key: string; title: string; accounts: QuotaAccount[]; modelFirstView: boolean }>();
    for (const account of filteredAccounts) {
      const sectionModelFirstView = isModelFirstAccount(account);
      const providerTitle =
        account.provider === "github-copilot"
          ? "Copilot"
          : account.provider.charAt(0).toUpperCase() + account.provider.slice(1);
      const key = `${sectionModelFirstView ? "model-first" : "window-based"}:${account.provider}`;
      const bucket = buckets.get(key) ?? {
        key,
        title: providerTitle,
        accounts: [],
        modelFirstView: sectionModelFirstView,
      };
      bucket.accounts.push(account);
      buckets.set(key, bucket);
    }

    return Array.from(buckets.values()).sort((left, right) => {
      if (left.modelFirstView !== right.modelFirstView) {
        return left.modelFirstView ? -1 : 1;
      }
      return left.title.localeCompare(right.title);
    });
  })();

  return (
    <section id="quota-accounts" className="scroll-mt-24 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Accounts</h2>
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.key} className="space-y-1">
            {section.title && sections.length > 1 && (
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{section.title}</h3>
            )}
            <div className="overflow-x-auto rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
              <div className="min-w-[650px]">
                <div
                  className={cn(
                    "border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]",
                    section.modelFirstView
                      ? "grid grid-cols-[24px_minmax(0,1fr)_110px_110px_120px_120px]"
                      : "grid grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px]"
                  )}
                >
                  <span></span>
                  <span>Account</span>
                  <span>Provider</span>
                  <span>Status</span>
                  <span>{section.modelFirstView ? "Ready" : "Long-Term"}</span>
                  <span>{section.modelFirstView ? "Recovery" : "Short-Term"}</span>
                </div>

                {section.accounts.map((account) => {
                  const isRowExpanded = expandedCards[account.auth_index];
                  const scores = account.groups ? Object.values(calcAccountWindowScores(account.groups)) : [];
                  const longScores = scores.filter((score) => !score.isShortTerm);
                  const shortScores = scores.filter((score) => score.isShortTerm);
                  const longMin = longScores.length > 0 ? Math.min(...longScores.map((score) => score.score)) : null;
                  const shortMin = shortScores.length > 0 ? Math.min(...shortScores.map((score) => score.score)) : null;
                  const statusLabel = account.supported ? (account.error ? "Error" : "Active") : "Unsupported";
                  const accountSummary = isModelFirstAccount(account) ? summarizeModelFirstAccount(account) : null;
                  const accountQuotaUnverified =
                    isModelFirstAccount(account) && accountSummary
                      ? isModelFirstAccountQuotaUnverified(account, accountSummary)
                      : false;
                  const modelFirstStatus = account.error
                    ? "Error"
                    : !account.supported
                      ? "Unsupported"
                      : accountSummary?.staleSnapshot
                        ? "Stale"
                        : accountQuotaUnverified
                          ? "Snapshot"
                          : "Ready";

                  return (
                    <div key={account.auth_index} className="border-b border-[var(--surface-border)] last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onToggleCard(account.auth_index)}
                        className={cn(
                          "w-full items-center px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]",
                          section.modelFirstView
                            ? "grid grid-cols-[24px_minmax(0,1fr)_110px_110px_120px_120px]"
                            : "grid grid-cols-[24px_minmax(0,1fr)_120px_120px_140px_140px]"
                        )}
                      >
                        <span className={cn("text-xs text-[var(--text-muted)] transition-transform", isRowExpanded && "rotate-180")}>v</span>
                        <span className="truncate text-xs text-[var(--text-primary)]">{maskEmail(account.email)}</span>
                        <span className="truncate text-xs capitalize text-[var(--text-secondary)]">{account.provider}</span>
                        <span
                          className={cn(
                            "text-xs",
                            section.modelFirstView
                              ? account.error
                                ? "text-rose-600"
                                : accountSummary?.staleSnapshot || accountQuotaUnverified
                                  ? "text-amber-700"
                                  : account.supported
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                              : account.error
                                ? "text-rose-600"
                                : account.supported
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                          )}
                        >
                          {section.modelFirstView ? modelFirstStatus : statusLabel}
                        </span>
                        {section.modelFirstView ? (
                          <>
                            <span className="text-xs text-[var(--text-secondary)]">
                              {accountSummary
                                ? accountQuotaUnverified
                                  ? "snapshot full"
                                  : `${accountSummary.readyGroups}/${accountSummary.totalGroups}`
                                : "-"}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {accountSummary ? formatRelativeTime(accountSummary.nextRecoveryAt ?? accountSummary.nextWindowResetAt) : "-"}
                            </span>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </button>

                      {isRowExpanded && (
                        <div className="border-t border-[var(--surface-border)] bg-[var(--surface-base)] px-4 py-3">
                          {account.error && <p className="mb-2 break-all text-xs text-rose-600">{account.error}</p>}
                          {!account.supported && !account.error && (
                            <p className="mb-2 text-xs text-amber-700">Quota monitoring not available for this provider.</p>
                          )}
                          {section.modelFirstView && accountSummary && (
                            <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
                              <span>Snapshot: {accountSummary.staleSnapshot ? "stale" : "fresh"}</span>
                              <span>Confidence: {accountQuotaUnverified ? "snapshot only" : "grouped ready"}</span>
                              <span>Ready groups: {accountSummary.readyGroups}</span>
                            </div>
                          )}

                          {account.groups && account.groups.length > 0 && (
                            <div className="overflow-x-auto rounded-sm border border-[var(--surface-border)]">
                              {section.modelFirstView ? (
                                <div className="min-w-[900px]">
                                  <div className="grid grid-cols-[minmax(0,1fr)_90px_110px_140px_140px_140px_160px] border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                    <span>Group</span>
                                    <span>Ready</span>
                                    <span>Min / P50</span>
                                    <span>Next Reset</span>
                                    <span>Full Reset</span>
                                    <span>Recovery</span>
                                    <span>Bottleneck</span>
                                  </div>
                                  {account.groups.map((group) => {
                                    const enrichedGroup = group.monitorMode === "model-first" ? group : enrichModelFirstGroup(group);
                                    const minPct = normalizeFraction(enrichedGroup.minRemainingFraction ?? enrichedGroup.remainingFraction);
                                    const p50Pct = normalizeFraction(enrichedGroup.p50RemainingFraction);
                                    return (
                                      <div
                                        key={group.id}
                                        className="grid grid-cols-[minmax(0,1fr)_90px_110px_140px_140px_140px_160px] items-center border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 last:border-b-0"
                                      >
                                        <span className="truncate text-xs text-[var(--text-primary)]">{enrichedGroup.label}</span>
                                        <span className="text-xs text-[var(--text-secondary)]">
                                          {`${enrichedGroup.effectiveReadyModelCount ?? enrichedGroup.readyModelCount ?? 0}/${enrichedGroup.totalModelCount ?? enrichedGroup.models.length}`}
                                        </span>
                                        <span className="text-xs text-[var(--text-secondary)]">
                                          {minPct === null ? "-" : `${Math.round(minPct * 100)}%`}
                                          {p50Pct === null ? "" : ` / ${Math.round(p50Pct * 100)}%`}
                                        </span>
                                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(enrichedGroup.nextWindowResetAt ?? enrichedGroup.resetTime)}</span>
                                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(enrichedGroup.fullWindowResetAt ?? enrichedGroup.resetTime)}</span>
                                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(enrichedGroup.nextRecoveryAt)}</span>
                                        <span className="truncate text-xs text-[var(--text-muted)]">{enrichedGroup.bottleneckModel ?? "-"}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="min-w-[400px]">
                                  {account.groups.map((group) => {
                                    const fraction = normalizeFraction(group.remainingFraction);
                                    const pct = fraction === null ? null : Math.round(fraction * 100);
                                    return (
                                      <div
                                        key={group.id}
                                        className="grid grid-cols-[minmax(0,1fr)_80px_160px] items-center border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 last:border-b-0"
                                      >
                                        <span className="truncate text-xs text-[var(--text-primary)]">{group.label}</span>
                                        <span className="text-xs text-[var(--text-secondary)]">{pct === null ? "-" : `${pct}%`}</span>
                                        <span className="truncate text-xs text-[var(--text-muted)]">{formatRelativeTime(group.resetTime)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAccounts.length === 0 && !loading && (
        <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">
          No accounts found for the selected filter.
        </div>
      )}
    </section>
  );
}

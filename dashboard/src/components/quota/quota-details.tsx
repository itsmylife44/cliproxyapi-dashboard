"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { AccountQuotaHistory, prefetchAccountQuotaHistory } from "@/components/quota/account-quota-history";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { capacityQuotaGroups, isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import { headlineQuotaWindows } from "@/lib/quota/headline";
import { canonicalizeQuotaProvider } from "@/lib/quota/query-state";
import { maskEmail } from "@/lib/mask-email";
import type { AutoResetCreditSummary, AutoResetRule } from "@/lib/quota/auto-reset-rules";
import {
  enrichModelFirstGroup,
  isModelFirstAccount,
  isModelFirstAccountQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstAccount,
  type QuotaAccount,
  type QuotaGroup,
} from "@/lib/model-first-monitoring";

function calcAccountWindowScores(groups: QuotaGroup[]): Record<string, { score: number; label: string; isShortTerm: boolean }> {
  const result: Record<string, { score: number; label: string; isShortTerm: boolean }> = {};
  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    // A provider-reported critical limit is exhausted even if the reported
    // utilization alone would still leave headroom.
    const score = group.severity === "critical" ? 0 : normalizeFraction(group.remainingFraction);
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


function isResettableProvider(provider: string): boolean {
  const canonical = canonicalizeQuotaProvider(provider);
  return canonical === "codex" || canonical === "claude";
}

interface QuotaDetailsProps {
  filteredAccounts: QuotaAccount[];
  hasAnyAccounts: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  expandedCards: Record<string, boolean>;
  onToggleCard: (accountId: string) => void;
  loading: boolean;
  modelFirstOnlyView: boolean;
  refreshKey?: string;
  headerRight?: ReactNode;
  autoResetRules?: Record<string, AutoResetRule>;
  autoResetCredits?: Record<string, AutoResetCreditSummary>;
  autoResetBusy?: Record<string, boolean>;
  onUpdateAutoReset?: (authIndex: string, patch: { enabled: boolean; fiveHourThresholdPct: number; weeklyThresholdPct: number }) => void;
  onCheckResetCredits?: (authIndex: string, provider: string) => void;
  onManualReset?: (authIndex: string, provider: string) => void;
}

export function QuotaDetails({
  filteredAccounts,
  hasAnyAccounts,
  currentPage,
  totalPages,
  onPageChange,
  expandedCards,
  onToggleCard,
  loading,
  modelFirstOnlyView,
  refreshKey,
  headerRight,
  autoResetRules,
  autoResetCredits,
  autoResetBusy,
  onUpdateAutoReset,
  onCheckResetCredits,
  onManualReset,
}: QuotaDetailsProps) {
  const t = useTranslations("quota");

  const maskedAccountCounts = new Map<string, number>();
  for (const account of filteredAccounts) {
    const masked = maskEmail(account.email, t("unknown"));
    maskedAccountCounts.set(masked, (maskedAccountCounts.get(masked) ?? 0) + 1);
  }
  const maskedAccountOccurrences = new Map<string, number>();
  const accountLabels = new Map<string, string>();
  for (const account of filteredAccounts) {
    const masked = maskEmail(account.email, t("unknown"));
    const occurrence = (maskedAccountOccurrences.get(masked) ?? 0) + 1;
    maskedAccountOccurrences.set(masked, occurrence);
    accountLabels.set(
      account.auth_index,
      maskedAccountCounts.get(masked)! > 1 ? t("accountOccurrenceLabel", { account: masked, number: occurrence }) : masked
    );
  }

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
      // Key on the canonical provider so aliased raw values (e.g. `gemini` and
      // `gemini-cli`) land in the same section, matching the toolbar filter.
      const canonicalProvider = canonicalizeQuotaProvider(account.provider) ?? account.provider;
      const providerTitle =
        canonicalProvider === "github-copilot"
          ? "Copilot"
          : canonicalProvider.charAt(0).toUpperCase() + canonicalProvider.slice(1);
      const key = `${sectionModelFirstView ? "model-first" : "window-based"}:${canonicalProvider}`;
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
    <section id="quota-accounts" className="scroll-mt-24 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("accountsTitle")}</h2>
        {headerRight}
      </div>
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
                      : "grid grid-cols-[24px_minmax(0,1fr)_100px_90px_120px_120px_104px]"
                  )}
                >
                  <span></span>
                  <span>{t("accountColumn")}</span>
                  <span>{t("providerColumn")}</span>
                  <span>{t("statusColumn")}</span>
                  <span>{section.modelFirstView ? t("readyColumnLabel") : t("longTermLabel")}</span>
                  <span>{section.modelFirstView ? t("recoveryColumnLabel") : t("shortTermLabel")}</span>
                  {!section.modelFirstView && <span className="text-right">{t("autoResetColumn")}</span>}
                </div>

                {section.accounts.map((account) => {
                  const isRowExpanded = expandedCards[account.auth_index];
                  const scores = account.groups
                    ? Object.values(calcAccountWindowScores(headlineQuotaWindows(capacityQuotaGroups(account.provider, account.groups))))
                    : [];
                  const longScores = scores.filter((score) => !score.isShortTerm);
                  const shortScores = scores.filter((score) => score.isShortTerm);
                  const longMin = longScores.length > 0 ? Math.min(...longScores.map((score) => score.score)) : null;
                  const shortMin = shortScores.length > 0 ? Math.min(...shortScores.map((score) => score.score)) : null;
                  const statusLabel = account.supported ? (account.error ? t("errorStatus") : t("activeStatus")) : t("unsupportedStatus");
                  const accountSummary = isModelFirstAccount(account) ? summarizeModelFirstAccount(account) : null;
                  const accountQuotaUnverified =
                    isModelFirstAccount(account) && accountSummary
                      ? isModelFirstAccountQuotaUnverified(account, accountSummary)
                      : false;
                  const modelFirstStatus = account.error
                    ? t("errorStatus")
                    : !account.supported
                      ? t("unsupportedStatus")
                      : accountSummary?.staleSnapshot
                        ? t("staleStatus")
                        : accountQuotaUnverified
                          ? t("snapshotStatus")
                          : t("readyStatus");

                  const resetSupported = !section.modelFirstView && isResettableProvider(account.provider);
                  const rule = autoResetRules?.[account.auth_index] ?? {
                    enabled: false,
                    fiveHourThresholdPct: 0,
                    weeklyThresholdPct: 0,
                  };
                  const creditSummary = autoResetCredits?.[account.auth_index];
                  const isBusy = autoResetBusy?.[account.auth_index] === true;

                  return (
                    <div key={account.auth_index} className="border-b border-[var(--surface-border)] last:border-b-0">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onMouseEnter={() => {
                            if (account.supported && !account.error) {
                              void prefetchAccountQuotaHistory(account.auth_index);
                            }
                          }}
                          onFocus={() => {
                            if (account.supported && !account.error) {
                              void prefetchAccountQuotaHistory(account.auth_index);
                            }
                          }}
                          onClick={() => onToggleCard(account.auth_index)}
                          className={cn(
                            "flex-1 items-center px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]",
                            section.modelFirstView
                              ? "grid grid-cols-[24px_minmax(0,1fr)_110px_110px_120px_120px]"
                              : "grid grid-cols-[24px_minmax(0,1fr)_100px_90px_120px_120px]"
                          )}
                        >
                          <span className={cn("text-xs text-[var(--text-muted)] transition-transform", isRowExpanded && "rotate-180")}>⌄</span>
                          <span className="truncate text-xs text-[var(--text-primary)]">{accountLabels.get(account.auth_index)}</span>
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
                                    ? t("snapshotFullLabel")
                                    : `${accountSummary.readyGroups}/${accountSummary.totalGroups}`
                                  : "-"}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {accountSummary ? formatRelativeTime(accountSummary.nextRecoveryAt ?? accountSummary.nextWindowResetAt, t) : "-"}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="block pr-3">
                                {longMin !== null ? (
                                  <>
                                    <span className="text-xs tabular-nums text-[var(--text-secondary)]">{Math.round(longMin * 100)}%</span>
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
                                    <span className="text-xs tabular-nums text-[var(--text-secondary)]">{Math.round(shortMin * 100)}%</span>
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

                        {!section.modelFirstView && (
                          <div className="flex w-[104px] shrink-0 items-center justify-end px-3 py-2">
                            {resetSupported && onUpdateAutoReset ? (
                              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <input
                                  type="checkbox"
                                  checked={rule.enabled}
                                  disabled={isBusy}
                                  onChange={(e) =>
                                    onUpdateAutoReset(account.auth_index, {
                                      enabled: e.target.checked,
                                      fiveHourThresholdPct: rule.fiveHourThresholdPct,
                                      weeklyThresholdPct: rule.weeklyThresholdPct,
                                    })
                                  }
                                  className="h-3.5 w-3.5 rounded border-[var(--surface-border)] accent-[var(--accent)]"
                                />
                                <span>{t("autoResetToggle")}</span>
                              </label>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">-</span>
                            )}
                          </div>
                        )}
                      </div>

                      {resetSupported && rule.enabled && onUpdateAutoReset && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--surface-border)] bg-[var(--surface-muted)]/30 px-4 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
                            <span className="font-medium text-[var(--text-primary)]">{t("autoResetWhenLabel")}</span>
                            <label className="inline-flex items-center gap-1">
                              <span>{t("autoReset5hLabel")}</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={rule.fiveHourThresholdPct}
                                onChange={(e) =>
                                  onUpdateAutoReset(account.auth_index, {
                                    enabled: true,
                                    fiveHourThresholdPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                    weeklyThresholdPct: rule.weeklyThresholdPct,
                                  })
                                }
                                className="glass-input w-14 rounded px-1.5 py-0.5 text-center text-xs tabular-nums"
                              />
                              <span>%</span>
                            </label>
                            <span className="text-[var(--text-muted)]">&amp;</span>
                            <label className="inline-flex items-center gap-1">
                              <span>{t("autoResetWeeklyLabel")}</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={rule.weeklyThresholdPct}
                                onChange={(e) =>
                                  onUpdateAutoReset(account.auth_index, {
                                    enabled: true,
                                    fiveHourThresholdPct: rule.fiveHourThresholdPct,
                                    weeklyThresholdPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                  })
                                }
                                className="glass-input w-14 rounded px-1.5 py-0.5 text-center text-xs tabular-nums"
                              />
                              <span>%</span>
                            </label>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {creditSummary && (
                              <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--text-secondary)]">
                                {creditSummary.error
                                  ? creditSummary.error
                                  : t("autoResetCreditsCount", { count: creditSummary.availableCount ?? 0 })}
                              </span>
                            )}
                            {rule.lastStatus && (
                              <span className="text-[11px] text-[var(--text-muted)]">
                                {t("autoResetLastStatus", { status: rule.lastStatus })}
                              </span>
                            )}
                            {onCheckResetCredits && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onCheckResetCredits(account.auth_index, account.provider)}
                                className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                              >
                                {t("autoResetCheckButton")}
                              </button>
                            )}
                            {onManualReset && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onManualReset(account.auth_index, account.provider)}
                                className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-400"
                              >
                                {isBusy ? t("resettingStatus") : t("autoResetNowButton")}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {isRowExpanded && (
                        <div className="border-t border-[var(--surface-border)] bg-[var(--surface-base)] px-4 py-3">
                          {account.error && <p className="mb-2 break-all text-xs text-rose-600">{account.error}</p>}
                          {!account.supported && !account.error && (
                            <p className="mb-2 text-xs text-amber-700">{t("quotaNotAvailable")}</p>
                          )}
                          {section.modelFirstView && accountSummary && (
                            <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
                              <span>{t("snapshotStatusLabel")}: {accountSummary.staleSnapshot ? t("staleLabel") : t("freshLabel")}</span>
                              <span>{t("confidenceLabel")}: {accountQuotaUnverified ? t("snapshotOnlyLabel") : t("groupedReadyLabel")}</span>
                              <span>{t("readyGroupsLabel")}: {accountSummary.readyGroups}</span>
                            </div>
                          )}

                          {section.modelFirstView && account.groups && account.groups.length > 0 && (
                            <div className="overflow-x-auto rounded-sm border border-[var(--surface-border)]">
                                <div className="min-w-[900px]">
                                  <div className="grid grid-cols-[minmax(0,1fr)_90px_110px_140px_140px_140px_160px] border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                    <span>{t("groupColumnLabel")}</span>
                                    <span>{t("readyColumnLabel")}</span>
                                    <span>{t("minP50ColumnLabel")}</span>
                                    <span>{t("nextResetColumnLabel")}</span>
                                    <span>{t("fullResetColumnLabel")}</span>
                                    <span>{t("recoveryColumnLabel")}</span>
                                    <span>{t("bottleneckColumnLabel")}</span>
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
                                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(enrichedGroup.nextWindowResetAt ?? enrichedGroup.resetTime, t)}</span>
                                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(enrichedGroup.fullWindowResetAt ?? enrichedGroup.resetTime, t)}</span>
                                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(enrichedGroup.nextRecoveryAt, t)}</span>
                                        <span className="truncate text-xs text-[var(--text-muted)]">{enrichedGroup.bottleneckModel ?? "-"}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                            </div>
                          )}
                          <AccountQuotaHistory authIndex={account.auth_index} groups={section.modelFirstView ? undefined : account.groups} refreshKey={refreshKey} />
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
          {hasAnyAccounts ? t("noAccountsFound") : t("noAccountsAvailable")}
        </div>
      )}

      {totalPages > 1 && filteredAccounts.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            {t("pageOf", { page: currentPage, total: totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-1 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("previous")}
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-1 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

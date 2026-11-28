"use client";

import { Fragment, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AccountQuotaHistory, prefetchAccountQuotaHistory } from "@/components/quota/account-quota-history";
import { QuotaCapacity } from "@/components/quota/quota-capacity";
import { formatRelativeTime, parseRelativeTime } from "@/lib/format-relative-time";
import { isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import { headlineQuotaWindows } from "@/lib/quota/headline";
import { canonicalizeQuotaProvider } from "@/lib/quota/query-state";
import { maskEmail } from "@/lib/mask-email";
import { isAutoResetSupportedProvider, normalizeAutoResetRule, type AutoResetCreditSummary, type AutoResetRule } from "@/lib/quota/auto-reset-rules";
import {
  enrichModelFirstGroup,
  isModelFirstAccount,
  isModelFirstAccountQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstAccount,
  type QuotaAccount,
  type QuotaGroup,
} from "@/lib/model-first-monitoring";

type QuotaTranslations = ReturnType<typeof useTranslations<"quota">>;
type CapacityWindow = { group: QuotaGroup; percent: number };
const DEFAULT_RESET_RULE = normalizeAutoResetRule(null);
const RESET_RULE_FIELDS = [
  { key: "fiveHourThresholdPct", label: "autoReset5hLabel", max: 100, unit: "%" },
  { key: "weeklyThresholdPct", label: "autoResetWeeklyLabel", max: 100, unit: "%" },
  { key: "minWeeklyDaysLeft", label: "autoResetDaysLeftLabel", max: 7, unit: "d" },
] as const;
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = 3600;
const WEEK_DAYS = 7;

function getCapacityWindows(account: QuotaAccount) {
  const groups = headlineQuotaWindows(account.groups ?? []);
  const windows: Record<"long" | "short", CapacityWindow | null> = { long: null, short: null };
  for (const group of groups) {
    const remaining = normalizeFraction(group.remainingFraction);
    if (remaining === null) continue;
    const term = isShortTermQuotaWindow(group) ? "short" : "long";
    const current = windows[term];
    if (!current || remaining < current.group.remainingFraction!) {
      windows[term] = { group, percent: Math.round(remaining * 100) };
    }
  }
  return windows;
}

function capacityProps(window: CapacityWindow, t: QuotaTranslations, format: ReturnType<typeof useFormatter>) {
  const { resetTime } = window.group;
  const parsed = parseRelativeTime(resetTime);
  if (!resetTime || parsed.type === "unknown") return { percent: window.percent };
  const date = new Date(resetTime);
  const { days = 0, hours = 0, minutes = 0 } = parsed;
  const isResetting = parsed.type === "resetting";
  const relative = isResetting ? t("resettingStatus") : formatCountdown(days, hours, minutes, t);
  return {
    percent: window.percent,
    resetLabel: isResetting ? relative : `${relative} · ${format.dateTime(date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
    resetTitle: format.dateTime(date, { dateStyle: "medium", timeStyle: "long" }),
    isResetting,
  };
}

function formatCountdown(days: number, hours: number, minutes: number, t: QuotaTranslations) {
  if (days > 0) return t("relativeTimeDaysHours", { days, hours });
  if (hours > 0) return t("relativeTimeHoursMinutes", { hours, minutes });
  return t("relativeTimeMinutes", { minutes });
}

function getAvailableCredits(credits?: AutoResetCreditSummary) {
  return credits?.error ? null : credits?.availableCount ?? null;
}

interface ResetWindowPreview {
  currentPct: number;
  resetsIn: string;
  resetDuration: string;
  daysLeft: number | null;
}

interface PendingManualReset {
  authIndex: string;
  label: string;
  longWindow: ResetWindowPreview | null;
  shortWindow: ResetWindowPreview | null;
}

interface ResetAdvice {
  tone: "good" | "borderline" | "bad";
  badge: string;
  summary: string;
}

function calcDaysLeft(isoDate: string | null | undefined): number | null {
  const ms = isoDate ? Date.parse(isoDate) : NaN;
  return Number.isFinite(ms) ? Math.max(0, (ms - Date.now()) / (HOURS_PER_DAY * SECONDS_PER_HOUR * 1000)) : null;
}

function buildManualResetPreview(
  authIndex: string,
  label: string,
  windows: ReturnType<typeof getCapacityWindows>,
  t: QuotaTranslations
): PendingManualReset {
  const toPreview = (window: CapacityWindow | null): ResetWindowPreview | null => {
    if (!window) return null;
    const { resetTime, windowSeconds } = window.group;
    const hours = windowSeconds ? Math.round(windowSeconds / SECONDS_PER_HOUR) : null;
    return {
      currentPct: window.percent,
      resetsIn: formatRelativeTime(resetTime, t),
      resetDuration: hours === null ? t("unknown") : formatCountdown(Math.floor(hours / HOURS_PER_DAY), hours % HOURS_PER_DAY, 0, t),
      daysLeft: calcDaysLeft(resetTime),
    };
  };
  return { authIndex, label, longWindow: toPreview(windows.long), shortWindow: toPreview(windows.short) };
}

function evaluateResetAdvice(
  preview: PendingManualReset,
  creditSummary: AutoResetCreditSummary | undefined,
  t: QuotaTranslations
): ResetAdvice {
  if (getAvailableCredits(creditSummary) === 0) {
    return { tone: "bad", badge: t("resetVerdictNoCreditsBadge"), summary: t("resetVerdictNoCreditsTitle") };
  }

  const longPct = preview.longWindow?.currentPct ?? 100;
  const shortPct = preview.shortWindow?.currentPct ?? 100;
  const resetFraction = Math.min(1, (preview.longWindow?.daysLeft ?? WEEK_DAYS) / WEEK_DAYS);
  const timeFactor = 1 - (1 - resetFraction) ** 3;
  const quotaFactor = (1 - longPct / 100) + 0.2 * (longPct / 100) * (1 - shortPct / 100);
  const score = timeFactor * quotaFactor;
  const verdict = score >= 0.7 ? "Good" : score >= 0.4 ? "Borderline" : "Bad";
  return {
    tone: verdict === "Good" ? "good" : verdict === "Borderline" ? "borderline" : "bad",
    badge: t(`resetVerdict${verdict}Badge`),
    summary: t("resetVerdictReasonSummary", { gain: 100 - longPct, resetsIn: preview.longWindow?.resetsIn ?? t("unknown") }),
  };
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
  autoResetRules?: Record<string, AutoResetRule>;
  autoResetCredits?: Record<string, AutoResetCreditSummary>;
  autoResetBusy?: Record<string, "checking" | "resetting" | null>;
  onUpdateAutoReset?: (
    authIndex: string,
    patch: Pick<AutoResetRule, "enabled" | "prime" | "fiveHourThresholdPct" | "weeklyThresholdPct" | "minWeeklyDaysLeft">
  ) => void;
  onCheckResetCredits?: (authIndex: string) => void;
  onManualReset?: (authIndex: string) => void;
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
  autoResetRules,
  autoResetCredits,
  autoResetBusy,
  onUpdateAutoReset,
  onCheckResetCredits,
  onManualReset,
}: QuotaDetailsProps) {
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const t = useTranslations("quota");
  const [pendingManualReset, setPendingManualReset] = useState<PendingManualReset | null>(null);

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
      const canonicalProvider = canonicalizeQuotaProvider(account.provider) ?? account.provider;
      const providerTitle = canonicalProvider.charAt(0).toUpperCase() + canonicalProvider.slice(1);
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
    <section id="quota-accounts" aria-labelledby="quota-accounts-title" className="scroll-mt-24 space-y-3">
      <h2 id="quota-accounts-title" className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{t("accountsTitle")}</h2>
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.key} className="space-y-2">
            {section.title && sections.length > 1 && (
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">{section.title}</h3>
            )}
            <div className="divide-y divide-[var(--surface-border)] rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
                {section.accounts.map((account) => {
                  const canExpand = account.supported;
                  const isRowExpanded = canExpand && expandedCards[account.auth_index];
                  const windows = canExpand && !account.error && !section.modelFirstView ? getCapacityWindows(account) : null;
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

                  const statusColorClass = account.error
                    ? "text-rose-700 dark:text-rose-400"
                    : !account.supported || accountSummary?.staleSnapshot || accountQuotaUnverified
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-[var(--text-secondary)]";
                  const displayStatus = section.modelFirstView ? modelFirstStatus : statusLabel;

                  const resetSupported = !section.modelFirstView && isAutoResetSupportedProvider(account.provider);
                  const rule = autoResetRules?.[account.auth_index] ?? DEFAULT_RESET_RULE;
                  const creditSummary = autoResetCredits?.[account.auth_index];
                  const busyAction = autoResetBusy?.[account.auth_index] ?? null;
                  const isCheckingCredits = busyAction === "checking";
                  const isResettingNow = busyAction === "resetting";
                  const isBusy = busyAction !== null;
                  const availableCredits = getAvailableCredits(creditSummary);
                  const prefetchHistory = canExpand && !account.error
                    ? () => void prefetchAccountQuotaHistory(account.auth_index)
                    : undefined;

                  return (
                    <div key={account.auth_index}>
                      <button
                        type="button"
                        disabled={!canExpand}
                        onMouseEnter={prefetchHistory}
                        onFocus={prefetchHistory}
                        aria-expanded={canExpand ? Boolean(isRowExpanded) : undefined}
                        aria-labelledby={canExpand ? `quota-account-${account.auth_index} quota-toggle-${account.auth_index}` : `quota-account-${account.auth_index}`}
                        onClick={() => {
                          onToggleCard(account.auth_index);
                          if (!isRowExpanded && resetSupported && !isBusy && !creditSummary) {
                            onCheckResetCredits?.(account.auth_index);
                          }
                        }}
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:gap-x-6",
                          canExpand && "cursor-pointer hover:bg-[var(--surface-hover)]",
                          isRowExpanded && "rounded-b-none bg-[var(--surface-muted)]"
                        )}
                      >
                        <span className="min-w-0">
                          <span id={`quota-account-${account.auth_index}`} className="block break-words text-sm font-semibold text-[var(--text-primary)]">
                            {accountLabels.get(account.auth_index)}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
                            {!section.title && (
                              <span className="capitalize text-[var(--text-muted)]">{account.provider}</span>
                            )}
                            <span className={cn("inline-flex items-center gap-1 before:size-1.5 before:rounded-full before:bg-current", statusColorClass)}>{displayStatus}</span>
                          </span>
                        </span>
                        {canExpand && !account.error && (section.modelFirstView || windows?.long || windows?.short) && (
                          <span className="col-span-2 row-start-2 grid min-w-0 auto-cols-fr grid-flow-col items-start gap-3 sm:col-span-1 sm:col-start-2 sm:row-start-1 lg:gap-5">
                            {section.modelFirstView ? (
                              <>
                                <span className="grid min-w-0 gap-0.5">
                                  <span className="text-xs text-[var(--text-muted)]">{t("readyColumnLabel")}</span>
                                  <span className="font-mono text-sm text-[var(--text-primary)]">
                                    {accountSummary ? accountQuotaUnverified ? t("snapshotFullLabel") : `${accountSummary.readyGroups}/${accountSummary.totalGroups}` : "—"}
                                  </span>
                                </span>
                                <span className="grid min-w-0 gap-0.5">
                                  <span className="text-xs text-[var(--text-muted)]">{t("recoveryColumnLabel")}</span>
                                  <span className="text-sm text-[var(--text-primary)]">
                                    {accountSummary ? formatRelativeTime(accountSummary.nextRecoveryAt ?? accountSummary.nextWindowResetAt, t) : "—"}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                {windows?.long && <QuotaCapacity label={t("longTermLabel")} {...capacityProps(windows.long, t, format)} />}
                                {windows?.short && <QuotaCapacity label={t("shortTermLabel")} {...capacityProps(windows.short, t, format)} />}
                              </>
                            )}
                          </span>
                        )}
                        {canExpand && <span className="col-start-2 row-start-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-[var(--surface-muted)] px-3 text-xs font-semibold text-[var(--text-primary)] sm:col-start-3">
                          <span id={`quota-toggle-${account.auth_index}`}>{isRowExpanded ? tCommon("close") : t("accountDetailsButton")}</span>
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4 shrink-0 motion-safe:transition-transform", isRowExpanded && "rotate-180")}>
                            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>}
                      </button>

                      {isRowExpanded && (
                        <div className="space-y-3 border-t border-[var(--surface-border)] bg-[var(--surface-base)] px-4 py-3">
                          {!section.modelFirstView && onUpdateAutoReset && (
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                              <input
                                type="checkbox"
                                checked={rule.prime}
                                disabled={isBusy}
                                onChange={(e) => onUpdateAutoReset(account.auth_index, { ...rule, prime: e.target.checked })}
                                className="h-3.5 w-3.5 rounded border-[var(--surface-border)] accent-[var(--accent)]"
                              />
                              <span>{t("autoPrimeToggle")}</span>
                            </label>
                          )}
                          {resetSupported && onUpdateAutoReset && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3 py-2 text-xs">
                              <div className="flex flex-wrap items-center gap-3 text-[var(--text-secondary)]">
                                <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-[var(--text-primary)]">
                                  <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    disabled={isBusy}
                                    onChange={(e) => onUpdateAutoReset(account.auth_index, { ...rule, enabled: e.target.checked })}
                                    className="h-3.5 w-3.5 rounded border-[var(--surface-border)] accent-[var(--accent)]"
                                  />
                                  <span>{t("autoResetToggle")}</span>
                                </label>

                                {rule.enabled && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[var(--text-muted)]">{t("autoResetWhenLabel")}</span>
                                    {RESET_RULE_FIELDS.map(({ key, label, max, unit }, index) => (
                                      <Fragment key={key}>
                                        {index > 0 && <span className="text-[var(--text-muted)]">&amp;</span>}
                                        <label className="inline-flex items-center gap-1">
                                          <span>{t(label)}</span>
                                          <input
                                            type="number"
                                            min={0}
                                            max={max}
                                            disabled={isBusy}
                                            value={rule[key]}
                                            onChange={(e) => onUpdateAutoReset(account.auth_index,
                                              normalizeAutoResetRule({ ...rule, [key]: Number(e.target.value) })
                                            )}
                                            className="glass-input w-12 rounded px-1 py-0.5 text-center text-xs tabular-nums"
                                          />
                                          <span>{unit}</span>
                                        </label>
                                      </Fragment>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {isCheckingCredits ? (
                                  <span className="text-[11px] text-[var(--text-muted)]">
                                    {t("checkingCreditsStatus")}
                                  </span>
                                ) : creditSummary ? (
                                  <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--text-secondary)]">
                                    {creditSummary.error ?? (availableCredits === null ? t("unknown") : t("autoResetCreditsCount", { count: availableCredits }))}
                                  </span>
                                ) : null}
                                {onCheckResetCredits && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => onCheckResetCredits(account.auth_index)}
                                    className="rounded border border-[var(--surface-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-45"
                                  >
                                    {t("refreshButton")}
                                  </button>
                                )}
                                {onManualReset && windows && (
                                  <button
                                    type="button"
                                    disabled={isBusy || availableCredits === 0}
                                    onClick={() => setPendingManualReset(buildManualResetPreview(
                                      account.auth_index, accountLabels.get(account.auth_index) ?? account.provider, windows, t
                                    ))}
                                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:text-emerald-400"
                                  >
                                    {isResettingNow ? t("resettingStatus") : t("autoResetNowButton")}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {account.error && <p className="mb-2 break-all text-xs text-rose-600">{account.error}</p>}
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

      {onManualReset && (() => {
        const liveCreditSummary = pendingManualReset ? autoResetCredits?.[pendingManualReset.authIndex] : undefined;
        const availableCredits = getAvailableCredits(liveCreditSummary);
        const isCheckingModalCredits = pendingManualReset ? autoResetBusy?.[pendingManualReset.authIndex] === "checking" : false;
        const advice = pendingManualReset ? evaluateResetAdvice(pendingManualReset, liveCreditSummary, t) : null;
        const dialogVariant = advice?.tone === "bad" ? "danger" : advice?.tone === "good" ? "info" : "warning";
        const nearestExpiresAt = liveCreditSummary?.nearestExpiresAt;

        return (
          <ConfirmDialog
            isOpen={pendingManualReset !== null}
            onClose={() => setPendingManualReset(null)}
            onConfirm={() => {
              if (!pendingManualReset) return;
              const target = pendingManualReset;
              setPendingManualReset(null);
              onManualReset(target.authIndex);
            }}
            title={t("manualResetConfirmTitle")}
            message={
              pendingManualReset && advice ? (
                <div className="space-y-3 text-left text-xs">
                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      advice.tone === "good" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                      advice.tone === "borderline" && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                      advice.tone === "bad" && "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white",
                          advice.tone === "good" && "bg-emerald-600",
                          advice.tone === "borderline" && "bg-amber-600",
                          advice.tone === "bad" && "bg-rose-600"
                        )}
                      >
                        {advice.badge}
                      </span>
                      <span className="font-semibold">{advice.summary}</span>
                    </div>
                  </div>

                  {(pendingManualReset.longWindow || pendingManualReset.shortWindow) && (
                    <div className="space-y-2.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)]/40 p-3 tabular-nums">
                      {[
                        { key: "longTermLabel", window: pendingManualReset.longWindow },
                        { key: "shortTermLabel", window: pendingManualReset.shortWindow },
                      ].map(
                        ({ key, window }) =>
                          window && (
                            <div key={key} className="space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-[var(--text-primary)]">{t(key)}</span>
                                <span className="text-[11px] text-[var(--text-secondary)]">
                                  <span className="font-semibold text-[var(--text-primary)]">{window.currentPct}%</span>{" "}
                                  → <span className="font-semibold text-emerald-600 dark:text-emerald-400">100%</span>
                                  {" "}
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                    (+{100 - window.currentPct}%)
                                  </span>
                                  {" · "}
                                  {t("manualResetResetsLabel")} {window.resetsIn} → <span className="font-medium text-[var(--text-primary)]">{window.resetDuration}</span>
                                </span>
                              </div>
                              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                <div
                                  className="h-full bg-[var(--text-muted)]/50"
                                  style={{ width: `${window.currentPct}%` }}
                                />
                                <div
                                  className="h-full bg-emerald-500/80"
                                  style={{ width: `${100 - window.currentPct}%` }}
                                />
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] tabular-nums">
                    {isCheckingModalCredits ? (
                      <span>{t("checkingCreditsStatus")}</span>
                    ) : liveCreditSummary?.error ? (
                      <span className="text-rose-600 dark:text-rose-400">{liveCreditSummary.error}</span>
                    ) : availableCredits !== null ? (
                      <span className={cn("font-medium", availableCredits === 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--text-secondary)]")}>
                        {t("autoResetCreditsCount", { count: availableCredits })}
                      </span>
                    ) : (
                      <span>{t("manualResetConfirmMessage", { account: pendingManualReset.label })}</span>
                    )}

                    {nearestExpiresAt && (
                      <span className="font-medium text-[var(--text-secondary)]" title={format.dateTime(new Date(nearestExpiresAt), { dateStyle: "medium", timeStyle: "long" })}>
                        {t("resetCreditExpiresLabel", { expiresIn: formatRelativeTime(nearestExpiresAt, t) })}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                ""
              )
            }
            confirmLabel={t("autoResetNowButton")}
            confirmDisabled={isCheckingModalCredits || availableCredits === 0}
            variant={dialogVariant}
          />
        );
      })()}
    </section>
  );
}

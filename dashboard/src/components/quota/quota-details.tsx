"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AccountQuotaHistory, prefetchAccountQuotaHistory } from "@/components/quota/account-quota-history";
import { QuotaCapacity } from "@/components/quota/quota-capacity";
import { formatRelativeTime, parseRelativeTime } from "@/lib/format-relative-time";
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

interface WindowScore {
  score: number;
  label: string;
  isShortTerm: boolean;
  resetTime?: string | null;
}

function calcAccountWindowScores(groups: QuotaGroup[]): Record<string, WindowScore> {
  const result: Record<string, WindowScore> = {};
  for (const group of groups) {
    if (group.id === "extra-usage") continue;
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    result[group.id] = {
      score,
      label: group.label,
      isShortTerm: isShortTermQuotaWindow(group, groups),
      resetTime: group.resetTime,
    };
  }
  return result;
}

function formatCompactResetAt(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  })
    .format(date)
    .replace(/\s+([AP]M)$/i, (_, meridiem: string) => meridiem.toLowerCase());

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) return timeStr;

  const dateStr = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(date);

  return `${dateStr} ${timeStr}`;
}

function summarizeWindowCapacity(
  scores: WindowScore[],
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string
): { percent: number; resetLabel: string | null; resetTitle?: string; isResetting: boolean } | null {
  let bottleneck: WindowScore | null = null;
  for (const candidate of scores) {
    if (
      !bottleneck ||
      candidate.score < bottleneck.score ||
      (candidate.score === bottleneck.score && !bottleneck.resetTime && Boolean(candidate.resetTime))
    ) {
      bottleneck = candidate;
    }
  }
  if (!bottleneck) return null;
  const parsed = parseRelativeTime(bottleneck.resetTime);
  const hasKnownReset = parsed.type !== "unknown";
  const isResetting = parsed.type === "resetting";
  const relative = hasKnownReset ? formatRelativeTime(bottleneck.resetTime, t) : null;
  const resetLabel =
    relative && !isResetting && bottleneck.resetTime
      ? `${relative} · ${formatCompactResetAt(bottleneck.resetTime, locale)}`
      : relative;
  const resetTitle =
    hasKnownReset && bottleneck.resetTime
      ? `${t("resetColumnLabel")}: ${new Date(bottleneck.resetTime).toLocaleString()}`
      : undefined;
  return {
    percent: Math.round(bottleneck.score * 100),
    resetLabel,
    resetTitle,
    isResetting,
  };
}

function isResettableProvider(provider: string): boolean {
  const canonical = canonicalizeQuotaProvider(provider);
  return canonical === "codex" || canonical === "claude";
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

function formatCountdown(isoDate: string | null | undefined): string {
  const res = parseRelativeTime(isoDate);
  if (res.type === "resetting") return "now";
  if (res.type !== "time") return "—";
  const { days = 0, hours = 0, minutes = 0 } = res;
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

function calcDaysLeft(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (ms - Date.now()) / 86_400_000);
}

function formatWindowTarget(group: QuotaGroup, isShortTerm: boolean): string {
  const sec = group.windowSeconds;
  if (typeof sec === "number" && sec > 0) {
    const totalHours = Math.round(sec / 3600);
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const remHours = totalHours % 24;
      return `${days}d${remHours}h`;
    }
    return `${totalHours}h`;
  }
  return isShortTerm ? "5h" : "7d0h";
}

function buildManualResetPreview(account: QuotaAccount, label: string): PendingManualReset {
  const groups = account.groups
    ? headlineQuotaWindows(capacityQuotaGroups(account.provider, account.groups)).filter(
        (g) => g.id !== "extra-usage"
      )
    : [];

  let longGroup: QuotaGroup | null = null;
  let shortGroup: QuotaGroup | null = null;
  for (const group of groups) {
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) continue;
    const isShort = isShortTermQuotaWindow(group, groups);
    if (isShort) {
      const currentScore = shortGroup ? (normalizeFraction(shortGroup.remainingFraction) ?? Infinity) : Infinity;
      if (score < currentScore) shortGroup = group;
    } else {
      const currentScore = longGroup ? (normalizeFraction(longGroup.remainingFraction) ?? Infinity) : Infinity;
      if (score < currentScore) longGroup = group;
    }
  }

  const toPreview = (group: QuotaGroup | null, isShort: boolean): ResetWindowPreview | null => {
    if (!group) return null;
    const score = normalizeFraction(group.remainingFraction);
    if (score === null) return null;
    return {
      currentPct: Math.round(score * 100),
      resetsIn: formatCountdown(group.resetTime),
      resetDuration: formatWindowTarget(group, isShort),
      daysLeft: calcDaysLeft(group.resetTime),
    };
  };

  return {
    authIndex: account.auth_index,
    label,
    longWindow: toPreview(longGroup, false),
    shortWindow: toPreview(shortGroup, true),
  };
}

function evaluateResetAdvice(
  preview: PendingManualReset,
  creditSummary: AutoResetCreditSummary | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
): ResetAdvice {
  const longPct = preview.longWindow?.currentPct ?? 0;
  const longGain = Math.max(0, 100 - longPct);
  const longResetsIn = preview.longWindow?.resetsIn ?? "—";
  const longDays = preview.longWindow?.daysLeft ?? null;
  const shortPct = preview.shortWindow?.currentPct ?? 0;
  const expiresAt = creditSummary?.nearestExpiresAt;
  const creditDaysLeft = calcDaysLeft(expiresAt);

  if (creditSummary && !creditSummary.error && creditSummary.availableCount === 0) {
    return {
      tone: "bad",
      badge: t("resetVerdictNoCreditsBadge"),
      summary: t("resetVerdictNoCreditsTitle"),
    };
  }

  if (creditDaysLeft !== null && creditDaysLeft <= 3 && longPct < 80) {
    return {
      tone: "good",
      badge: t("resetVerdictExpSoonBadge"),
      summary: t("resetVerdictReasonExpiringSoon", {
        expiresIn: formatCountdown(expiresAt),
        gain: longGain,
      }),
    };
  }

  const hoursUntilReset = Math.max(0, Math.min(168, (longDays ?? 7) * 24));
  const weeklyRemaining = Math.max(0, Math.min(1, longPct / 100));
  const fiveHourRemaining = preview.shortWindow ? Math.max(0, Math.min(1, shortPct / 100)) : 1;
  const timeFactor = 1 - Math.pow(1 - hoursUntilReset / 168, 3);
  const quotaFactor = (1 - weeklyRemaining) + 0.2 * weeklyRemaining * (1 - fiveHourRemaining);
  const score = timeFactor * quotaFactor;

  if (score >= 0.7) {
    return {
      tone: "good",
      badge: t("resetVerdictGoodBadge"),
      summary: t("resetVerdictReasonSummary", { gain: longGain, resetsIn: longResetsIn }),
    };
  }

  if (score >= 0.4) {
    return {
      tone: "borderline",
      badge: t("resetVerdictBorderlineBadge"),
      summary: t("resetVerdictReasonSummary", { gain: longGain, resetsIn: longResetsIn }),
    };
  }

  const badSummary =
    longPct >= 70
      ? t("resetVerdictReasonHighWeekly", { pct: longPct, gain: longGain })
      : longDays !== null && longDays < 1
        ? t("resetVerdictReasonImminentReset", { resetsIn: longResetsIn })
        : t("resetVerdictReasonSummary", { gain: longGain, resetsIn: longResetsIn });

  return {
    tone: "bad",
    badge: t("resetVerdictBadBadge"),
    summary: badSummary,
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
    patch: { enabled: boolean; fiveHourThresholdPct: number; weeklyThresholdPct: number; minWeeklyDaysLeft: number }
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
  const locale = useLocale();
  const t = useTranslations("quota");
  const [pendingManualReset, setPendingManualReset] = useState<PendingManualReset | null>(null);
  const autoFetchedCreditsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!onCheckResetCredits) return;
    for (const account of filteredAccounts) {
      if (!expandedCards[account.auth_index]) continue;
      if (!isResettableProvider(account.provider)) continue;
      if (autoResetCredits?.[account.auth_index] !== undefined) continue;
      if (autoResetBusy?.[account.auth_index]) continue;
      if (autoFetchedCreditsRef.current.has(account.auth_index)) continue;
      autoFetchedCreditsRef.current.add(account.auth_index);
      onCheckResetCredits(account.auth_index);
    }
  }, [filteredAccounts, expandedCards, autoResetCredits, autoResetBusy, onCheckResetCredits]);

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
                  const isRowExpanded = expandedCards[account.auth_index];
                  const scores = account.groups
                    ? Object.values(calcAccountWindowScores(headlineQuotaWindows(capacityQuotaGroups(account.provider, account.groups))))
                    : [];
                  const longWindow = summarizeWindowCapacity(scores.filter((score) => !score.isShortTerm), locale, t);
                  const shortWindow = summarizeWindowCapacity(scores.filter((score) => score.isShortTerm), locale, t);
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

                  const resetSupported = !section.modelFirstView && isResettableProvider(account.provider);
                  const rule = autoResetRules?.[account.auth_index] ?? {
                    enabled: false,
                    fiveHourThresholdPct: 0,
                    weeklyThresholdPct: 0,
                    minWeeklyDaysLeft: 0,
                  };
                  const creditSummary = autoResetCredits?.[account.auth_index];
                  const busyAction = autoResetBusy?.[account.auth_index] ?? null;
                  const isCheckingCredits = busyAction === "checking";
                  const isResettingNow = busyAction === "resetting";
                  const isBusy = busyAction !== null;

                  return (
                    <div key={account.auth_index}>
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
                        aria-expanded={Boolean(isRowExpanded)}
                        aria-labelledby={`quota-account-${account.auth_index} quota-toggle-${account.auth_index}`}
                        onClick={() => onToggleCard(account.auth_index)}
                        className={cn(
                          "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:gap-x-6",
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
                        {account.supported && !account.error && (section.modelFirstView || longWindow !== null || shortWindow !== null) && (
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
                                {longWindow !== null && (
                                  <QuotaCapacity
                                    label={t("longTermLabel")}
                                    percent={longWindow.percent}
                                    resetLabel={longWindow.resetLabel}
                                    resetTitle={longWindow.resetTitle}
                                    isResetting={longWindow.isResetting}
                                  />
                                )}
                                {shortWindow !== null && (
                                  <QuotaCapacity
                                    label={t("shortTermLabel")}
                                    percent={shortWindow.percent}
                                    resetLabel={shortWindow.resetLabel}
                                    resetTitle={shortWindow.resetTitle}
                                    isResetting={shortWindow.isResetting}
                                  />
                                )}
                              </>
                            )}
                          </span>
                        )}
                        <span className="col-start-2 row-start-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-[var(--surface-muted)] px-3 text-xs font-semibold text-[var(--text-primary)] sm:col-start-3">
                          <span id={`quota-toggle-${account.auth_index}`}>{isRowExpanded ? tCommon("close") : t("accountDetailsButton")}</span>
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("size-4 shrink-0 motion-safe:transition-transform", isRowExpanded && "rotate-180")}>
                            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>

                      {isRowExpanded && (
                        <div className="space-y-3 border-t border-[var(--surface-border)] bg-[var(--surface-base)] px-4 py-3">
                          {resetSupported && onUpdateAutoReset && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3 py-2 text-xs">
                              <div className="flex flex-wrap items-center gap-3 text-[var(--text-secondary)]">
                                <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-[var(--text-primary)]">
                                  <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    disabled={isBusy}
                                    onChange={(e) =>
                                      onUpdateAutoReset(account.auth_index, {
                                        enabled: e.target.checked,
                                        fiveHourThresholdPct: rule.fiveHourThresholdPct,
                                        weeklyThresholdPct: rule.weeklyThresholdPct,
                                        minWeeklyDaysLeft: rule.minWeeklyDaysLeft,
                                      })
                                    }
                                    className="h-3.5 w-3.5 rounded border-[var(--surface-border)] accent-[var(--accent)]"
                                  />
                                  <span>{t("autoResetToggle")}</span>
                                </label>

                                {rule.enabled && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[var(--text-muted)]">{t("autoResetWhenLabel")}</span>
                                    <label className="inline-flex items-center gap-1">
                                      <span>{t("autoReset5hLabel")}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        disabled={isBusy}
                                        value={rule.fiveHourThresholdPct}
                                        onChange={(e) =>
                                          onUpdateAutoReset(account.auth_index, {
                                            enabled: true,
                                            fiveHourThresholdPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                            weeklyThresholdPct: rule.weeklyThresholdPct,
                                            minWeeklyDaysLeft: rule.minWeeklyDaysLeft,
                                          })
                                        }
                                        className="glass-input w-12 rounded px-1 py-0.5 text-center text-xs tabular-nums"
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
                                        disabled={isBusy}
                                        value={rule.weeklyThresholdPct}
                                        onChange={(e) =>
                                          onUpdateAutoReset(account.auth_index, {
                                            enabled: true,
                                            fiveHourThresholdPct: rule.fiveHourThresholdPct,
                                            weeklyThresholdPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                            minWeeklyDaysLeft: rule.minWeeklyDaysLeft,
                                          })
                                        }
                                        className="glass-input w-12 rounded px-1 py-0.5 text-center text-xs tabular-nums"
                                      />
                                      <span>%</span>
                                    </label>
                                    <span className="text-[var(--text-muted)]">&amp;</span>
                                    <label className="inline-flex items-center gap-1">
                                      <span>{t("autoResetDaysLeftLabel")}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={7}
                                        disabled={isBusy}
                                        value={rule.minWeeklyDaysLeft}
                                        onChange={(e) =>
                                          onUpdateAutoReset(account.auth_index, {
                                            enabled: true,
                                            fiveHourThresholdPct: rule.fiveHourThresholdPct,
                                            weeklyThresholdPct: rule.weeklyThresholdPct,
                                            minWeeklyDaysLeft: Math.max(0, Math.min(7, Number(e.target.value) || 0)),
                                          })
                                        }
                                        className="glass-input w-11 rounded px-1 py-0.5 text-center text-xs tabular-nums"
                                      />
                                      <span>d</span>
                                    </label>
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
                                    {creditSummary.error
                                      ? creditSummary.error
                                      : t("autoResetCreditsCount", { count: creditSummary.availableCount ?? 0 })}
                                  </span>
                                ) : null}
                                {onManualReset && (() => {
                                  const hasNoCredits = Boolean(
                                    creditSummary && !creditSummary.error && creditSummary.availableCount === 0
                                  );
                                  return (
                                    <button
                                      type="button"
                                      disabled={isBusy || hasNoCredits}
                                      onClick={() => {
                                        if (!creditSummary && onCheckResetCredits) {
                                          onCheckResetCredits(account.auth_index);
                                        }
                                        setPendingManualReset(
                                          buildManualResetPreview(
                                            account,
                                            accountLabels.get(account.auth_index) ?? account.provider
                                          )
                                        );
                                      }}
                                      className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:text-emerald-400"
                                    >
                                      {isResettingNow ? t("resettingStatus") : t("autoResetNowButton")}
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
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
        const hasNoModalCredits = Boolean(
          liveCreditSummary && !liveCreditSummary.error && liveCreditSummary.availableCount === 0
        );
        const isCheckingModalCredits = pendingManualReset ? autoResetBusy?.[pendingManualReset.authIndex] === "checking" : false;
        const advice = pendingManualReset ? evaluateResetAdvice(pendingManualReset, liveCreditSummary, t) : null;
        const dialogVariant = advice?.tone === "bad" ? "danger" : advice?.tone === "good" ? "info" : "warning";
        const nearestExpiresAt = liveCreditSummary?.nearestExpiresAt;
        const creditDaysLeft = calcDaysLeft(nearestExpiresAt);

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
                  {/* Blunt Visual Recommendation Banner */}
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

                  {/* Before -> After Quota & Timer Breakdown */}
                  {(pendingManualReset.longWindow || pendingManualReset.shortWindow) && (
                    <div className="space-y-2.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)]/40 p-3 tabular-nums">
                      {[
                        { label: t("longTermLabel"), window: pendingManualReset.longWindow },
                        { label: t("shortTermLabel"), window: pendingManualReset.shortWindow },
                      ].map(
                        ({ label, window }) =>
                          window && (
                            <div key={label} className="space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-[var(--text-primary)]">{label}</span>
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

                  {/* Credits & Expiry Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] tabular-nums">
                    {isCheckingModalCredits ? (
                      <span>{t("checkingCreditsStatus")}</span>
                    ) : liveCreditSummary?.error ? (
                      <span className="text-rose-600 dark:text-rose-400">{liveCreditSummary.error}</span>
                    ) : typeof liveCreditSummary?.availableCount === "number" ? (
                      <span
                        className={cn(
                          "font-medium",
                          liveCreditSummary.availableCount === 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[var(--text-secondary)]"
                        )}
                      >
                        {t("autoResetCreditsCount", { count: liveCreditSummary.availableCount })}
                      </span>
                    ) : (
                      <span>{t("manualResetConfirmMessage", { account: pendingManualReset.label })}</span>
                    )}

                    {nearestExpiresAt && (
                      <span
                        className={cn(
                          "font-medium",
                          creditDaysLeft !== null && creditDaysLeft <= 3
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-[var(--text-secondary)]"
                        )}
                        title={new Date(nearestExpiresAt).toLocaleString()}
                      >
                        {t("resetCreditExpiresLabel", { expiresIn: formatCountdown(nearestExpiresAt) })}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                ""
              )
            }
            confirmLabel={t("autoResetNowButton")}
            confirmDisabled={hasNoModalCredits}
            variant={dialogVariant}
          />
        );
      })()}
    </section>
  );
}

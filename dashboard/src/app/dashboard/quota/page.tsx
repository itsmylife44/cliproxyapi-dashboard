"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/toast";
import { QuotaToolbar } from "@/components/quota/quota-toolbar";
import { useQuota } from "@/hooks/use-quota";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { headlineQuotaWindows } from "@/lib/quota/headline";
import { calcProviderSummary } from "@/lib/quota/provider-summary";
import type { AutoResetCreditSummary, AutoResetRule } from "@/lib/quota/auto-reset-rules";
import {
  enrichModelFirstGroup,
  isModelFirstAccount,
  isModelFirstAccountQuotaUnverified,
  isModelFirstProviderQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstProvider,
  type QuotaAccount,
} from "@/lib/model-first-monitoring";
import { maskEmail } from "@/lib/mask-email";
import {
  buildQuotaSearch,
  buildQuotaToolbarQuery,
  canonicalizeQuotaProvider,
  clearQuotaToolbarQuery,
  parseQuotaQueryState,
  type QuotaQueryProvider,
  type QuotaQueryState,
  type QuotaQueryStatus,
} from "@/lib/quota/query-state";

const QuotaChart = dynamic(
  () => import("@/components/quota/quota-chart").then((mod) => ({ default: mod.QuotaChart })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" /> }
);
import { QuotaDetails } from "@/components/quota/quota-details";
import { QuotaAlerts } from "@/components/quota/quota-alerts";
import { invalidateClientQuotaHistoryCache, prefetchBatchQuotaHistory } from "@/components/quota/account-quota-history";

export const QUOTA_ACCOUNTS_PAGE_SIZE = 25;

function matchesSelectedProvider(provider: string, selected: QuotaQueryProvider): boolean {
  if (selected === "all") return true;
  return canonicalizeQuotaProvider(provider) === selected;
}

function getQuotaAccountStatus(account: QuotaAccount): QuotaQueryStatus {
  if (!account.supported) return "disabled";
  if (account.error) return "error";

  if (isModelFirstAccount(account)) {
    const providerSummary = summarizeModelFirstProvider([account]);
    if (isModelFirstProviderQuotaUnverified(providerSummary)) return "warning";
    if (isModelFirstAccountQuotaUnverified(account)) return "warning";
  }

  const fractions = (account.groups ?? [])
    .map((group) => {
      const normalizedGroup = isModelFirstAccount(account) ? enrichModelFirstGroup(group) : group;
      return normalizeFraction(normalizedGroup.minRemainingFraction ?? normalizedGroup.remainingFraction);
    })
    .filter((value): value is number => value !== null);

  if (fractions.length > 0 && Math.min(...fractions) <= 0.2) return "warning";

  return "active";
}

function matchesQuotaSearch(account: QuotaAccount, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  // Include the masked form so searches against the label rendered in the
  // table (e.g. `foo***@example.com`) find the account, while still matching
  // the raw email for admins who know the full address.
  const haystack = [
    account.email,
    typeof account.email === "string" ? maskEmail(account.email, "") : null,
    account.provider,
    canonicalizeQuotaProvider(account.provider),
    account.auth_index,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

function matchesQuotaStatus(account: QuotaAccount, status: QuotaQueryStatus): boolean {
  if (status === "all") return true;
  return getQuotaAccountStatus(account) === status;
}

export function filterQuotaAccounts(accounts: QuotaAccount[], query: QuotaQueryState): QuotaAccount[] {
  return accounts.filter(
    (account) =>
      matchesSelectedProvider(account.provider, query.provider) &&
      matchesQuotaSearch(account, query.q) &&
      matchesQuotaStatus(account, query.status)
  );
}

export default function QuotaPage() {
  const t = useTranslations("quota");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { data: quotaData, isLoading: loading, refreshing, refresh } = useQuota();
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [autoResetRules, setAutoResetRules] = useState<Record<string, AutoResetRule>>({});
  const [autoResetCredits, setAutoResetCredits] = useState<Record<string, AutoResetCreditSummary>>({});
  const [autoResetBusy, setAutoResetBusy] = useState<Record<string, boolean>>({});
  const lastGeneratedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch(API_ENDPOINTS.QUOTA.AUTO_RESET)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rules?: Record<string, AutoResetRule> } | null) => {
        if (active && data?.rules) setAutoResetRules(data.rules);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleUpdateAutoReset = useCallback(
    async (
      authIndex: string,
      patch: { enabled: boolean; fiveHourThresholdPct: number; weeklyThresholdPct: number }
    ) => {
      setAutoResetRules((prev) => ({
        ...prev,
        [authIndex]: { ...prev[authIndex], ...patch },
      }));
      try {
        const res = await fetch(API_ENDPOINTS.QUOTA.AUTO_RESET, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authIndex, ...patch }),
        });
        if (!res.ok) {
          showToast(t("autoResetSaveFailed"), "error");
          return;
        }
        const data = (await res.json()) as { rule?: AutoResetRule };
        if (data.rule) {
          setAutoResetRules((prev) => ({ ...prev, [authIndex]: data.rule! }));
        }
      } catch {
        showToast(t("autoResetSaveFailed"), "error");
      }
    },
    [showToast, t]
  );

  const handleCheckResetCredits = useCallback(
    async (authIndex: string, provider: string) => {
      setAutoResetBusy((prev) => ({ ...prev, [authIndex]: true }));
      try {
        const res = await fetch(API_ENDPOINTS.QUOTA.AUTO_RESET, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_credits", authIndex, provider }),
        });
        const data = (await res.json()) as AutoResetCreditSummary;
        setAutoResetCredits((prev) => ({ ...prev, [authIndex]: data }));
      } catch {
        showToast(t("autoResetCheckFailed"), "error");
      } finally {
        setAutoResetBusy((prev) => ({ ...prev, [authIndex]: false }));
      }
    },
    [showToast, t]
  );

  const handleManualReset = useCallback(
    async (authIndex: string, provider: string) => {
      setAutoResetBusy((prev) => ({ ...prev, [authIndex]: true }));
      try {
        const res = await fetch(API_ENDPOINTS.QUOTA.AUTO_RESET, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_now", authIndex, provider }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; status?: string };
        showToast(data.message ?? (res.ok ? t("autoResetApplied") : t("autoResetFailed")), res.ok && data.ok ? "success" : "error");
        if (res.ok && data.ok) {
          setAutoResetRules((prev) => ({
            ...prev,
            [authIndex]: {
              ...(prev[authIndex] ?? { enabled: true, fiveHourThresholdPct: 0, weeklyThresholdPct: 0 }),
              lastResetAt: new Date().toISOString(),
              lastStatus: data.status ?? "reset",
            },
          }));
          void refresh().catch(() => {});
        }
      } catch {
        showToast(t("autoResetFailed"), "error");
      } finally {
        setAutoResetBusy((prev) => ({ ...prev, [authIndex]: false }));
      }
    },
    [refresh, showToast, t]
  );

  const query = useMemo(() => parseQuotaQueryState(searchParams), [searchParams]);

  const replaceQuery = (nextQuery: QuotaQueryState) => {
    const nextSearch = buildQuotaSearch(nextQuery);
    router.replace(`${pathname}${nextSearch}`, { scroll: false });
  };

  useEffect(() => {
    if (!quotaData) return;
    if (lastGeneratedAtRef.current !== undefined && lastGeneratedAtRef.current !== quotaData.generatedAt) {
      invalidateClientQuotaHistoryCache();
    }
    lastGeneratedAtRef.current = quotaData.generatedAt;
    void prefetchBatchQuotaHistory(
      quotaData.accounts
        .filter((account) => account.supported && !account.error && account.auth_index)
        .map((account) => account.auth_index)
    );
  }, [quotaData]);
  const allAccounts = useMemo(() => quotaData?.accounts ?? [], [quotaData]);
  const filteredAccounts = useMemo(() => filterQuotaAccounts(allAccounts, query), [allAccounts, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / QUOTA_ACCOUNTS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, query.page), totalPages);
  const pageStart = (currentPage - 1) * QUOTA_ACCOUNTS_PAGE_SIZE;
  const paginatedAccounts = filteredAccounts.slice(pageStart, pageStart + QUOTA_ACCOUNTS_PAGE_SIZE);

  // Only rewrite URL to clamp `page` once quota data has arrived. Before the
  // first fetch resolves, `filteredAccounts` is empty and `totalPages` is 1,
  // so clamping here would drop a deep-linked `page=N` before it could be used.
  const normalizedSearch = buildQuotaSearch({ ...query, page: currentPage });
  const currentSearch = searchParams.toString();
  const expectedSearch = normalizedSearch.startsWith("?") ? normalizedSearch.slice(1) : normalizedSearch;

  useEffect(() => {
    if (!quotaData) return;
    if (currentSearch !== expectedSearch) {
      router.replace(`${pathname}${normalizedSearch}`, { scroll: false });
    }
  }, [quotaData, currentSearch, expectedSearch, normalizedSearch, pathname, router]);

  const activeAccounts = filteredAccounts.filter((account) => account.supported && !account.error).length;

  const providerGroups = new Map<string, QuotaAccount[]>();
  for (const account of filteredAccounts) {
    // Group aliased providers (e.g. `gemini` and `gemini-cli`) into a single
    // bucket so the filter and the summary stay consistent. Raw values without
    // a canonical mapping fall back to the reported provider string.
    const groupKey = canonicalizeQuotaProvider(account.provider) ?? account.provider;
    const existing = providerGroups.get(groupKey) ?? [];
    existing.push(account);
    providerGroups.set(groupKey, existing);
  }

  const providerSummaries = Array.from(providerGroups.entries())
    .map(([, accounts]) => calcProviderSummary(accounts))
    .sort((left, right) => right.healthyAccounts - left.healthyAccounts);

  const isModelFirstOnlyView =
    filteredAccounts.length > 0 && filteredAccounts.every((account) => isModelFirstAccount(account));
  const modelFirstSummary = isModelFirstOnlyView ? summarizeModelFirstProvider(filteredAccounts) : null;
  const modelFirstWarnings = providerSummaries
    .filter((summary) => summary.monitorMode === "model-first" && summary.modelFirstSummary)
    .map((summary) => ({
      provider: summary.provider,
      summary: summary.modelFirstSummary!,
    }))
    .filter(({ summary }) => isModelFirstProviderQuotaUnverified(summary));

  const lowCapacityCount = providerSummaries.filter((summary) => {
    if (summary.monitorMode === "model-first") {
      const fraction =
        summary.modelFirstSummary?.avgRemainingFraction ??
        summary.modelFirstSummary?.minRemainingFraction ??
        1;
      return fraction < 0.2 && summary.totalAccounts > 0;
    }
    return (
      headlineQuotaWindows(summary.windowCapacities).some(
        (window) => (window.averageCapacity ?? window.capacity) < 0.2
      ) && summary.totalAccounts > 0
    );
  }).length;

  const toggleCard = (accountId: string) => {
    setExpandedCards((previous) => ({ ...previous, [accountId]: !previous[accountId] }));
  };

  const hasAnyAccounts = allAccounts.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-3 tabular-nums">
          <span>
            <strong className="font-semibold text-[var(--text-primary)]">{activeAccounts}</strong>{" "}
            {t("activeAccountsLabel").toLowerCase()}
          </span>
          <span>·</span>
          <span>
            <strong className="font-semibold text-[var(--text-primary)]">{providerSummaries.length}</strong>{" "}
            {t("providersLabel").toLowerCase()}
          </span>
          {lowCapacityCount > 0 && (
            <>
              <span>·</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {lowCapacityCount} {t("lowCapacityLabel").toLowerCase()}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t("autoRefreshBadge")}
          </span>
          <button
            type="button"
            onClick={() => void refresh().catch(() => {})}
            disabled={loading || refreshing}
            aria-label={t("refreshButton")}
            title={t("refreshButton")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading || refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
        </div>
      </div>

      {loading && !quotaData ? (
        <div className="border-t border-[var(--surface-border)] py-10 text-center text-sm text-[var(--text-muted)]">
          {t("loadingText")}
        </div>
      ) : (
        <div className="space-y-6">
          {modelFirstWarnings.length > 0 && (
            <section className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              {modelFirstWarnings.map(({ provider, summary }) => (
                <p key={provider}>
                  {t("modelFirstWarning", {
                    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
                    count: summary.totalAccounts,
                  })}
                </p>
              ))}
            </section>
          )}

          <QuotaDetails
            filteredAccounts={paginatedAccounts}
            hasAnyAccounts={hasAnyAccounts}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => replaceQuery({ ...query, page })}
            expandedCards={expandedCards}
            onToggleCard={toggleCard}
            loading={loading}
            modelFirstOnlyView={isModelFirstOnlyView}
            refreshKey={quotaData?.generatedAt}
            headerRight={
              <QuotaToolbar
                query={query}
                total={filteredAccounts.length}
                onSearchChange={(value) => replaceQuery(buildQuotaToolbarQuery(query, { q: value }))}
                onProviderChange={(value) => replaceQuery(buildQuotaToolbarQuery(query, { provider: value }))}
                onStatusChange={(value) => replaceQuery(buildQuotaToolbarQuery(query, { status: value }))}
                onClear={() => replaceQuery(clearQuotaToolbarQuery())}
              />
            }
            autoResetRules={autoResetRules}
            autoResetCredits={autoResetCredits}
            autoResetBusy={autoResetBusy}
            onUpdateAutoReset={handleUpdateAutoReset}
            onCheckResetCredits={handleCheckResetCredits}
            onManualReset={handleManualReset}
          />

          <div className="border-t border-[var(--surface-border)] pt-5">
            <QuotaChart
              providerSummaries={providerSummaries}
              modelFirstSummary={modelFirstSummary}
              modelFirstOnlyView={isModelFirstOnlyView}
            />
          </div>
        </div>
      )}

      <div className="border-t border-[var(--surface-border)] pt-5">
        <QuotaAlerts />
      </div>
    </div>
  );
}

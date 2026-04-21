"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/tooltip";
import { QuotaToolbar } from "@/components/quota/quota-toolbar";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import {
  enrichModelFirstGroup,
  isModelFirstAccount,
  isModelFirstAccountQuotaUnverified,
  isModelFirstProviderQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstProvider,
  type ModelFirstProviderSummary,
  type QuotaAccount,
  type QuotaMonitorMode,
  type QuotaResponse,
} from "@/lib/model-first-monitoring";
import { formatRelativeTime } from "@/lib/format-relative-time";
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

export const QUOTA_ACCOUNTS_PAGE_SIZE = 25;

interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  resetTime: string | null;
  isShortTerm: boolean;
}

interface ProviderSummary {
  provider: string;
  monitorMode: QuotaMonitorMode;
  totalAccounts: number;
  healthyAccounts: number;
  errorAccounts: number;
  windowCapacities: WindowCapacity[];
  modelFirstSummary?: ModelFirstProviderSummary;
}

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

function calcProviderSummary(accounts: QuotaAccount[]): ProviderSummary {
  const totalAccounts = accounts.length;
  const healthy = accounts.filter(
    (account) => account.supported && !account.error && account.groups && account.groups.length > 0
  );
  const errorAccounts = totalAccounts - healthy.length;
  const modelFirst = healthy.length > 0 && healthy.every((account) => isModelFirstAccount(account));

  if (modelFirst) {
    return {
      provider: accounts[0]?.provider ?? "unknown",
      monitorMode: "model-first",
      totalAccounts,
      healthyAccounts: healthy.length,
      errorAccounts,
      windowCapacities: [],
      modelFirstSummary: summarizeModelFirstProvider(healthy),
    };
  }

  const allWindowIds = new Set<string>();
  for (const account of healthy) {
    for (const group of account.groups ?? []) {
      if (group.id !== "extra-usage") allWindowIds.add(group.id);
    }
  }

  const windowCapacities: WindowCapacity[] = [];

  for (const windowId of allWindowIds) {
    const relevantAccounts = healthy.filter((account) =>
      account.groups?.some((group) => group.id === windowId)
    );
    if (relevantAccounts.length === 0) continue;

    const scores = relevantAccounts
      .map((account) => {
        const group = account.groups?.find((candidate) => candidate.id === windowId);
        return normalizeFraction(group?.remainingFraction);
      })
      .filter((score): score is number => score !== null);

    if (scores.length === 0) {
      continue;
    }

    const exhaustedProduct = scores.reduce((product, score) => product * (1 - score), 1);
    const capacity = 1 - exhaustedProduct;

    let earliestReset: string | null = null;
    let minResetTime = Infinity;
    let label = "";
    let isShortTerm = false;

    for (const account of relevantAccounts) {
      const group = account.groups?.find((candidate) => candidate.id === windowId);
      if (group) {
        if (!label) {
          label = group.label;
          isShortTerm = isShortTermQuotaWindow(group, account.groups ?? []);
        }
        if (group.resetTime) {
          const timestamp = new Date(group.resetTime).getTime();
          if (timestamp < minResetTime) {
            minResetTime = timestamp;
            earliestReset = group.resetTime;
          }
        }
      }
    }

    windowCapacities.push({
      id: windowId,
      label,
      capacity: Math.max(0, Math.min(1, capacity)),
      resetTime: earliestReset,
      isShortTerm,
    });
  }

  windowCapacities.sort((left, right) => {
    if (left.isShortTerm !== right.isShortTerm) return left.isShortTerm ? 1 : -1;
    return left.label.localeCompare(right.label);
  });

  return {
    provider: accounts[0]?.provider ?? "unknown",
    monitorMode: "window-based",
    totalAccounts,
    healthyAccounts: healthy.length,
    errorAccounts,
    windowCapacities,
  };
}

function calcOverallCapacity(
  summaries: ProviderSummary[],
  noDataLabel: string,
  weightedLabel: string
): { value: number; label: string; provider: string } {
  if (summaries.length === 0) return { value: 0, label: noDataLabel, provider: "" };

  let weightedCapacity = 0;
  let weightedAccounts = 0;

  for (const summary of summaries) {
    if (summary.healthyAccounts === 0) continue;

    if (summary.monitorMode === "model-first" && summary.modelFirstSummary) {
      if (isModelFirstProviderQuotaUnverified(summary.modelFirstSummary)) continue;
      const providerCapacity =
        summary.modelFirstSummary.totalAccounts > 0
          ? summary.modelFirstSummary.readyAccounts / summary.modelFirstSummary.totalAccounts
          : 0;
      weightedCapacity += providerCapacity * summary.healthyAccounts;
      weightedAccounts += summary.healthyAccounts;
      continue;
    }

    const longTerm = summary.windowCapacities.filter((window) => !window.isShortTerm);
    const shortTerm = summary.windowCapacities.filter((window) => window.isShortTerm);
    const relevantWindows = longTerm.length > 0 ? longTerm : shortTerm;

    if (relevantWindows.length === 0) continue;

    const providerCapacity = Math.min(...relevantWindows.map((window) => window.capacity));
    weightedCapacity += providerCapacity * summary.healthyAccounts;
    weightedAccounts += summary.healthyAccounts;
  }

  if (weightedAccounts === 0) {
    return { value: 0, label: noDataLabel, provider: "" };
  }

  return {
    value: weightedCapacity / weightedAccounts,
    label: weightedLabel,
    provider: "all",
  };
}

export default function QuotaPage() {
  const t = useTranslations("quota");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const query = useMemo(() => parseQuotaQueryState(searchParams), [searchParams]);

  const replaceQuery = (nextQuery: QuotaQueryState) => {
    const nextSearch = buildQuotaSearch(nextQuery);
    router.replace(`${pathname}${nextSearch}`, { scroll: false });
  };

  const fetchQuota = async (signal?: AbortSignal, bust = false) => {
    setLoading(true);
    try {
      const url = bust ? `${API_ENDPOINTS.QUOTA.BASE}?bust=${Date.now()}` : API_ENDPOINTS.QUOTA.BASE;
      const response = await fetch(url, { signal });
      if (response.ok) {
        const data = (await response.json()) as QuotaResponse;
        setQuotaData(data);
      }
    } catch {
      if (signal?.aborted) return;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchQuota(controller.signal);
    const interval = setInterval(() => fetchQuota(controller.signal), 120_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

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

  const overallCapacity = calcOverallCapacity(providerSummaries, t("noData"), t("weightedCapacity"));
  const isModelFirstOnlyView =
    filteredAccounts.length > 0 && filteredAccounts.every((account) => isModelFirstAccount(account));
  const modelFirstSummary = isModelFirstOnlyView ? summarizeModelFirstProvider(filteredAccounts) : null;
  const modelFirstQuotaUnverified = isModelFirstProviderQuotaUnverified(modelFirstSummary);
  const modelFirstWarnings = providerSummaries
    .filter((summary) => summary.monitorMode === "model-first" && summary.modelFirstSummary)
    .map((summary) => ({
      provider: summary.provider,
      summary: summary.modelFirstSummary!,
    }))
    .filter(({ summary }) => isModelFirstProviderQuotaUnverified(summary));

  const lowCapacityCount = providerSummaries.filter((summary) => {
    if (summary.monitorMode === "model-first") {
      return (summary.modelFirstSummary?.minRemainingFraction ?? 1) < 0.2 && summary.totalAccounts > 0;
    }
    return summary.windowCapacities.some((window) => window.capacity < 0.2) && summary.totalAccounts > 0;
  }).length;

  const toggleCard = (accountId: string) => {
    setExpandedCards((previous) => ({ ...previous, [accountId]: !previous[accountId] }));
  };

  const freshSnapshotCount = modelFirstSummary
    ? Math.max(0, modelFirstSummary.totalAccounts - modelFirstSummary.staleAccounts)
    : 0;

  const hasAnyAccounts = allAccounts.length > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t("pageTitle")}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {isModelFirstOnlyView ? t("modelFirstDescription") : t("pageDescription")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button onClick={() => fetchQuota(undefined, true)} disabled={loading} className="px-2.5 py-1 text-xs">
              {loading ? t("loadingText") : t("refreshButton")}
            </Button>
          </div>
        </div>
      </section>

      <QuotaToolbar
        query={query}
        total={filteredAccounts.length}
        onSearchChange={(value) => replaceQuery(buildQuotaToolbarQuery(query, { q: value }))}
        onProviderChange={(value) => replaceQuery(buildQuotaToolbarQuery(query, { provider: value }))}
        onStatusChange={(value) => replaceQuery(buildQuotaToolbarQuery(query, { status: value }))}
        onClear={() => replaceQuery(clearQuotaToolbarQuery())}
      />

      {loading && !quotaData ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">
          {t("loadingText")}
        </div>
      ) : (
        <>
          {modelFirstWarnings.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
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

          <section className={`grid grid-cols-2 gap-2 ${isModelFirstOnlyView ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("activeAccountsLabel")}</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{activeAccounts}</p>
            </div>
            {isModelFirstOnlyView && modelFirstSummary ? (
              <>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {modelFirstQuotaUnverified ? t("freshSnapshotsLabel") : t("readyAccountsLabel")}{" "}
                    <HelpTooltip
                      content={modelFirstQuotaUnverified ? t("freshSnapshotsTooltip") : t("readyAccountsTooltip")}
                    />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
                    {modelFirstQuotaUnverified ? freshSnapshotCount : modelFirstSummary.readyAccounts}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("staleSnapshotsLabel")} <HelpTooltip content={t("staleSnapshotsTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{modelFirstSummary.staleAccounts}</p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("closestResetLabel")} <HelpTooltip content={t("closestResetTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
                    {formatRelativeTime(modelFirstSummary.nextWindowResetAt, t)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("modelFamiliesLabel")} <HelpTooltip content={t("modelFamiliesTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{modelFirstSummary.groups.length}</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("overallCapacityLabel")} <HelpTooltip content={t("overallCapacityTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{Math.round(overallCapacity.value * 100)}%</p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("lowCapacityLabel")} <HelpTooltip content={t("lowCapacityTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{lowCapacityCount}</p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("providersLabel")}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{providerSummaries.length}</p>
                </div>
              </>
            )}
          </section>

          <QuotaChart
            overallCapacity={overallCapacity}
            providerSummaries={providerSummaries}
            modelFirstSummary={modelFirstSummary}
            modelFirstOnlyView={isModelFirstOnlyView}
          />

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
          />
        </>
      )}

      <QuotaAlerts />
    </div>
  );
}

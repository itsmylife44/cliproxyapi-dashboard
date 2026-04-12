"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/tooltip";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { isShortTermQuotaWindow } from "@/lib/quota-window-classification";
import {
  isModelFirstAccount,
  isModelFirstProviderQuotaUnverified,
  normalizeFraction,
  summarizeModelFirstProvider,
  type ModelFirstProviderSummary,
  type QuotaAccount,
  type QuotaMonitorMode,
  type QuotaResponse,
} from "@/lib/model-first-monitoring";
import { formatRelativeTime } from "@/lib/format-relative-time";

const QuotaChart = dynamic(
  () => import("@/components/quota/quota-chart").then((mod) => ({ default: mod.QuotaChart })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" /> }
);
import { QuotaDetails } from "@/components/quota/quota-details";
import { QuotaAlerts } from "@/components/quota/quota-alerts";

const PROVIDERS = {
  ALL: "all",
  ANTIGRAVITY: "antigravity",
  CLAUDE: "claude",
  CODEX: "codex",
  COPILOT: "github-copilot",
  KIMI: "kimi",
} as const;

type ProviderType = (typeof PROVIDERS)[keyof typeof PROVIDERS];

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
      modelFirstSummary: summarizeModelFirstProvider(accounts),
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

function calcOverallCapacity(summaries: ProviderSummary[], noDataLabel: string, weightedLabel: string): { value: number; label: string; provider: string } {
  if (summaries.length === 0) return { value: 0, label: noDataLabel, provider: "" };

  let weightedCapacity = 0;
  let weightedAccounts = 0;

  for (const summary of summaries) {
    if (summary.healthyAccounts === 0) {
      continue;
    }

    if (summary.monitorMode === "model-first" && summary.modelFirstSummary) {
      if (isModelFirstProviderQuotaUnverified(summary.modelFirstSummary)) {
        continue;
      }

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

    if (relevantWindows.length === 0) {
      continue;
    }

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
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(PROVIDERS.ALL);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

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

  const filteredAccounts =
    quotaData?.accounts.filter((account) => {
      if (selectedProvider === PROVIDERS.ALL) return true;
      if (selectedProvider === PROVIDERS.COPILOT) {
        return account.provider === "github" || account.provider === "github-copilot";
      }
      return account.provider === selectedProvider;
    }) ?? [];

  const activeAccounts = filteredAccounts.filter((account) => account.supported && !account.error).length;

  const providerGroups = new Map<string, QuotaAccount[]>();
  for (const account of filteredAccounts) {
    const existing = providerGroups.get(account.provider) ?? [];
    existing.push(account);
    providerGroups.set(account.provider, existing);
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

  const providerFilters = [
    { key: PROVIDERS.ALL, label: t("filterAll") },
    { key: PROVIDERS.ANTIGRAVITY, label: t("filterAntigravity") },
    { key: PROVIDERS.CLAUDE, label: t("filterClaude") },
    { key: PROVIDERS.CODEX, label: t("filterCodex") },
    { key: PROVIDERS.COPILOT, label: t("filterCopilot") },
    { key: PROVIDERS.KIMI, label: t("filterKimi") },
  ];

  const toggleCard = (accountId: string) => {
    setExpandedCards((previous) => ({ ...previous, [accountId]: !previous[accountId] }));
  };

  const freshSnapshotCount = modelFirstSummary
    ? Math.max(0, modelFirstSummary.totalAccounts - modelFirstSummary.staleAccounts)
    : 0;

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
            <div className="flex flex-wrap gap-1">
              {providerFilters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={selectedProvider === filter.key ? "secondary" : "ghost"}
                  onClick={() => {
                    setSelectedProvider(filter.key);
                    if (filter.key !== PROVIDERS.ALL) {
                      setTimeout(() => {
                        document
                          .getElementById("quota-accounts")
                          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }, 50);
                    }
                  }}
                  className="px-2.5 py-1 text-xs"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <Button onClick={() => fetchQuota(undefined, true)} disabled={loading} className="px-2.5 py-1 text-xs">
              {loading ? t("loadingText") : t("refreshButton")}
            </Button>
          </div>
        </div>
      </section>

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
                    {t("staleSnapshotsLabel")}{" "}
                    <HelpTooltip content={t("staleSnapshotsTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{modelFirstSummary.staleAccounts}</p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("closestResetLabel")}{" "}
                    <HelpTooltip content={t("closestResetTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
                    {formatRelativeTime(modelFirstSummary.nextWindowResetAt, t)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("modelFamiliesLabel")}{" "}
                    <HelpTooltip content={t("modelFamiliesTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{modelFirstSummary.groups.length}</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("overallCapacityLabel")}{" "}
                    <HelpTooltip content={t("overallCapacityTooltip")} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{Math.round(overallCapacity.value * 100)}%</p>
                </div>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t("lowCapacityLabel")}{" "}
                    <HelpTooltip content={t("lowCapacityTooltip")} />
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
            filteredAccounts={filteredAccounts}
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

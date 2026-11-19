"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CHART_COLORS, formatCompact } from "@/components/ui/chart-theme";
import { useToast } from "@/components/ui/toast";
import { TimeFilter } from "@/components/usage/time-filter";
import { CostEstimation } from "@/components/usage/cost-estimation";
const UsageCharts = dynamic(
  () => import("@/components/usage/usage-charts").then(mod => ({ default: mod.UsageCharts })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" /> }
);
import { UsageRequestEvents, type RequestEvent } from "@/components/usage/usage-request-events";
import { UsageTable } from "@/components/usage/usage-table";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { formatUSD, loadCustomPricing, type ModelPrice } from "@/lib/model-pricing";
import {
  buildCostBreakdown,
  type ModelBreakdownEntry,
  type ProviderBreakdownEntry,
  type UsageKey,
} from "@/lib/usage-cost-breakdown";
import { cn } from "@/lib/utils";

import { useTranslations } from "next-intl";
interface KeyUsage extends UsageKey {
  username?: string;
  userId?: string;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
}

interface UsageData {
  keys: Record<string, KeyUsage>;
  totals: {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    uncachedInputTokens?: number;
    cachedTokens?: number;
    cacheWriteTokens?: number;
    outputTokens: number;
    successCount: number;
    failureCount: number;
  };
  period: { from: string; to: string };
  collectorStatus: { lastCollectedAt: string; lastStatus: string };
  bucketGranularity?: "hour" | "day";
  dailyBreakdown?: Array<{
    date: string;
    requests: number;
    tokens: number;
    inputTokens: number;
    uncachedInputTokens?: number;
    cachedTokens?: number;
    cacheWriteTokens?: number;
    outputTokens: number;
    success: number;
    failure: number;
  }>;
  modelBreakdown?: ModelBreakdownEntry[];
  providerBreakdown?: ProviderBreakdownEntry[];
  latencySeries?: Array<{
    timestamp: string;
    keyName: string;
    username?: string;
    model: string;
    provider?: string;
    latencyMs: number;
    failed: boolean;
  }>;
  latencySummary?: {
    sampleCount: number;
    averageMs: number;
    p95Ms: number;
    maxMs: number;
  };
  requestEvents?: RequestEvent[];
  truncated?: boolean;
}

interface UsageResponse {
  data: UsageData;
  isAdmin: boolean;
}

interface CollectionStatus {
  lastCollectedAt: string | null;
  lastStatus: string;
  errorMessage: string | null;
  recordsStored: number;
  isHealthy: boolean;
  consecutiveFailures: number;
}

type DateFilter = "today" | "7d" | "30d" | "all" | "custom";
type UsageSectionTab = "breakdown" | "cost" | "events";

function shouldPollDashboard(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(period: DateFilter, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = toLocalDateString(now);
  switch (period) {
    case "today": return { from: to, to };
    case "7d": {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { from: toLocalDateString(d), to };
    }
    case "30d": {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { from: toLocalDateString(d), to };
    }
    case "all": return { from: "2020-01-01", to: "2099-12-31" };
    case "custom": return { from: customFrom || to, to: customTo || to };
    default: return { from: "2020-01-01", to: "2099-12-31" };
  }
}

export default function UsagePage() {
  const t = useTranslations("usage");

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DateFilter>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustomRange, setAppliedCustomRange] = useState({ from: "", to: "" });
  const [activeTab, setActiveTab] = useState<UsageSectionTab>("cost");
  const { showToast } = useToast();
  const isFirstLoadRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [livePricing, setLivePricing] = useState<Record<string, ModelPrice>>({});
  const customPricing = useMemo(() => loadCustomPricing(), []);

  const costSummary = useMemo(() => {
    if (!usageData) return { totalCost: 0, pricedCount: 0, totalModels: 0 };
    const rows = buildCostBreakdown(usageData.keys, customPricing, livePricing);
    return {
      totalCost: rows.reduce((sum, entry) => sum + entry.estimatedCost, 0),
      pricedCount: rows.filter((entry) => entry.priced).length,
      totalModels: rows.length,
    };
  }, [usageData, customPricing, livePricing]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ENDPOINTS.USAGE.PRICING, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { pricing?: Record<string, ModelPrice> } | null) => {
        if (result?.pricing && !controller.signal.aborted) {
          setLivePricing(result.pricing);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchCollectionStatus() {
      try {
        const res = await fetch(API_ENDPOINTS.USAGE.COLLECTION_STATUS, { 
          signal: abortController.signal 
        });
        if (res.ok) {
          const status: CollectionStatus = await res.json();
          if (!abortController.signal.aborted) {
            setCollectionStatus(status);
          }
        }
      } catch {
        // Silently ignore collection status errors
      }
    }

    async function collectAndFetch(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const { from, to } = getDateRange(activeFilter, appliedCustomRange.from, appliedCustomRange.to);
        
        // Fetch both usage data and collection status in parallel
        const [usageRes] = await Promise.all([
          fetch(`/api/usage/history?from=${from}&to=${to}`, { signal: abortController.signal }),
          fetchCollectionStatus(),
        ]);

        if (!usageRes.ok) {
          showToast(t("toastLoadFailed"), "error");
          setLoading(false);
          return;
        }

        const json: UsageResponse = await usageRes.json();
        if (abortController.signal.aborted) return;
        setUsageData(json.data);
        setIsAdmin(json.isAdmin);
        setLoading(false);
      } catch {
        if (abortController.signal.aborted) return;
        showToast(t("toastNetworkError"), "error");
        setLoading(false);
      }
    }

    void collectAndFetch(isFirstLoadRef.current);
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
    }

    // Poll every 60 seconds for fresh usage data
    // This is much more responsive than the previous 5-minute interval
    intervalRef.current = setInterval(() => {
      if (!shouldPollDashboard()) return;
      void collectAndFetch(false);
    }, 60000);

    return () => {
      abortController.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeFilter, appliedCustomRange, showToast, t]);

  const handleFilterChange = (filter: DateFilter) => {
    if (filter !== activeFilter) {
      isFirstLoadRef.current = true;
      setActiveFilter(filter);
    }
  };

  const handleCustomDateChange = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      if (activeFilter !== "custom" || customFrom !== appliedCustomRange.from || customTo !== appliedCustomRange.to) {
        isFirstLoadRef.current = true;
        setAppliedCustomRange({ from: customFrom, to: customTo });
        setActiveFilter("custom");
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      if (isAdmin) {
        try {
          await fetch(API_ENDPOINTS.USAGE.COLLECT, { method: "POST" });
        } catch {
        }
      }

      const { from, to } = getDateRange(activeFilter, appliedCustomRange.from, appliedCustomRange.to);
      const res = await fetch(`/api/usage/history?from=${from}&to=${to}`);

      if (!res.ok) {
        showToast(t("toastLoadFailed"), "error");
        return;
      }

      const json: UsageResponse = await res.json();
      setUsageData(json.data);
      setIsAdmin(json.isAdmin);
    } catch {
      showToast(t("toastNetworkError"), "error");
    } finally {
      setRefreshing(false);
    }
  };

  function getCollectionStatusColor(status: CollectionStatus | null): string {
    if (!status || !status.lastCollectedAt) return "bg-gray-500";
    
    if (status.consecutiveFailures > 0) return "bg-red-500";
    
    const diff = Date.now() - new Date(status.lastCollectedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 10) return "bg-emerald-500";
    if (minutes < 30) return "bg-yellow-500";
    return "bg-red-500";
  }

  function getCollectionStatusText(status: CollectionStatus | null): string {
    if (!status || !status.lastCollectedAt) {
      return t("collectionNeverRan");
    }
    
    if (status.consecutiveFailures > 0) {
      return t("collectionFailed");
    }
    
    const diff = Date.now() - new Date(status.lastCollectedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return t("collectedJustNow");
    if (minutes < 60) return t("collectedMinutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("collectedHoursAgo", { count: hours });
    return t("collectedDaysAgo", { count: Math.floor(hours / 24) });
  }

  const hasInputOutputBreakdown = usageData && (
    usageData.totals.inputTokens > 0 ||
    usageData.totals.outputTokens > 0 ||
    (usageData.totals.cachedTokens ?? 0) > 0 ||
    (usageData.totals.cacheWriteTokens ?? 0) > 0
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('pageDescription')}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]">
          <span
            className="inline-flex items-center gap-1.5 text-[11px]"
            title={collectionStatus?.errorMessage || undefined}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${getCollectionStatusColor(collectionStatus)}`} />
            <span>{getCollectionStatusText(collectionStatus)}</span>
          </span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading || refreshing}
            aria-label={t("refreshButton")}
            title={t("refreshButton")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
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

      <TimeFilter
        activeFilter={activeFilter}
        customFrom={customFrom}
        customTo={customTo}
        onFilterChange={handleFilterChange}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onCustomDateApply={handleCustomDateChange}
      />

      {loading ? (
        <div className="border-t border-[var(--surface-border)] py-10 text-center text-sm text-[var(--text-muted)]">
          {t('loadingText')}
        </div>
      ) : !usageData ? (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-400">
          {t('errorLoadFailed')}
        </div>
      ) : usageData.totals.totalRequests === 0 ? (
        <p role="status" className="border-t border-[var(--surface-border)] py-10 text-center text-sm text-[var(--text-muted)]">
          {t("noUsageData")}
        </p>
      ) : (
        <div className="space-y-6">
          {usageData.truncated && (
            <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{t("truncatedOnServer")}</p>
          )}
          {/* ── Top Metric Strip (Requests · Tokens · Cost, Flat Ledger) ── */}
          <div className="grid grid-cols-1 gap-6 border-t border-[var(--surface-border)] pt-5 md:grid-cols-3 md:gap-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalRequests')}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
                {usageData.totals.totalRequests.toLocaleString()}
              </p>
              {(() => {
                const total = usageData.totals.totalRequests;
                const successPct = total > 0 ? (usageData.totals.successCount / total) * 100 : 0;
                const failPct = total > 0 ? (usageData.totals.failureCount / total) * 100 : 0;
                return (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      {successPct > 0 && (
                        <div className="h-full bg-emerald-500" style={{ width: `${successPct}%` }} />
                      )}
                      {failPct > 0 && (
                        <div className="h-full bg-rose-500" style={{ width: `${failPct}%` }} />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {usageData.totals.successCount.toLocaleString()} {t('successful')}
                        {total > 0 ? ` (${successPct.toFixed(1)}%)` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {usageData.totals.failureCount.toLocaleString()} {t('failedLabel')}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalTokens')}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
                {usageData.totals.totalTokens.toLocaleString()}
              </p>
              {hasInputOutputBreakdown && (() => {
                const inputVal = usageData.totals.uncachedInputTokens ?? usageData.totals.inputTokens;
                const cachedVal = usageData.totals.cachedTokens ?? 0;
                const cacheWriteVal = usageData.totals.cacheWriteTokens ?? 0;
                const outputVal = usageData.totals.outputTokens;
                const segmentSum = inputVal + cachedVal + cacheWriteVal + outputVal;
                const segments = [
                  { key: "input", label: t("input"), value: inputVal, color: CHART_COLORS.primary },
                  { key: "cached", label: t("cached"), value: cachedVal, color: CHART_COLORS.violet },
                  ...(cacheWriteVal > 0
                    ? [{ key: "cacheWrite", label: t("cacheWrite"), value: cacheWriteVal, color: CHART_COLORS.warning }]
                    : []),
                  { key: "output", label: t("output"), value: outputVal, color: CHART_COLORS.success },
                ];
                return (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      {segmentSum > 0 && segments.map((seg) => (
                        <div
                          key={seg.key}
                          className="h-full"
                          style={{
                            width: `${(seg.value / segmentSum) * 100}%`,
                            backgroundColor: seg.color,
                          }}
                          title={`${seg.label}: ${seg.value.toLocaleString()}`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-[var(--text-secondary)]">
                      {segments.map((seg) => (
                        <span key={seg.key} className="inline-flex items-center gap-1.5" title={seg.value.toLocaleString()}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className="text-[var(--text-muted)]">{seg.label}</span>
                          <span className="font-medium text-[var(--text-primary)]">{formatCompact(seg.value)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('estimatedCost')}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatUSD(costSummary.totalCost)}
              </p>
              <p className="mt-2.5 text-xs tabular-nums text-[var(--text-muted)]">
                {costSummary.pricedCount}/{costSummary.totalModels} {t("pricedModels")}
              </p>
            </div>
          </div>

          <UsageTable keys={usageData.keys} isAdmin={isAdmin} livePricing={livePricing} />

          <section className="space-y-4 border-t border-[var(--surface-border)] pt-5">
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--surface-border)]">
              {(
                [
                  { id: "cost", label: t("usageTabCost") },
                  { id: "breakdown", label: t("usageTabBreakdown") },
                  { id: "events", label: t("usageTabEvents") },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                      isActive
                        ? "border-[var(--accent)] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "breakdown" && (
              <UsageCharts
                dailyBreakdown={usageData.dailyBreakdown}
                bucketGranularity={usageData.bucketGranularity}
                latencySeries={usageData.latencySeries}
                latencySummary={usageData.latencySummary}
                modelBreakdown={usageData.modelBreakdown}
                providerBreakdown={usageData.providerBreakdown}
              />
            )}

            {activeTab === "cost" && (
              <CostEstimation
                keys={usageData.keys}
                livePricing={livePricing}
                modelBreakdown={usageData.modelBreakdown}
                providerBreakdown={usageData.providerBreakdown}
              />
            )}

            {activeTab === "events" && (
              <UsageRequestEvents
                events={usageData.requestEvents}
                isAdmin={isAdmin}
                livePricing={livePricing}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

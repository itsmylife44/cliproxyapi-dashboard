"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TimeFilter } from "@/components/usage/time-filter";
const UsageCharts = dynamic(
  () => import("@/components/usage/usage-charts").then(mod => ({ default: mod.UsageCharts })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" /> }
);
const CostEstimation = dynamic(
  () => import("@/components/usage/cost-estimation").then(mod => ({ default: mod.CostEstimation })),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-muted)]" /> }
);
import { UsageRequestEvents } from "@/components/usage/usage-request-events";
import { UsageTable } from "@/components/usage/usage-table";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

import { useTranslations } from "next-intl";
interface KeyUsage {
  keyName: string;
  username?: string;
  userId?: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
  models: Record<string, {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

interface UsageData {
  keys: Record<string, KeyUsage>;
  totals: {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    successCount: number;
    failureCount: number;
  };
  period: { from: string; to: string };
  collectorStatus: { lastCollectedAt: string; lastStatus: string };
  dailyBreakdown?: Array<{
    date: string;
    requests: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    success: number;
    failure: number;
  }>;
  modelBreakdown?: Array<{
    model: string;
    requests: number;
    tokens: number;
  }>;
  latencySeries?: Array<{
    timestamp: string;
    keyName: string;
    username?: string;
    model: string;
    latencyMs: number;
    failed: boolean;
  }>;
  latencySummary?: {
    sampleCount: number;
    averageMs: number;
    p95Ms: number;
    maxMs: number;
  };
  requestEvents?: Array<{
    timestamp: string;
    keyName: string;
    username?: string;
    model: string;
    latencyMs: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    failed: boolean;
  }>;
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
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { from: toLocalDateString(d), to };
    }
    case "30d": {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { from: toLocalDateString(d), to };
    }
    case "all": return { from: "2020-01-01", to: "2099-12-31" };
    case "custom": return { from: customFrom || to, to: customTo || to };
    default: return { from: "2020-01-01", to: "2099-12-31" };
  }
}

function formatLatencyValue(value: number): string {
  return `${value.toLocaleString()} ms`;
}

export default function UsagePage() {
  const t = useTranslations("usage");

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggeringCollection, setTriggeringCollection] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DateFilter>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { showToast } = useToast();
  const isFirstLoadRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        const { from, to } = getDateRange(activeFilter, customFrom, customTo);
        
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

    intervalRef.current = setInterval(() => {
      if (!shouldPollDashboard()) return;
      void collectAndFetch(false);
    }, 300000);

    return () => {
      abortController.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeFilter, customFrom, customTo, showToast, t]);

  const handleFilterChange = (filter: DateFilter) => {
    setActiveFilter(filter);
    isFirstLoadRef.current = true;
  };

  const handleCustomDateChange = () => {
    if (customFrom && customTo) {
      handleFilterChange("custom");
    }
  };

  const handleTriggerCollection = async () => {
    if (!isAdmin || triggeringCollection) return;
    
    setTriggeringCollection(true);
    try {
      const res = await fetch(API_ENDPOINTS.USAGE.COLLECT, { method: "POST" });
      if (res.ok) {
        showToast(t("collectionTriggered"), "success");
        // Refresh collection status after a short delay
        setTimeout(async () => {
          try {
            const statusRes = await fetch(API_ENDPOINTS.USAGE.COLLECTION_STATUS);
            if (statusRes.ok) {
              const status: CollectionStatus = await statusRes.json();
              setCollectionStatus(status);
            }
          } catch {
            // Silently ignore
          }
        }, 2000);
      } else {
        showToast(t("collectionFailedToast"), "error");
      }
    } catch {
      showToast(t("collectionFailedToast"), "error");
    } finally {
      setTriggeringCollection(false);
    }
  };

  const handleRefresh = async () => {
    isFirstLoadRef.current = true;
    setLoading(true);

    try {
      if (isAdmin) {
        try {
          await fetch(API_ENDPOINTS.USAGE.COLLECT, { method: "POST" });
        } catch {
        }
      }

      const { from, to } = getDateRange(activeFilter, customFrom, customTo);
      const res = await fetch(`/api/usage/history?from=${from}&to=${to}`);

      if (!res.ok) {
        showToast(t("toastLoadFailed"), "error");
        setLoading(false);
        return;
      }

      const json: UsageResponse = await res.json();
      setUsageData(json.data);
      setIsAdmin(json.isAdmin);
      setLoading(false);
    } catch {
      showToast(t("toastNetworkError"), "error");
      setLoading(false);
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

  const hasInputOutputBreakdown = usageData && (usageData.totals.inputTokens > 0 || usageData.totals.outputTokens > 0);
  const hasLatencyBreakdown = (usageData?.latencySummary?.sampleCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t('pageTitle')}</h1>
            <div className="mt-1 flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getCollectionStatusColor(collectionStatus)}`}></div>
              <p className="text-xs text-[var(--text-muted)]">
                {t('collectionStatus')}: {getCollectionStatusText(collectionStatus)}
              </p>
              {collectionStatus?.errorMessage && (
                <span className="text-xs text-rose-600" title={collectionStatus.errorMessage}>
                  ⚠️
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button 
                variant="secondary"
                onClick={handleTriggerCollection} 
                disabled={triggeringCollection || loading}
              >
                {triggeringCollection ? t("triggering") : t("triggerCollection")}
              </Button>
            )}
            <Button onClick={handleRefresh} disabled={loading}>
              {t('refreshButton')}
            </Button>
          </div>
        </div>
      </section>

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
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">
          {t('loadingText')}
        </div>
      ) : !usageData ? (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700">
          {t('errorLoadFailed')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalRequests')}</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.totalRequests.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('successful')}</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-700">{usageData.totals.successCount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('failedLabel')}</p>
              <p className="mt-0.5 text-xs font-semibold text-rose-600">{usageData.totals.failureCount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalTokens')}</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.totalTokens.toLocaleString()}</p>
            </div>
          </div>

          {hasInputOutputBreakdown && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('inputTokens')}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.inputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('outputTokens')}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.outputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalTokens')}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.totalTokens.toLocaleString()}</p>
              </div>
            </div>
          )}

          {hasLatencyBreakdown && usageData?.latencySummary ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('avgLatency')}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{formatLatencyValue(usageData.latencySummary.averageMs)}</p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700/70">P95 Latency</p>
                <p className="mt-0.5 text-xs font-semibold text-amber-800">{formatLatencyValue(usageData.latencySummary.p95Ms)}</p>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-600">{t('slowestRequest')}</p>
                <p className="mt-0.5 text-xs font-semibold text-rose-800">{formatLatencyValue(usageData.latencySummary.maxMs)}</p>
              </div>
            </div>
          ) : null}

          <CostEstimation
            keys={usageData.keys}
          />

          <UsageCharts
            dailyBreakdown={usageData.dailyBreakdown}
            modelBreakdown={usageData.modelBreakdown}
            latencySeries={usageData.latencySeries}
            latencySummary={usageData.latencySummary}
            totals={usageData.totals}
          />

          <UsageTable keys={usageData.keys} isAdmin={isAdmin} />
          <UsageRequestEvents events={usageData.requestEvents} isAdmin={isAdmin} truncated={usageData.truncated} />
        </>
      )}
    </div>
  );
}

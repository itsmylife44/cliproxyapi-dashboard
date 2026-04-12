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

function getRelativeTime(isoString: string): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getStatusColor(isoString: string): string {
  if (!isoString) return "bg-red-500/100";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 10) return "bg-emerald-500/100";
  if (minutes < 30) return "bg-yellow-500/100";
  return "bg-red-500/100";
}

function formatLatencyValue(value: number): string {
  return `${value.toLocaleString()} ms`;
}

export default function UsagePage() {
  const t = useTranslations("usage");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<DateFilter>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { showToast } = useToast();
  const isFirstLoadRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function collectAndFetch(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const { from, to } = getDateRange(activeFilter, customFrom, customTo);
        const res = await fetch(`/api/usage/history?from=${from}&to=${to}`, { signal: abortController.signal });

        if (!res.ok) {
          showToast("Failed to load usage data", "error");
          setLoading(false);
          return;
        }

        const json: UsageResponse = await res.json();
        if (abortController.signal.aborted) return;
        setUsageData(json.data);
        setIsAdmin(json.isAdmin);
        setLoading(false);
      } catch {
        if (abortController.signal.aborted) return;
        showToast("Network error", "error");
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
  }, [activeFilter, customFrom, customTo, showToast]);

  const handleFilterChange = (filter: DateFilter) => {
    setActiveFilter(filter);
    isFirstLoadRef.current = true;
  };

  const handleCustomDateChange = () => {
    if (customFrom && customTo) {
      handleFilterChange("custom");
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
        showToast("Failed to load usage data", "error");
        setLoading(false);
        return;
      }

      const json: UsageResponse = await res.json();
      setUsageData(json.data);
      setIsAdmin(json.isAdmin);
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  };

  const hasInputOutputBreakdown = usageData && (usageData.totals.inputTokens > 0 || usageData.totals.outputTokens > 0);
  const hasLatencyBreakdown = (usageData?.latencySummary?.sampleCount ?? 0) > 0;
  const collectorStatusColor = usageData ? getStatusColor(usageData.collectorStatus.lastCollectedAt) : "bg-gray-500";
  const collectorTimeAgo = usageData ? getRelativeTime(usageData.collectorStatus.lastCollectedAt) : "Unknown";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Usage Statistics</h1>
            <div className="mt-1 flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${collectorStatusColor}`}></div>
              <p className="text-xs text-[var(--text-muted)]">Last synced: {collectorTimeAgo}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
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
          Loading statistics...
        </div>
      ) : !usageData ? (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700">
          Unable to load usage statistics
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Total Requests</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.totalRequests.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Successful</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-700">{usageData.totals.successCount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Failed</p>
              <p className="mt-0.5 text-xs font-semibold text-rose-600">{usageData.totals.failureCount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Total Tokens</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.totalTokens.toLocaleString()}</p>
            </div>
          </div>

          {hasInputOutputBreakdown && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Input Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.inputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Output Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.outputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Total Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{usageData.totals.totalTokens.toLocaleString()}</p>
              </div>
            </div>
          )}

          {hasLatencyBreakdown && usageData?.latencySummary ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Avg Latency</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{formatLatencyValue(usageData.latencySummary.averageMs)}</p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700/70">P95 Latency</p>
                <p className="mt-0.5 text-xs font-semibold text-amber-800">{formatLatencyValue(usageData.latencySummary.p95Ms)}</p>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-600">Slowest Request</p>
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

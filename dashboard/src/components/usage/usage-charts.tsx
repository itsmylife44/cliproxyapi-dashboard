"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CHART_COLORS, useChartTheme, formatCompact, formatDateShort } from "@/components/ui/chart-theme";
import {
  inferModelProvider,
  type ModelBreakdownEntry,
  type ProviderBreakdownEntry,
} from "@/lib/usage-cost-breakdown";

interface DailyBreakdown {
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
}

interface LatencyPoint {
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  provider?: string;
  latencyMs: number;
  failed: boolean;
}

interface LatencySummary {
  sampleCount: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
}

interface UsageChartsProps {
  mode?: "latency" | "failures";
  dailyBreakdown?: DailyBreakdown[];
  bucketGranularity?: "hour" | "day";
  latencySeries?: LatencyPoint[];
  latencySummary?: LatencySummary;
  modelBreakdown?: ModelBreakdownEntry[];
  providerBreakdown?: ProviderBreakdownEntry[];
}

type BreakdownMetric = "tokens" | "requests";
type ProviderSortMode = "p95" | "avg";

function formatBucketTick(value: string, isHourly: boolean): string {
  if (isHourly && value.includes("T")) {
    const dt = new Date(value);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }
  return formatDateShort(value.slice(0, 10));
}

function formatBucketTooltip(value: string, isHourly: boolean): string {
  if (isHourly && value.includes("T")) {
    const dt = new Date(value);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  }
  return formatDateShort(value.slice(0, 10));
}

function formatLatencyTick(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatLatencyLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLatencyValue(value: number): string {
  return `${Math.round(value).toLocaleString()} ms`;
}

function formatDurationCompact(ms: number): string {
  if (ms <= 0) return "\u2014";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function truncateAxisLabel(value: string, maxLen = 18): string {
  const str = String(value);
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}\u2026` : str;
}

function LayeredLatencyBar({
  avgPct,
  p95Pct,
  p95Color,
}: {
  avgPct: number;
  p95Pct: number;
  p95Color: string;
}) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
      <div
        className="absolute inset-y-0 left-0 rounded-full opacity-45"
        style={{ width: `${Math.max(p95Pct, 2)}%`, backgroundColor: p95Color }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.max(avgPct, 1.5)}%`, backgroundColor: CHART_COLORS.primary }}
      />
    </div>
  );
}

export function UsageCharts({
  mode = "latency",
  dailyBreakdown,
  bucketGranularity,
  latencySeries,
  latencySummary,
  modelBreakdown,
  providerBreakdown,
}: UsageChartsProps) {
  const t = useTranslations("usage");
  const uid = useId();
  const [metric, setMetric] = useState<BreakdownMetric>("tokens");
  const [providerSort, setProviderSort] = useState<ProviderSortMode>("p95");
  const [expandedFailureModels, setExpandedFailureModels] = useState<Set<string>>(() => new Set());
  const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
  const gradInputId = `${uid}-gradInput`;
  const gradCachedId = `${uid}-gradCached`;
  const gradCacheWriteId = `${uid}-gradCacheWrite`;
  const gradOutputId = `${uid}-gradOutput`;
  const gradLatencyId = `${uid}-gradLatency`;

  const toggleFailureModel = (model: string) => {
    setExpandedFailureModels((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  const series = useMemo(
    () =>
      (dailyBreakdown ?? []).map((entry) => ({
        ...entry,
        uncachedInputTokens: entry.uncachedInputTokens ?? entry.inputTokens,
        cachedTokens: entry.cachedTokens ?? 0,
        cacheWriteTokens: entry.cacheWriteTokens ?? 0,
      })),
    [dailyBreakdown]
  );

  const normalizedModels = useMemo(() => {
    return (modelBreakdown ?? []).map((item) => {
      const requests = item.requests ?? 0;
      const failureCount = item.failureCount ?? 0;
      const successCount = item.successCount ?? Math.max(0, requests - failureCount);
      const failureRate =
        item.failureRate ?? (requests > 0 ? Number(((failureCount / requests) * 100).toFixed(1)) : 0);
      return {
        model: item.model,
        provider: inferModelProvider(item.model, item.provider),
        requests,
        tokens: item.tokens ?? 0,
        successCount,
        failureCount,
        failureRate,
        failureReasons: item.failureReasons ?? [],
        avgLatencyMs: item.avgLatencyMs ?? 0,
        p95LatencyMs: item.p95LatencyMs ?? item.avgLatencyMs ?? 0,
        maxLatencyMs: item.maxLatencyMs ?? item.p95LatencyMs ?? item.avgLatencyMs ?? 0,
        latencySampleCount: item.latencySampleCount ?? 0,
      };
    });
  }, [modelBreakdown]);

  const sortedProviders = useMemo(() => {
    const list = [...(providerBreakdown ?? [])];
    if (providerSort === "avg") {
      return list.sort((a, b) => b.avgLatencyMs - a.avgLatencyMs || b.p95LatencyMs - a.p95LatencyMs || b.requests - a.requests);
    }
    return list.sort((a, b) => b.p95LatencyMs - a.p95LatencyMs || b.avgLatencyMs - a.avgLatencyMs || b.requests - a.requests);
  }, [providerBreakdown, providerSort]);

  const slowestModels = useMemo(() => {
    return [...normalizedModels]
      .filter((m) => m.p95LatencyMs > 0 || m.avgLatencyMs > 0)
      .sort((a, b) => b.p95LatencyMs - a.p95LatencyMs || b.avgLatencyMs - a.avgLatencyMs || b.requests - a.requests)
      .slice(0, 8);
  }, [normalizedModels]);

  const failingModels = useMemo(() => {
    return [...normalizedModels]
      .filter((m) => m.failureCount > 0)
      .sort((a, b) => b.failureCount - a.failureCount || b.failureRate - a.failureRate || b.requests - a.requests);
  }, [normalizedModels]);

  const failureTotals = useMemo(() => {
    let totalRequests = 0;
    let totalFailures = 0;
    for (const m of normalizedModels) {
      totalRequests += m.requests;
      totalFailures += m.failureCount;
    }
    const overallRate = totalRequests > 0 ? Number(((totalFailures / totalRequests) * 100).toFixed(1)) : 0;
    return { totalRequests, totalFailures, overallRate };
  }, [normalizedModels]);

  const slowestProvider = useMemo(() => {
    return [...(providerBreakdown ?? [])]
      .filter((p) => p.p95LatencyMs > 0 || p.avgLatencyMs > 0)
      .sort((a, b) => b.p95LatencyMs - a.p95LatencyMs || b.avgLatencyMs - a.avgLatencyMs)[0] ?? null;
  }, [providerBreakdown]);

  const slowestModel = slowestModels[0] ?? null;
  const topProblemModel = failingModels[0] ?? null;

  const isHourly = bucketGranularity === "hour" || series.some((d) => d.date.includes("T"));
  const hasCacheWrites = series.some((d) => d.cacheWriteTokens > 0);
  const hasBreakdown = series.length > 0;
  const hasLatency = Boolean(latencySeries && latencySeries.length > 0);
  const hasProviderDiagnostics = sortedProviders.length > 0;
  const hasModelDiagnostics = normalizedModels.length > 0;

  if (!hasBreakdown && !hasLatency && !hasProviderDiagnostics && !hasModelDiagnostics) {
    return <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("noUsageData")}</p>;
  }

  const maxProviderLatency = Math.max(
    1,
    ...sortedProviders.map((p) => Math.max(p.p95LatencyMs, p.avgLatencyMs))
  );
  const maxSlowModelLatency = Math.max(
    1,
    ...slowestModels.map((m) => Math.max(m.p95LatencyMs, m.avgLatencyMs))
  );

  if (mode === "failures") {
    const chartFailingModels = failingModels.slice(0, 10);
    const chartHeight = Math.max(170, Math.min(300, chartFailingModels.length * 32 + 36));

    return (
      <div className="space-y-6">
        {/* ── Failure Triage Spotlight ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Card 1: Top Problem Model */}
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("topProblemModel")}
            </p>
            {topProblemModel ? (
              <div className="mt-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]"
                    title={topProblemModel.model}
                  >
                    {topProblemModel.model}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {t("failureRateLabel", { rate: topProblemModel.failureRate })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                  <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-1.5 py-0 text-[10px] text-[var(--text-secondary)]">
                    {topProblemModel.provider}
                  </span>
                  <span>
                    {t("failedRequestsCount", {
                      failed: topProblemModel.failureCount.toLocaleString(),
                      total: topProblemModel.requests.toLocaleString(),
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {t("allModelsHealthy")}
              </p>
            )}
          </div>

          {/* Card 2: Total Failed Requests */}
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("totalFailedRequests")}
            </p>
            <div className="mt-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {failureTotals.totalFailures.toLocaleString()}
                </span>
                <span
                  className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${
                    failureTotals.totalFailures > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {t("failureRateLabel", { rate: failureTotals.overallRate })}
                </span>
              </div>
              <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
                {t("failedRequestsCount", {
                  failed: failureTotals.totalFailures.toLocaleString(),
                  total: failureTotals.totalRequests.toLocaleString(),
                })}
              </p>
            </div>
          </div>

          {/* Card 3: Affected Models */}
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("affectedModels")}
            </p>
            <div className="mt-1 space-y-1">
              <p className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                {failingModels.length.toLocaleString()}
              </p>
              <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
                {t("affectedModelsCount", {
                  failed: failingModels.length.toLocaleString(),
                  total: normalizedModels.length.toLocaleString(),
                })}
              </p>
            </div>
          </div>
        </div>

        {failingModels.length > 0 ? (
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {t("failingModelsTitle")}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">{t("failureReasonsHint")}</p>
            </div>

            <div style={{ height: chartHeight }} className="w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                initialDimension={{ width: 320, height: chartHeight }}
              >
                <BarChart
                  layout="vertical"
                  data={chartFailingModels}
                  margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} horizontal={false} />
                  <YAxis
                    type="category"
                    dataKey="model"
                    width={140}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => truncateAxisLabel(String(v), 20)}
                  />
                  <XAxis
                    type="number"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCompact}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name) => [Number(value).toLocaleString(), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: tokens.text.muted }} />
                  <Bar
                    dataKey="failureCount"
                    name={t("failed")}
                    stackId="health"
                    fill={CHART_COLORS.rose}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey="successCount"
                    name={t("success")}
                    stackId="health"
                    fill={CHART_COLORS.success}
                    radius={[0, 3, 3, 0]}
                    maxBarSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Expandable Per-Model Failure Breakdown */}
            <div className="divide-y divide-[var(--surface-border)]/60 border-t border-b border-[var(--surface-border)]">
              {failingModels.map((m) => {
                const isExpanded = expandedFailureModels.has(m.model);
                const reasons = m.failureReasons;

                return (
                  <div key={m.model}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleFailureModel(m.model)}
                      className="w-full cursor-pointer space-y-1.5 px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="inline-block w-3 shrink-0 text-[10px] text-[var(--text-muted)]"
                          >
                            {isExpanded ? "\u25BC" : "\u25B6"}
                          </span>
                          <span
                            className="truncate font-mono text-[11px] font-medium text-[var(--text-primary)]"
                            title={m.model}
                          >
                            {m.model}
                          </span>
                          <span className="shrink-0 rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0 text-[10px] text-[var(--text-secondary)]">
                            {m.provider}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
                          <span className="text-[var(--text-muted)]">
                            {t("failedRequestsCount", {
                              failed: m.failureCount.toLocaleString(),
                              total: m.requests.toLocaleString(),
                            })}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0 text-[10px] font-semibold ${
                              m.failureRate >= 15
                                ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {t("failureRateLabel", { rate: m.failureRate })}
                          </span>
                        </div>
                      </div>
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${Math.min(100, Math.max(m.failureRate, 2))}%` }}
                        />
                        <div
                          className="h-full bg-emerald-500/50"
                          style={{ width: `${Math.max(0, 100 - m.failureRate)}%` }}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[var(--surface-border)]/50 bg-[var(--surface-muted)]/35 px-4 py-2.5">
                        {reasons.length > 0 ? (
                          <ul className="divide-y divide-[var(--surface-border)]/50">
                            {reasons.map((reason) => {
                              const hasDetail = Boolean(reason.status || reason.code || reason.message || reason.cancelled);
                              return (
                                <li key={reason.key} className="space-y-1 py-2 first:pt-0 last:pb-0">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">
                                        {t("failureOccurrences", { count: reason.count.toLocaleString() })}
                                      </span>
                                      {reason.cancelled ? (
                                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                          {t("cancelled")}
                                          {reason.status ? ` \u00B7 ${reason.status}` : ""}
                                        </span>
                                      ) : reason.status ? (
                                        <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                          HTTP {reason.status}
                                        </span>
                                      ) : (
                                        <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                          {t("unknownStatus")}
                                        </span>
                                      )}
                                      {reason.code ? (
                                        <span className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                                          {reason.code}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {reason.message ? (
                                    <p className="break-words font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                      {reason.message}
                                    </p>
                                  ) : !hasDetail ? (
                                    <p className="text-[11px] text-[var(--text-muted)]">
                                      {t("errorDetailsUnavailable")}
                                    </p>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-[var(--text-muted)]">{t("errorDetailsUnavailable")}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="py-10 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {t("allModelsHealthy")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Latency Triage Spotlight (Slowest Provider · Slowest Model) ── */}
      {(slowestProvider || slowestModel) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Card 1: Slowest Provider */}
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("slowestProvider")}
            </p>
            {slowestProvider ? (
              <div className="mt-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {slowestProvider.provider}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {t("p95Latency")} {formatDurationCompact(slowestProvider.p95LatencyMs)}
                  </span>
                </div>
                <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
                  {t("avgLatency")} <strong className="font-medium text-[var(--text-secondary)]">{formatDurationCompact(slowestProvider.avgLatencyMs)}</strong>
                  {" · "}
                  {t("providerStats", {
                    models: slowestProvider.models,
                    requests: formatCompact(slowestProvider.requests),
                  })}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t("noLatencySamples")}</p>
            )}
          </div>

          {/* Card 2: Slowest Model */}
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("slowestModel")}
            </p>
            {slowestModel ? (
              <div className="mt-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]"
                    title={slowestModel.model}
                  >
                    {slowestModel.model}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {t("p95Latency")} {formatDurationCompact(slowestModel.p95LatencyMs)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                  <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-1.5 py-0 text-[10px] text-[var(--text-secondary)]">
                    {slowestModel.provider}
                  </span>
                  <span>
                    {t("avgLatency")} <strong className="font-medium text-[var(--text-secondary)]">{formatDurationCompact(slowestModel.avgLatencyMs)}</strong>
                  </span>
                  <span>·</span>
                  <span>{formatCompact(slowestModel.requests)} {t("requests").toLowerCase()}</span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t("noLatencySamples")}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Primary Latency Charts: Provider Speed & Slowest Models ── */}
      {(hasProviderDiagnostics || hasModelDiagnostics) && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Provider Speed */}
          {hasProviderDiagnostics && (
            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {t("providerSpeedOnlyTitle")}
                </h2>
                <div
                  role="group"
                  aria-label={t("providerSpeedOnlyTitle")}
                  className="inline-flex rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
                >
                  {(
                    [
                      { id: "p95", label: t("p95Latency") },
                      { id: "avg", label: t("avgLatency") },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={providerSort === item.id}
                      onClick={() => setProviderSort(item.id)}
                      className={`cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        providerSort === item.id
                          ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-xs"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct-Comparison Provider Latency Rows (single layered bar: Avg overlaid on P95) */}
              <div className="divide-y divide-[var(--surface-border)]/60 border-t border-[var(--surface-border)]">
                {sortedProviders.map((prov) => {
                  const p95Pct = Math.min(100, (prov.p95LatencyMs / maxProviderLatency) * 100);
                  const avgPct = Math.min(100, (prov.avgLatencyMs / maxProviderLatency) * 100);
                  return (
                    <div key={prov.provider} className="space-y-1.5 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-[var(--text-primary)]">
                            {prov.provider}
                          </span>
                          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                            {t("providerStats", {
                              models: prov.models,
                              requests: formatCompact(prov.requests),
                            })}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
                          <span className="font-mono text-[var(--text-secondary)]">
                            {t("avgLatency")} <strong className="text-[var(--text-primary)]">{formatDurationCompact(prov.avgLatencyMs)}</strong>
                          </span>
                          <span className="font-mono text-amber-700 dark:text-amber-400">
                            {t("p95Latency")} <strong>{formatDurationCompact(prov.p95LatencyMs)}</strong>
                          </span>
                        </div>
                      </div>
                      {(prov.p95LatencyMs > 0 || prov.avgLatencyMs > 0) && (
                        <LayeredLatencyBar
                          avgPct={avgPct}
                          p95Pct={p95Pct}
                          p95Color={prov.p95LatencyMs >= 20_000 ? CHART_COLORS.rose : CHART_COLORS.warning}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Right: Slowest Models */}
          {hasModelDiagnostics && (
            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {t("slowestModelsTitle")}
                </h2>
              </div>

              {slowestModels.length > 0 ? (
                <div className="divide-y divide-[var(--surface-border)]/60 border-t border-[var(--surface-border)]">
                  {slowestModels.map((m) => {
                    const p95Pct = Math.min(100, (m.p95LatencyMs / maxSlowModelLatency) * 100);
                    const avgPct = Math.min(100, (m.avgLatencyMs / maxSlowModelLatency) * 100);
                    return (
                      <div key={m.model} className="space-y-1.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="truncate font-mono text-[11px] font-medium text-[var(--text-primary)]"
                              title={m.model}
                            >
                              {m.model}
                            </span>
                            <span className="shrink-0 rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0 text-[10px] text-[var(--text-secondary)]">
                              {m.provider}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
                            <span className="font-mono text-[var(--text-secondary)]">
                              {t("avgLatency")} <strong className="text-[var(--text-primary)]">{formatDurationCompact(m.avgLatencyMs)}</strong>
                            </span>
                            <span className="font-mono text-rose-600 dark:text-rose-400">
                              {t("p95Latency")} <strong>{formatDurationCompact(m.p95LatencyMs)}</strong>
                            </span>
                          </div>
                        </div>
                        <LayeredLatencyBar avgPct={avgPct} p95Pct={p95Pct} p95Color={CHART_COLORS.rose} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-[var(--text-muted)]">{t("noLatencySamples")}</p>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Time-Series Volume & Recent Request Latency Pulse ── */}
      {(hasBreakdown || hasLatency) && (
        <div
          className={`grid grid-cols-1 gap-8 border-t border-[var(--surface-border)] pt-6 ${
            hasBreakdown && hasLatency ? "lg:grid-cols-2" : ""
          }`}
        >
          {/* Unified Usage Breakdown (Tokens | Requests) */}
          {hasBreakdown && (
            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {t("usageBreakdown")}
                </h2>
                <div
                  role="group"
                  aria-label={t("usageBreakdown")}
                  className="inline-flex rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
                >
                  <button
                    type="button"
                    aria-pressed={metric === "tokens"}
                    onClick={() => setMetric("tokens")}
                    className={`cursor-pointer rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      metric === "tokens"
                        ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t("tokens")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={metric === "requests"}
                    onClick={() => setMetric("requests")}
                    className={`cursor-pointer rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      metric === "requests"
                        ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t("requests")}
                  </button>
                </div>
              </div>

              <div style={{ height: 236 }} className="w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={0}
                  initialDimension={{ width: 320, height: 236 }}
                >
                {metric === "requests" ? (
                  <BarChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatBucketTick(String(v), isHourly)}
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(label) => formatBucketTooltip(String(label), isHourly)}
                      formatter={(value, name) => [formatCompact(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: tokens.text.muted }} />
                    <Bar
                      dataKey="success"
                      name={t("success")}
                      stackId="req"
                      fill={CHART_COLORS.success}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="failure"
                      name={t("failed")}
                      stackId="req"
                      fill={CHART_COLORS.rose}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                ) : series.length === 1 ? (
                  <BarChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatBucketTick(String(v), isHourly)}
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(label) => formatBucketTooltip(String(label), isHourly)}
                      formatter={(value, name) => [formatCompact(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: tokens.text.muted }} />
                    <Bar dataKey="uncachedInputTokens" name={t("input")} stackId="tok" fill={CHART_COLORS.primary} maxBarSize={32} />
                    <Bar dataKey="cachedTokens" name={t("cached")} stackId="tok" fill={CHART_COLORS.violet} maxBarSize={32} />
                    {hasCacheWrites ? (
                      <Bar dataKey="cacheWriteTokens" name={t("cacheWrite")} stackId="tok" fill={CHART_COLORS.warning} maxBarSize={32} />
                    ) : null}
                    <Bar
                      dataKey="outputTokens"
                      name={t("output")}
                      stackId="tok"
                      fill={CHART_COLORS.success}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                ) : (
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradInputId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id={gradCachedId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.violet} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART_COLORS.violet} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id={gradCacheWriteId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.warning} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART_COLORS.warning} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id={gradOutputId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatBucketTick(String(v), isHourly)}
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(label) => formatBucketTooltip(String(label), isHourly)}
                      formatter={(value, name) => [formatCompact(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: tokens.text.muted }} />
                    <Area
                      type="monotone"
                      dataKey="uncachedInputTokens"
                      name={t("input")}
                      stackId="1"
                      stroke={CHART_COLORS.primary}
                      fill={`url(#${gradInputId})`}
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="cachedTokens"
                      name={t("cached")}
                      stackId="1"
                      stroke={CHART_COLORS.violet}
                      fill={`url(#${gradCachedId})`}
                      strokeWidth={1.5}
                    />
                    {hasCacheWrites ? (
                      <Area
                        type="monotone"
                        dataKey="cacheWriteTokens"
                        name={t("cacheWrite")}
                        stackId="1"
                        stroke={CHART_COLORS.warning}
                        fill={`url(#${gradCacheWriteId})`}
                        strokeWidth={1.5}
                      />
                    ) : null}
                    <Area
                      type="monotone"
                      dataKey="outputTokens"
                      name={t("output")}
                      stackId="1"
                      stroke={CHART_COLORS.success}
                      fill={`url(#${gradOutputId})`}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                )}
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Request Latency Timeline (with inline Avg / P95 / Max) */}
          {hasLatency && latencySeries && (
            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {t("requestLatency")}
                </h2>
                {latencySummary && latencySummary.sampleCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                    <span className="text-[var(--text-secondary)]">
                      {t("avgLatency")}:{" "}
                      <strong className="font-semibold text-[var(--text-primary)]">
                        {formatLatencyValue(latencySummary.averageMs)}
                      </strong>
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">
                      P95: <strong className="font-semibold">{formatLatencyValue(latencySummary.p95Ms)}</strong>
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {t("slowestRequest")}:{" "}
                      <strong className="font-semibold">{formatLatencyValue(latencySummary.maxMs)}</strong>
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">{t("recentRequestsLatency")}</span>
                )}
              </div>

              <div style={{ height: 236 }} className="w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={0}
                  initialDimension={{ width: 320, height: 236 }}
                >
                <AreaChart data={latencySeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradLatencyId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.warning} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART_COLORS.warning} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatLatencyTick}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    tickFormatter={(value) => formatDurationCompact(Number(value))}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(label, payload) => {
                      const point = payload?.[0]?.payload as LatencyPoint | undefined;
                      const status = point == null ? t("unknownProvider") : point.failed ? t("failed") : t("success");
                      const providerPrefix = point?.provider ? `${point.provider} · ` : "";
                      return `${formatLatencyLabel(String(label))} • ${providerPrefix}${point?.model ?? t("unknownProvider")} • ${status}`;
                    }}
                    formatter={(value) => [formatLatencyValue(Number(value)), t("latency")]}
                  />
                  {latencySummary && latencySummary.p95Ms > 0 ? (
                    <ReferenceLine
                      y={latencySummary.p95Ms}
                      stroke={CHART_COLORS.rose}
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                    />
                  ) : null}
                  <Area
                    type="monotone"
                    dataKey="latencyMs"
                    name={t("latency")}
                    stroke={CHART_COLORS.warning}
                    fill={`url(#${gradLatencyId})`}
                    strokeWidth={2}
                    activeDot={{ r: 4, fill: CHART_COLORS.warning }}
                  />
                </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

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
  dailyBreakdown?: DailyBreakdown[];
  bucketGranularity?: "hour" | "day";
  latencySeries?: LatencyPoint[];
  latencySummary?: LatencySummary;
}

type BreakdownMetric = "tokens" | "requests";

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
      return dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
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

export function UsageCharts({
  dailyBreakdown,
  bucketGranularity,
  latencySeries,
  latencySummary,
}: UsageChartsProps) {
  const t = useTranslations("usage");
  const uid = useId();
  const [metric, setMetric] = useState<BreakdownMetric>("tokens");
  const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
  const gradInputId = `${uid}-gradInput`;
  const gradCachedId = `${uid}-gradCached`;
  const gradCacheWriteId = `${uid}-gradCacheWrite`;
  const gradOutputId = `${uid}-gradOutput`;
  const gradLatencyId = `${uid}-gradLatency`;

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

  const isHourly = bucketGranularity === "hour" || series.some((d) => d.date.includes("T"));
  const hasCacheWrites = series.some((d) => d.cacheWriteTokens > 0);
  const hasBreakdown = series.length > 0;
  const hasLatency = Boolean(latencySeries && latencySeries.length > 0);

  if (!hasBreakdown && !hasLatency) return <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("noUsageData")}</p>;

  return (
    <div className={`grid grid-cols-1 gap-8 ${hasBreakdown && hasLatency ? "lg:grid-cols-2" : ""}`}>
      {/* ── Unified Usage Breakdown (Tokens | Requests) ───── */}
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

          <ResponsiveContainer width="100%" height={236} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 220 }}>
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
                <Bar dataKey="success" name={t("success")} stackId="req" fill={CHART_COLORS.success} radius={[0, 0, 0, 0]} maxBarSize={24} />
                <Bar dataKey="failure" name={t("failed")} stackId="req" fill={CHART_COLORS.rose} radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            ) : series.length === 1 ? (
              <BarChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => formatBucketTick(String(v), isHourly)} tick={axisTickStyle} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(label) => formatBucketTooltip(String(label), isHourly)}
                  formatter={(value, name) => [formatCompact(Number(value)), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: tokens.text.muted }} />
                <Bar dataKey="uncachedInputTokens" name={t("input")} stackId="tok" fill={CHART_COLORS.primary} maxBarSize={32} />
                <Bar dataKey="cachedTokens" name={t("cached")} stackId="tok" fill={CHART_COLORS.violet} maxBarSize={32} />
                {hasCacheWrites ? <Bar dataKey="cacheWriteTokens" name={t("cacheWrite")} stackId="tok" fill={CHART_COLORS.warning} maxBarSize={32} /> : null}
                <Bar dataKey="outputTokens" name={t("output")} stackId="tok" fill={CHART_COLORS.success} radius={[3, 3, 0, 0]} maxBarSize={32} />
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
                <Area type="monotone" dataKey="uncachedInputTokens" name={t("input")} stackId="1" stroke={CHART_COLORS.primary} fill={`url(#${gradInputId})`} strokeWidth={1.5} />
                <Area type="monotone" dataKey="cachedTokens" name={t("cached")} stackId="1" stroke={CHART_COLORS.violet} fill={`url(#${gradCachedId})`} strokeWidth={1.5} />
                {hasCacheWrites ? (
                  <Area type="monotone" dataKey="cacheWriteTokens" name={t("cacheWrite")} stackId="1" stroke={CHART_COLORS.warning} fill={`url(#${gradCacheWriteId})`} strokeWidth={1.5} />
                ) : null}
                <Area type="monotone" dataKey="outputTokens" name={t("output")} stackId="1" stroke={CHART_COLORS.success} fill={`url(#${gradOutputId})`} strokeWidth={1.5} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Request Latency (with inline Avg / P95 / Max) ─── */}
      {hasLatency && latencySeries && (
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("requestLatency")}
            </h2>
            {latencySummary && latencySummary.sampleCount > 0 ? (
              <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                <span className="text-[var(--text-secondary)]">
                  {t("avgLatency")}: <strong className="font-semibold text-[var(--text-primary)]">{formatLatencyValue(latencySummary.averageMs)}</strong>
                </span>
                <span className="text-amber-700 dark:text-amber-400">
                  P95: <strong className="font-semibold">{formatLatencyValue(latencySummary.p95Ms)}</strong>
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  {t("slowestRequest")}: <strong className="font-semibold">{formatLatencyValue(latencySummary.maxMs)}</strong>
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)]">{t("recentRequestsLatency")}</span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={236} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 220 }}>
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
                tickFormatter={(value) => `${formatCompact(Number(value))}ms`}
                tick={axisTickStyle}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(label, payload) => {
                  const point = payload?.[0]?.payload as LatencyPoint | undefined;
                  const status = point == null ? t("unknownProvider") : point.failed ? t("failed") : t("success");
                  return `${formatLatencyLabel(String(label))} • ${point?.model ?? t("unknownProvider")} • ${status}`;
                }}
                formatter={(value) => [formatLatencyValue(Number(value)), t("latency")]}
              />
              {latencySummary && latencySummary.p95Ms > 0 ? (
                <ReferenceLine y={latencySummary.p95Ms} stroke={CHART_COLORS.rose} strokeDasharray="4 4" ifOverflow="extendDomain" />
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
        </section>
      )}
    </div>
  );
}

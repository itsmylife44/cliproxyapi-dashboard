"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { ChartContainer, CHART_COLORS, SERIES_PALETTE, useChartTheme, formatCompact, formatDateShort } from "@/components/ui/chart-theme";

interface DailyBreakdown {
  date: string;
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  success: number;
  failure: number;
}

interface ModelBreakdown {
  model: string;
  requests: number;
  tokens: number;
}

interface Totals {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  successCount: number;
  failureCount: number;
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
  modelBreakdown?: ModelBreakdown[];
  latencySeries?: LatencyPoint[];
  latencySummary?: LatencySummary;
  totals: Totals;
}

function formatLatencyTick(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
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

export function UsageCharts({ dailyBreakdown, modelBreakdown, latencySeries, latencySummary, totals }: UsageChartsProps) {
   const t = useTranslations('usage');
   const uid = useId();
   const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
   const gradInputId = `${uid}-gradInput`;
   const gradOutputId = `${uid}-gradOutput`;
   const gradLatencyId = `${uid}-gradLatency`;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {dailyBreakdown && dailyBreakdown.length > 0 ? (
        <ChartContainer title={t('dailyRequests')}>
          <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
             <LineChart data={dailyBreakdown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
               <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} />
               <XAxis dataKey="date" tickFormatter={formatDateShort} tick={axisTickStyle} tickLine={false} axisLine={false} />
               <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
               <Tooltip
                 {...tooltipStyle}
                 labelFormatter={(label) => formatDateShort(label)}
                 formatter={(value) => [formatCompact(Number(value)), t('requestsLabel')]}
               />
              <Line type="monotone" dataKey="requests" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      ) : null}

      {dailyBreakdown && dailyBreakdown.length > 0 ? (
        <ChartContainer title={t('tokenUsage')}>
          <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
            <AreaChart data={dailyBreakdown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id={gradInputId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={gradOutputId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                </linearGradient>
              </defs>
               <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} />
               <XAxis dataKey="date" tickFormatter={formatDateShort} tick={axisTickStyle} tickLine={false} axisLine={false} />
               <YAxis tickFormatter={formatCompact} tick={axisTickStyle} tickLine={false} axisLine={false} />
               <Tooltip
                 {...tooltipStyle}
                 labelFormatter={(label) => formatDateShort(label)}
                 formatter={(value) => [formatCompact(Number(value)), ""]}
               />
              <Legend wrapperStyle={{ fontSize: 10, color: tokens.text.muted }} />
              <Area type="monotone" dataKey="inputTokens" name={t('input')} stackId="1" stroke={CHART_COLORS.primary} fill={`url(#${gradInputId})`} strokeWidth={1.5} />
              <Area type="monotone" dataKey="outputTokens" name={t('output')} stackId="1" stroke={CHART_COLORS.success} fill={`url(#${gradOutputId})`} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      ) : null}

      {latencySeries && latencySeries.length > 0 ? (
        <ChartContainer
          title={t('requestLatency')}
          subtitle={
            latencySummary && latencySummary.sampleCount > 0
              ? `Avg ${formatLatencyValue(latencySummary.averageMs)} • P95 ${formatLatencyValue(latencySummary.p95Ms)} • Max ${formatLatencyValue(latencySummary.maxMs)}`
              : t('recentRequestsLatency')
          }
        >
          <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
            <AreaChart data={latencySeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={gradLatencyId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.warning} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.warning} stopOpacity={0} />
                </linearGradient>
              </defs>
               <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} />
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
                   const status = point == null ? t('unknownProvider') : point.failed ? t('failed') : t('success');
                   return `${formatLatencyLabel(label)} • ${point?.model ?? t('unknownProvider')} • ${status}`;
                 }}
                 formatter={(value) => [formatLatencyValue(Number(value)), t('latency')]}
               />
              {latencySummary && latencySummary.p95Ms > 0 ? (
                <ReferenceLine y={latencySummary.p95Ms} stroke={CHART_COLORS.rose} strokeDasharray="4 4" ifOverflow="extendDomain" />
              ) : null}
              <Area
                type="monotone"
                dataKey="latencyMs"
                name={t('latency')}
                stroke={CHART_COLORS.warning}
                fill={`url(#${gradLatencyId})`}
                strokeWidth={2}
                activeDot={{ r: 4, fill: CHART_COLORS.warning }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      ) : null}

      {modelBreakdown && modelBreakdown.length > 0 ? (() => {
        const sorted = [...modelBreakdown].sort((a, b) => b.requests - a.requests);
        const top6 = sorted.slice(0, 6);
        const rest = sorted.slice(6);
        const otherRequests = rest.reduce((s, m) => s + m.requests, 0);
        const pieData = otherRequests > 0
          ? [...top6, { model: t('other'), requests: otherRequests, tokens: 0 }]
          : top6;
        return (
          <ChartContainer title={t('modelDistribution')}>
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="requests"
                  nameKey="model"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.model} fill={SERIES_PALETTE[index % SERIES_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                   {...tooltipStyle}
                   formatter={(value) => [formatCompact(Number(value)), t('requestsLabel')]}
                 />
                <Legend
                  wrapperStyle={{ fontSize: 10, color: tokens.text.muted }}
                  formatter={(value) => value.length > 20 ? value.slice(0, 18) + "\u2026" : value}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        );
      })() : null}

      {totals.totalRequests > 0 ? (() => {
        const total = totals.successCount + totals.failureCount;
        const successPct = total > 0 ? (totals.successCount / total) * 100 : 0;
        const failPct = total > 0 ? (totals.failureCount / total) * 100 : 0;
        return (
          <ChartContainer title={t('successFailureRatio')}>
            <div className="flex h-[220px] flex-col justify-center gap-4 px-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-semibold text-emerald-600">{totals.successCount.toLocaleString()} {t('success')}</span>
                <span className="font-semibold text-rose-600">{totals.failureCount.toLocaleString()} {t('failed')}</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="flex h-full">
                  {successPct > 0 && (
                    <div
                       className="h-full bg-emerald-500/100 transition-[width] duration-700"
                      style={{ width: `${successPct}%` }}
                    />
                  )}
                  {failPct > 0 && (
                    <div
                       className="h-full bg-rose-500/100 transition-[width] duration-700"
                      style={{ width: `${failPct}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/100/10 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('successRate')}</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-600">{successPct.toFixed(1)}%</p>
                </div>
                <div className="rounded-md border border-rose-500/20 bg-rose-500/100/10 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('failureRate')}</p>
                  <p className="mt-0.5 text-lg font-bold text-rose-600">{failPct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </ChartContainer>
        );
      })() : null}
    </div>
  );
}

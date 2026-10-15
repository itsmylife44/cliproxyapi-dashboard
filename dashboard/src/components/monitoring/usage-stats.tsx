"use client";

import { useTranslations } from "next-intl";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, SERIES_PALETTE, useChartTheme, formatCompact } from "@/components/ui/chart-theme";

/** The subset of the `/api/usage/history` `data` payload this panel shows. */
export interface UsageSummary {
  totals: {
    totalRequests: number;
    totalTokens: number;
    successCount: number;
    failureCount: number;
  };
  modelBreakdown: { model: string; requests: number; tokens: number }[];
}

interface UsageStatsProps {
  usage: UsageSummary | null;
}

export function UsageStats({ usage }: UsageStatsProps) {
   const t = useTranslations('monitoring');
   const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
   const modelStats = usage?.modelBreakdown ?? [];

  return (
    <section className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('usageStatsTitle')}</h2>
         {usage ? (
           <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalRequests')}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
                  {(usage.totals.totalRequests ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('successLabel')}</p>
                <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                  {(usage.totals.successCount ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('failedLabel')}</p>
                <p className="mt-0.5 text-xs font-semibold text-rose-600">
                  {(usage.totals.failureCount ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('totalTokens')}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
                {(usage.totals.totalTokens ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            {modelStats.length > 0 ? (
              <ChartContainer title={t('requestsByModel')}>
                <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                  <BarChart
                    layout="vertical"
                    data={modelStats}
                    margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                  >
                     <CartesianGrid horizontal={false} stroke={tokens.grid} />
                     <YAxis
                       type="category"
                       dataKey="model"
                       tick={axisTickStyle}
                       width={80}
                       tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "\u2026" : v}
                     />
                     <XAxis
                       type="number"
                       tick={axisTickStyle}
                       tickFormatter={formatCompact}
                     />
                     <Tooltip
                       {...tooltipStyle}
                       formatter={(value) => [formatCompact(value as number), "Requests"]}
                     />
                    <Bar dataKey="requests" radius={[0, 3, 3, 0]}>
                      {modelStats.map((_, i) => (
                        <Cell key={i} fill={SERIES_PALETTE[i % SERIES_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : null}

          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">{t('loadingUsageStats')}</div>
        )}
    </section>
  );
}

"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, SERIES_PALETTE, useChartTheme, formatCompact } from "@/components/ui/chart-theme";
import { loadCustomPricing, formatUSD, type ModelPrice } from "@/lib/model-pricing";
import {
  buildCostBreakdown,
  aggregateByProvider,
  formatRate,
  type UsageKey,
} from "@/lib/usage-cost-breakdown";

/* ── Types ────────────────────────────────────────────────── */

interface CostEstimationProps {
  keys: Record<string, UsageKey>;
  livePricing?: Record<string, ModelPrice>;
}

/* ── Helpers ──────────────────────────────────────────────── */

function truncateModelName(name: string, maxLen = 28): string {
  // Strip common prefixes
  const clean = name.replace(/^cliproxyapi\//, "");
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + "\u2026" : clean;
}

/* ── Component ────────────────────────────────────────────── */

export function CostEstimation({ keys, livePricing }: CostEstimationProps) {
   const t = useTranslations('usage');
   const { axisTickStyle, tooltipStyle } = useChartTheme();
   const mergedPricing = useMemo(() => ({ ...(livePricing ?? {}), ...loadCustomPricing() }), [livePricing]);
   const costBreakdown = useMemo(() => buildCostBreakdown(keys, mergedPricing), [keys, mergedPricing]);
   const providerBreakdown = useMemo(() => aggregateByProvider(costBreakdown), [costBreakdown]);
   const totalEstimatedCost = useMemo(() => costBreakdown.reduce((sum, e) => sum + e.estimatedCost, 0), [costBreakdown]);
   const unpricedModels = useMemo(() => costBreakdown.filter(e => !e.priced), [costBreakdown]);
   const pricedModels = useMemo(() => costBreakdown.filter(e => e.priced), [costBreakdown]);

  // Top models for bar chart (max 8)
  const topModelChart = useMemo(() =>
    pricedModels.slice(0, 8).map(e => ({
      name: truncateModelName(e.model),
      cost: Number(e.estimatedCost.toFixed(4)),
      fullName: e.model,
      provider: e.provider,
    })),
    [pricedModels]
  );

  if (costBreakdown.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* ── Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700/70">{t('estimatedCost')}</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-700">{formatUSD(totalEstimatedCost)}</p>
        </div>
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('pricedModels')}</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{pricedModels.length} / {costBreakdown.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('providersLabel')}</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{providerBreakdown.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ── Cost by Model Bar Chart ──────────────────────── */}
        {topModelChart.length > 0 && (
          <ChartContainer title={t('costByModel')} subtitle={t('costByModelSubtitle')}>
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
              <BarChart data={topModelChart} margin={{ top: 4, right: 8, left: -8, bottom: 0 }} layout="vertical">
               <XAxis
                   type="number"
                   tickFormatter={(v) => formatUSD(v)}
                   tick={axisTickStyle}
                   tickLine={false}
                   axisLine={false}
                 />
                 <YAxis
                   type="category"
                   dataKey="name"
                   width={110}
                   tick={{ ...axisTickStyle, fontSize: 9 }}
                   tickLine={false}
                   axisLine={false}
                 />
                 <Tooltip
                   {...tooltipStyle}
                   formatter={(value) => [formatUSD(Number(value)), t('estCostHeader')]}
                   labelFormatter={(_label, payload) => {
                     const item = payload?.[0]?.payload as { fullName: string; provider: string } | undefined;
                     return `${item?.fullName ?? _label} (${item?.provider ?? t('unknownProvider')})`;
                   }}
                 />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {topModelChart.map((entry) => (
                    <Cell key={entry.fullName} fill={SERIES_PALETTE[topModelChart.indexOf(entry) % SERIES_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}

        {/* ── Provider Breakdown ──────────────────────────── */}
        {providerBreakdown.length > 0 && (
          <ChartContainer title={t('costByProvider')} subtitle={t('costByProviderSubtitle')}>
            <div className="flex h-[220px] flex-col justify-center gap-2 px-1">
              {providerBreakdown.map((prov, index) => {
                const pct = totalEstimatedCost > 0 ? (prov.estimatedCost / totalEstimatedCost) * 100 : 0;
                const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
                return (
                  <div key={prov.provider} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text-secondary)]">{prov.provider}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{formatUSD(prov.estimatedCost)} <span className="font-normal text-[var(--text-muted)]">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">{t('providerStats', { models: prov.models, requests: formatCompact(prov.requests) })}</p>
                  </div>
                );
              })}
            </div>
          </ChartContainer>
        )}
      </div>

      {/* ── Detailed Model Table ────────────────────────────── */}
      <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
        <div className="border-b border-[var(--surface-border)] px-4 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('modelCostDetails')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-muted)]">
                <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t('modelHeader')}</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t('providerHeader')}</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)]">{t('requestsHeader')}</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)]">{t('inputTokensHeader')}</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)]">{t('cachedTokensHeader')}</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)]">{t('outputTokensHeader')}</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)]">{t('rateHeader')}</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)]">{t('estCostHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {pricedModels.map((entry) => (
                <tr key={entry.model} className="hover:bg-[var(--surface-muted)] transition-colors">
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)] max-w-[200px] truncate" title={entry.model}>{entry.model}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{entry.provider}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{entry.requests.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{formatCompact(entry.inputTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{formatCompact(entry.cachedTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{formatCompact(entry.outputTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">
                    {entry.priced ? formatRate(entry) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{formatUSD(entry.estimatedCost)}</td>
                </tr>
              ))}
              {unpricedModels.length > 0 && (
                <>
                  <tr>
                    <td colSpan={8} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] bg-[var(--surface-muted)]">
                      {t('unpricedModels')} ({unpricedModels.length})
                    </td>
                  </tr>
                  {unpricedModels.map((entry) => (
                    <tr key={entry.model} className="opacity-50">
                      <td className="px-3 py-1.5 text-[var(--text-muted)] max-w-[200px] truncate" title={entry.model}>{entry.model}</td>
                      <td className="px-3 py-1.5 text-[var(--text-muted)]">—</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">{entry.requests.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">{formatCompact(entry.inputTokens)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">{formatCompact(entry.cachedTokens)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">{formatCompact(entry.outputTokens)}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">—</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">—</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--surface-border)] bg-[var(--surface-muted)]">
                <td colSpan={7} className="px-3 py-2 font-semibold text-[var(--text-primary)]">{t('totalEstimatedCost')}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700 text-sm">{formatUSD(totalEstimatedCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t border-[var(--surface-border)] px-4 py-2 text-[10px] text-[var(--text-muted)]">
          💡 {t('costDisclaimerPart1')}{' '}
          {t('costDisclaimerPart2')} <code className="bg-[var(--surface-muted)] px-1 rounded text-[9px]">cliproxy-custom-pricing</code>.{' '}
          {t('costDisclaimerPart3')}
        </div>
      </div>
    </div>
  );
}

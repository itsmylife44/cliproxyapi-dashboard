"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, SERIES_PALETTE, useChartTheme, formatCompact } from "@/components/ui/chart-theme";
import {
  resolveModelPrice,
  calculateCost,
  loadCustomPricing,
  formatUSD,
  type ModelPrice,
} from "@/lib/model-pricing";

/* ── Types ────────────────────────────────────────────────── */

interface KeyUsage {
  keyName: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  models: Record<string, {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

interface CostEstimationProps {
  keys: Record<string, KeyUsage>;
}

/* ── Helpers ──────────────────────────────────────────────── */

interface ModelCostEntry {
  model: string;
  displayName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  estimatedCost: number;
  inputPer1M: number;
  outputPer1M: number;
  priced: boolean;
}

interface ProviderCostEntry {
  provider: string;
  estimatedCost: number;
  models: number;
  requests: number;
}

function buildCostBreakdown(keys: Record<string, KeyUsage>, customPricing: Record<string, ModelPrice>): ModelCostEntry[] {
  // Aggregate all models across all keys
  const modelAgg: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number; requests: number }> = {};

  for (const key of Object.values(keys)) {
    for (const [model, data] of Object.entries(key.models)) {
      if (!modelAgg[model]) {
        modelAgg[model] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
      }
      modelAgg[model].inputTokens += data.inputTokens;
      modelAgg[model].outputTokens += data.outputTokens;
      modelAgg[model].totalTokens += data.totalTokens;
      modelAgg[model].requests += data.totalRequests;
    }
  }

  return Object.entries(modelAgg)
    .map(([model, data]) => {
      const price = resolveModelPrice(model, customPricing);
      const estimatedCost = price ? calculateCost(data.inputTokens, data.outputTokens, price) : 0;
      return {
        model,
        displayName: price?.displayName ?? model,
        provider: price?.provider ?? "Unknown",
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        requests: data.requests,
        estimatedCost,
        inputPer1M: price?.inputPer1M ?? 0,
        outputPer1M: price?.outputPer1M ?? 0,
        priced: price !== null,
      };
    })
    .sort((a, b) => b.estimatedCost - a.estimatedCost);
}

function aggregateByProvider(entries: ModelCostEntry[]): ProviderCostEntry[] {
  const providerMap: Record<string, ProviderCostEntry> = {};
  for (const entry of entries) {
    if (!entry.priced) continue;
    let provider = providerMap[entry.provider];
    if (!provider) {
      provider = { provider: entry.provider, estimatedCost: 0, models: 0, requests: 0 };
      providerMap[entry.provider] = provider;
    }
    provider.estimatedCost += entry.estimatedCost;
    provider.models += 1;
    provider.requests += entry.requests;
  }
  return Object.values(providerMap).sort((a, b) => b.estimatedCost - a.estimatedCost);
}

function truncateModelName(name: string, maxLen = 28): string {
  // Strip common prefixes
  const clean = name.replace(/^cliproxyapi\//, "");
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + "\u2026" : clean;
}

/* ── Component ────────────────────────────────────────────── */

export function CostEstimation({ keys }: CostEstimationProps) {
   const t = useTranslations('usage');
   const { axisTickStyle, tooltipStyle } = useChartTheme();
   const customPricing = useMemo(() => loadCustomPricing(), []);
   const costBreakdown = useMemo(() => buildCostBreakdown(keys, customPricing), [keys, customPricing]);
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
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{formatCompact(entry.outputTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">
                    {entry.priced ? `${entry.inputPer1M}/${entry.outputPer1M}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{formatUSD(entry.estimatedCost)}</td>
                </tr>
              ))}
              {unpricedModels.length > 0 && (
                <>
                  <tr>
                    <td colSpan={7} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] bg-[var(--surface-muted)]">
                      {t('unpricedModels')} ({unpricedModels.length})
                    </td>
                  </tr>
                  {unpricedModels.map((entry) => (
                    <tr key={entry.model} className="opacity-50">
                      <td className="px-3 py-1.5 text-[var(--text-muted)] max-w-[200px] truncate" title={entry.model}>{entry.model}</td>
                      <td className="px-3 py-1.5 text-[var(--text-muted)]">—</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">{entry.requests.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">{formatCompact(entry.inputTokens)}</td>
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
                <td colSpan={6} className="px-3 py-2 font-semibold text-[var(--text-primary)]">{t('totalEstimatedCost')}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700 text-sm">{formatUSD(totalEstimatedCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t border-[var(--surface-border)] px-4 py-2 text-[10px] text-[var(--text-muted)]">
          💡 {t('costDisclaimerPart1')}{' '}
          {t('costDisclaimerPart2')} <code className="bg-[var(--surface-muted)] px-1 rounded text-[9px]">cliproxy-custom-pricing</code>.
        </div>
      </div>
    </div>
  );
}

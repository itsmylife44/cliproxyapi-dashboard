"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SERIES_PALETTE, formatCompact } from "@/components/ui/chart-theme";
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

type BreakdownTab = "models" | "providers";

/* ── Component ────────────────────────────────────────────── */

export function CostEstimation({ keys, livePricing }: CostEstimationProps) {
  const t = useTranslations("usage");
  const [activeTab, setActiveTab] = useState<BreakdownTab>("models");
  const [showUnpriced, setShowUnpriced] = useState(false);

  const customPricing = useMemo(() => loadCustomPricing(), []);
  const costBreakdown = useMemo(
    () => buildCostBreakdown(keys, customPricing, livePricing),
    [keys, customPricing, livePricing]
  );
  const providerBreakdown = useMemo(() => aggregateByProvider(costBreakdown), [costBreakdown]);
  const totalEstimatedCost = useMemo(
    () => costBreakdown.reduce((sum, e) => sum + e.estimatedCost, 0),
    [costBreakdown]
  );
  const unpricedModels = useMemo(() => costBreakdown.filter((e) => !e.priced), [costBreakdown]);
  const pricedModels = useMemo(() => costBreakdown.filter((e) => e.priced), [costBreakdown]);

  if (costBreakdown.length === 0) return null;

  const maxModelCost = pricedModels[0]?.estimatedCost ?? 0;
  const displayUnpriced = showUnpriced || pricedModels.length === 0;
  const topProviders = providerBreakdown.slice(0, 3);
  const extraProviderCount = Math.max(0, providerBreakdown.length - topProviders.length);

  return (
    <section className="space-y-4">
      {/* Inline Provider Composition Preview */}
      {totalEstimatedCost > 0 && providerBreakdown.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
            {providerBreakdown.map((prov, index) => {
              const pct = (prov.estimatedCost / totalEstimatedCost) * 100;
              if (pct <= 0) return null;
              return (
                <div
                  key={prov.provider}
                  className="h-full transition-[width] duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SERIES_PALETTE[index % SERIES_PALETTE.length],
                  }}
                  title={`${prov.provider}: ${formatUSD(prov.estimatedCost)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
            {topProviders.map((prov, index) => {
              const pct = (prov.estimatedCost / totalEstimatedCost) * 100;
              return (
                <span key={prov.provider} className="inline-flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SERIES_PALETTE[index % SERIES_PALETTE.length] }}
                  />
                  <span className="max-w-[110px] truncate font-medium">{prov.provider}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">{pct.toFixed(1)}%</span>
                </span>
              );
            })}
            {extraProviderCount > 0 && (
              <span className="text-[10px] tabular-nums text-[var(--text-muted)]">
                +{extraProviderCount}
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        {/* Toolbar: Single View Switch */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-2.5">
          <div
            role="tablist"
            aria-label={t("costBreakdownTitle")}
            className="inline-flex rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "models"}
              onClick={() => setActiveTab("models")}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === "models"
                  ? "bg-[var(--accent)] text-[var(--surface-base)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t("byModelTab")}{" "}
              <span className="ml-1 text-[10px] tabular-nums opacity-75">
                {pricedModels.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "providers"}
              onClick={() => setActiveTab("providers")}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === "providers"
                  ? "bg-[var(--accent)] text-[var(--surface-base)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t("byProviderTab")}{" "}
              <span className="ml-1 text-[10px] tabular-nums opacity-75">
                {providerBreakdown.length}
              </span>
            </button>
          </div>

          {activeTab === "models" && unpricedModels.length > 0 && pricedModels.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnpriced((prev) => !prev)}
              className="cursor-pointer rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              {showUnpriced
                ? t("hideUnpriced")
                : t("showUnpriced", { count: unpricedModels.length })}
            </button>
          )}
        </div>

            {/* Tab 1: Unified Model Cost Ledger */}
            {activeTab === "models" && (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[780px] text-xs">
                  <thead className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("modelHeader")}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("providerHeader")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("requestsHeader")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("input")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("cached")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("cacheWrite")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("output")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("rateHeader")}
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("estCostHeader")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]/60">
                    {pricedModels.map((entry, idx) => {
                      const relativeWidth =
                        maxModelCost > 0 ? Math.max((entry.estimatedCost / maxModelCost) * 100, entry.estimatedCost > 0 ? 2 : 0) : 0;
                      const sharePct =
                        totalEstimatedCost > 0 ? (entry.estimatedCost / totalEstimatedCost) * 100 : 0;
                      return (
                        <tr key={entry.model} className="transition-colors hover:bg-[var(--surface-muted)]/50">
                          <td className="px-4 py-2">
                            <div className="max-w-[220px] truncate font-mono text-[11px] font-medium text-[var(--text-primary)]" title={entry.model}>
                              {entry.model}
                            </div>
                            <div className="mt-1 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--surface-muted)]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, relativeWidth)}%`,
                                  backgroundColor: SERIES_PALETTE[idx % SERIES_PALETTE.length],
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                              {entry.provider}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                            {entry.requests.toLocaleString()}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]"
                            title={entry.inputTokens.toLocaleString()}
                          >
                            {formatCompact(entry.inputTokens)}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]"
                            title={entry.cachedTokens.toLocaleString()}
                          >
                            {formatCompact(entry.cachedTokens)}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]"
                            title={entry.cacheWriteTokens.toLocaleString()}
                          >
                            {formatCompact(entry.cacheWriteTokens)}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]"
                            title={entry.outputTokens.toLocaleString()}
                          >
                            {formatCompact(entry.outputTokens)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                            {entry.priced ? formatRate(entry) : "\u2014"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {formatUSD(entry.estimatedCost)}
                            </span>
                            {totalEstimatedCost > 0 && (
                              <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                                {sharePct.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {displayUnpriced && unpricedModels.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={9}
                            className="bg-[var(--surface-muted)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                          >
                            {t("unpricedModels")} ({unpricedModels.length})
                          </td>
                        </tr>
                        {unpricedModels.map((entry) => (
                          <tr key={entry.model} className="opacity-60">
                            <td className="max-w-[220px] truncate px-4 py-1.5 font-mono text-[11px] text-[var(--text-muted)]" title={entry.model}>
                              {entry.model}
                            </td>
                            <td className="px-3 py-1.5 text-[var(--text-muted)]">{"\u2014"}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]">
                              {entry.requests.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]" title={entry.inputTokens.toLocaleString()}>
                              {formatCompact(entry.inputTokens)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]" title={entry.cachedTokens.toLocaleString()}>
                              {formatCompact(entry.cachedTokens)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]" title={entry.cacheWriteTokens.toLocaleString()}>
                              {formatCompact(entry.cacheWriteTokens)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-muted)]" title={entry.outputTokens.toLocaleString()}>
                              {formatCompact(entry.outputTokens)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">{"\u2014"}</td>
                            <td className="px-4 py-1.5 text-right text-[var(--text-muted)]">{"\u2014"}</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Bounded Scrollable Provider Breakdown (never overflows box) */}
            {activeTab === "providers" && (
              <div className="max-h-[360px] divide-y divide-[var(--surface-border)]/60 overflow-y-auto px-4">
                {providerBreakdown.map((prov, index) => {
                  const pct = totalEstimatedCost > 0 ? (prov.estimatedCost / totalEstimatedCost) * 100 : 0;
                  const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
                  return (
                    <div key={prov.provider} className="space-y-1.5 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate font-medium text-[var(--text-primary)]">
                            {prov.provider}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
                            {t("providerStats", {
                              models: prov.models,
                              requests: formatCompact(prov.requests),
                            })}
                          </span>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatUSD(prov.estimatedCost)}
                          </span>
                          <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
                            ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(pct, pct > 0 ? 1.5 : 0))}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Concise Disclaimer Footer */}
            <div className="border-t border-[var(--surface-border)] pt-2 text-[10px] text-[var(--text-muted)]">
              {t("costDisclaimerPart1")}{" "}
              {t("costDisclaimerPart2")}{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1 text-[9px]">cliproxy-custom-pricing</code>.{" "}
              {t("costDisclaimerPart3")}
            </div>
      </div>
    </section>
  );
}

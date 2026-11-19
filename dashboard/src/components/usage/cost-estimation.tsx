"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CHART_COLORS, SERIES_PALETTE, formatCompact } from "@/components/ui/chart-theme";
import { loadCustomPricing, formatUSD, type ModelPrice } from "@/lib/model-pricing";
import {
  buildCostBreakdown,
  aggregateByProvider,
  formatRate,
  type ModelBreakdownEntry,
  type ProviderBreakdownEntry,
  type UsageKey,
} from "@/lib/usage-cost-breakdown";

/* ── Types ────────────────────────────────────────────────── */

interface CostEstimationProps {
  keys: Record<string, UsageKey>;
  livePricing?: Record<string, ModelPrice>;
  modelBreakdown?: ModelBreakdownEntry[];
  providerBreakdown?: ProviderBreakdownEntry[];
}

type BreakdownTab = "models" | "providers";
type LedgerSortMode = "cost" | "slowest" | "failures";

function formatDurationShort(ms: number | undefined): string {
  if (!ms || ms <= 0) return "\u2014";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function getLatencySeverityClasses(p95Ms: number, avgMs: number): string {
  const signal = p95Ms || avgMs;
  if (signal <= 0) return "border-[var(--surface-border)] bg-[var(--surface-muted)]/60 text-[var(--text-muted)]";
  if (signal >= 20_000 || avgMs >= 12_000) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  if (signal >= 5_000 || avgMs >= 3_000) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
}

function getFailureSeverityClasses(failureRate: number): string {
  if (failureRate >= 15) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

/* ── Component ────────────────────────────────────────────── */

export function CostEstimation({
  keys,
  livePricing,
  modelBreakdown,
  providerBreakdown: perfProviderBreakdown,
}: CostEstimationProps) {
  const t = useTranslations("usage");
  const [activeTab, setActiveTab] = useState<BreakdownTab>("models");
  const [sortMode, setSortMode] = useState<LedgerSortMode>("cost");
  const [showUnpriced, setShowUnpriced] = useState(true);

  const customPricing = useMemo(() => loadCustomPricing(), []);
  const costBreakdown = useMemo(
    () => buildCostBreakdown(keys, customPricing, livePricing),
    [keys, customPricing, livePricing]
  );

  const modelPerfById = useMemo(() => {
    const map = new Map<string, ModelBreakdownEntry>();
    for (const item of modelBreakdown ?? []) {
      map.set(item.model, item);
    }
    return map;
  }, [modelBreakdown]);

  const providerPerfByName = useMemo(() => {
    const map = new Map<string, ProviderBreakdownEntry>();
    for (const item of perfProviderBreakdown ?? []) {
      map.set(item.provider, item);
    }
    return map;
  }, [perfProviderBreakdown]);

  const providerCostList = useMemo(
    () => aggregateByProvider(costBreakdown),
    [costBreakdown]
  );

  const enrichedProviders = useMemo(() => {
    const rows = providerCostList.map((prov) => {
      const perf = providerPerfByName.get(prov.provider);
      return {
        ...prov,
        avgLatencyMs: perf?.avgLatencyMs ?? 0,
        p95LatencyMs: perf?.p95LatencyMs ?? 0,
        maxLatencyMs: perf?.maxLatencyMs ?? 0,
        failureCount: perf?.failureCount ?? 0,
        failureRate: perf?.failureRate ?? 0,
      };
    });

    if (sortMode === "slowest") {
      return [...rows].sort(
        (a, b) => b.p95LatencyMs - a.p95LatencyMs || b.avgLatencyMs - a.avgLatencyMs || b.requests - a.requests
      );
    }
    if (sortMode === "failures") {
      return [...rows].sort(
        (a, b) => b.failureCount - a.failureCount || b.failureRate - a.failureRate || b.requests - a.requests
      );
    }
    return rows;
  }, [providerCostList, providerPerfByName, sortMode]);

  const totalEstimatedCost = useMemo(
    () => costBreakdown.reduce((sum, e) => sum + e.estimatedCost, 0),
    [costBreakdown]
  );

  const enrichedModels = useMemo(
    () =>
      costBreakdown.map((entry) => {
        const perf = modelPerfById.get(entry.model);
        return {
          ...entry,
          avgLatencyMs: perf?.avgLatencyMs ?? 0,
          p95LatencyMs: perf?.p95LatencyMs ?? 0,
          maxLatencyMs: perf?.maxLatencyMs ?? 0,
          failureCount: perf?.failureCount ?? 0,
          failureRate: perf?.failureRate ?? 0,
        };
      }),
    [costBreakdown, modelPerfById]
  );

  const unpricedModels = useMemo(() => enrichedModels.filter((e) => !e.priced), [enrichedModels]);
  const pricedModels = useMemo(() => enrichedModels.filter((e) => e.priced), [enrichedModels]);

  if (costBreakdown.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("noUsageData")}</p>;
  }

  const displayUnpriced = showUnpriced || pricedModels.length === 0 || sortMode !== "cost";

  const visibleModels = (() => {
    const base = displayUnpriced ? enrichedModels : pricedModels;
    if (sortMode === "slowest") {
      return [...base].sort(
        (a, b) => b.p95LatencyMs - a.p95LatencyMs || b.avgLatencyMs - a.avgLatencyMs || b.requests - a.requests
      );
    }
    if (sortMode === "failures") {
      return [...base].sort(
        (a, b) => b.failureCount - a.failureCount || b.failureRate - a.failureRate || b.requests - a.requests
      );
    }
    return pricedModels;
  })();

  const maxModelCost = Math.max(0, ...enrichedModels.map((m) => m.estimatedCost));
  const maxModelP95 = Math.max(0, ...enrichedModels.map((m) => m.p95LatencyMs || m.avgLatencyMs));
  const maxModelFailures = Math.max(0, ...enrichedModels.map((m) => m.failureCount));

  const maxProviderCost = Math.max(0, ...enrichedProviders.map((p) => p.estimatedCost));
  const maxProviderP95 = Math.max(0, ...enrichedProviders.map((p) => p.p95LatencyMs || p.avgLatencyMs));
  const maxProviderFailures = Math.max(0, ...enrichedProviders.map((p) => p.failureCount));

  const getTokenCells = (entry: (typeof enrichedModels)[number]) => [
    { key: "input", label: t("input"), value: entry.inputTokens },
    { key: "cached", label: t("cached"), value: entry.cachedTokens },
    { key: "cacheWrite", label: t("cacheWrite"), value: entry.cacheWriteTokens },
    { key: "output", label: t("output"), value: entry.outputTokens },
  ];

  const getModelBarProps = (entry: (typeof enrichedModels)[number], idx: number) => {
    if (sortMode === "slowest") {
      const val = entry.p95LatencyMs || entry.avgLatencyMs;
      const width = maxModelP95 > 0 ? Math.max((val / maxModelP95) * 100, val > 0 ? 3 : 0) : 0;
      const color = val >= 20_000 ? CHART_COLORS.rose : val >= 5_000 ? CHART_COLORS.warning : CHART_COLORS.primary;
      return { width, color };
    }
    if (sortMode === "failures") {
      const val = entry.failureCount;
      const width = maxModelFailures > 0 ? Math.max((val / maxModelFailures) * 100, val > 0 ? 3 : 0) : 0;
      const color = entry.failureRate >= 15 ? CHART_COLORS.rose : val > 0 ? CHART_COLORS.warning : CHART_COLORS.success;
      return { width, color };
    }
    const width =
      maxModelCost > 0
        ? Math.max((entry.estimatedCost / maxModelCost) * 100, entry.estimatedCost > 0 ? 2 : 0)
        : 0;
    return { width, color: SERIES_PALETTE[idx % SERIES_PALETTE.length] };
  };

  return (
    <section className="space-y-4">
      <div>
        {/* Toolbar: View Switch + Diagnostic Sort Switch + Unpriced Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={t("costBreakdownTitle")}
              className="inline-flex rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
            >
              <button
                type="button"
                aria-pressed={activeTab === "models"}
                onClick={() => setActiveTab("models")}
                className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === "models"
                    ? "bg-[var(--accent)] text-[var(--surface-base)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t("byModelTab")}{" "}
                <span className="ml-1 text-[10px] tabular-nums opacity-75">
                  {enrichedModels.length}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={activeTab === "providers"}
                onClick={() => setActiveTab("providers")}
                className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === "providers"
                    ? "bg-[var(--accent)] text-[var(--surface-base)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t("byProviderTab")}{" "}
                <span className="ml-1 text-[10px] tabular-nums opacity-75">
                  {enrichedProviders.length}
                </span>
              </button>
            </div>

            <div
              role="group"
              aria-label="Sort breakdown"
              className="inline-flex rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
            >
              {(
                [
                  { id: "cost", label: t("sortByCost") },
                  { id: "slowest", label: t("sortBySlowest") },
                  { id: "failures", label: t("sortByFailures") },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={sortMode === mode.id}
                  onClick={() => setSortMode(mode.id)}
                  className={`cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    sortMode === mode.id
                      ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-xs"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "models" && sortMode === "cost" && unpricedModels.length > 0 && pricedModels.length > 0 && (
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

        {/* Tab 1: Full-Height Scrollable Model Cost & Diagnostic Ledger */}
        {activeTab === "models" && (() => {
          const rows = visibleModels.map((entry, idx) => {
            const { width: relativeWidth, color } = getModelBarProps(entry, idx);
            const sharePct = totalEstimatedCost > 0 ? (entry.estimatedCost / totalEstimatedCost) * 100 : 0;
            return { entry, color, relativeWidth, sharePct };
          });

          const renderModelBadges = (entry: (typeof enrichedModels)[number]) => (
            <>
              {(entry.p95LatencyMs > 0 || entry.avgLatencyMs > 0) && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium tabular-nums ${getLatencySeverityClasses(entry.p95LatencyMs, entry.avgLatencyMs)}`}
                  title={`${t("avgLatency")}: ${entry.avgLatencyMs.toLocaleString()} ms · ${t("p95Latency")}: ${entry.p95LatencyMs.toLocaleString()} ms`}
                >
                  <span>{formatDurationShort(entry.avgLatencyMs)}</span>
                  <span className="opacity-60">/</span>
                  <span className="font-semibold">{t("p95Latency")} {formatDurationShort(entry.p95LatencyMs)}</span>
                </span>
              )}
              {entry.failureCount > 0 && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold tabular-nums ${getFailureSeverityClasses(entry.failureRate)}`}
                  title={t("failedRequestsCount", {
                    failed: entry.failureCount.toLocaleString(),
                    total: entry.requests.toLocaleString(),
                  })}
                >
                  {entry.failureCount.toLocaleString()} · {t("failureRateLabel", { rate: entry.failureRate })}
                </span>
              )}
            </>
          );

          return (
            <>
              {/* Compact Vertical Ledger (Mobile / Tablet, full natural page scroll) */}
              <div className="divide-y divide-[var(--surface-border)]/60 lg:hidden">
                {rows.map(({ entry, color, relativeWidth, sharePct }) => (
                  <div key={entry.model} className="space-y-2 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-medium text-[var(--text-primary)]" title={entry.model}>
                          {entry.model}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                          <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0 text-[10px] text-[var(--text-secondary)]">
                            {entry.provider}
                          </span>
                          <span className="tabular-nums">{entry.requests.toLocaleString()} {t("requestsHeader").toLowerCase()}</span>
                          {renderModelBadges(entry)}
                          {entry.priced && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-[10px] tabular-nums">
                                {formatRate(entry)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <span className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {entry.priced ? formatUSD(entry.estimatedCost) : "\u2014"}
                        </span>
                        {entry.priced && totalEstimatedCost > 0 && (
                          <span className="block text-[10px] text-[var(--text-muted)]">
                            {sharePct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {relativeWidth > 0 && (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, relativeWidth)}%`, backgroundColor: color }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                      {getTokenCells(entry).map((cell) => (
                        <div key={cell.key} className="min-w-0" title={cell.value.toLocaleString()}>
                          <span className="block truncate text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
                            {cell.label}
                          </span>
                          <span className="block truncate font-medium text-[var(--text-secondary)]">
                            {formatCompact(cell.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {sortMode === "cost" && displayUnpriced && unpricedModels.length > 0 && (
                  <div>
                    <div className="bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {t("unpricedModels")} ({unpricedModels.length})
                    </div>
                    <div className="divide-y divide-[var(--surface-border)]/40">
                      {unpricedModels.map((entry) => (
                        <div key={entry.model} className="space-y-1.5 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-xs font-medium text-[var(--text-primary)]" title={entry.model}>
                                {entry.model}
                              </span>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0 text-[10px] text-[var(--text-secondary)]">
                                  {entry.provider}
                                </span>
                                {renderModelBadges(entry)}
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-secondary)]">
                              {entry.requests.toLocaleString()} {t("requestsHeader").toLowerCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                            {getTokenCells(entry).map((cell) => (
                              <div key={cell.key} className="min-w-0" title={cell.value.toLocaleString()}>
                                <span className="block truncate text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                                  {cell.label}
                                </span>
                                <span className="block truncate text-[var(--text-secondary)]">
                                  {formatCompact(cell.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Ledger Table (full natural page scroll, no vertical max-height cap) */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-xs">
                  <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-base)]">
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
                        {t("latency")} ({t("avgLatency")} / {t("p95Latency")})
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {t("failedLabel")}
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
                    {rows.map(({ entry, color, relativeWidth, sharePct }) => (
                      <tr key={entry.model} className="transition-colors hover:bg-[var(--surface-muted)]/50">
                        <td className="px-4 py-2">
                          <div className="max-w-[240px] truncate font-mono text-[11px] font-medium text-[var(--text-primary)]" title={entry.model}>
                            {entry.model}
                          </div>
                          {relativeWidth > 0 && (
                            <div className="mt-1 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--surface-muted)]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, relativeWidth)}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                            {entry.provider}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                          {entry.requests.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {entry.p95LatencyMs > 0 || entry.avgLatencyMs > 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getLatencySeverityClasses(entry.p95LatencyMs, entry.avgLatencyMs)}`}
                              title={`${t("avgLatency")}: ${entry.avgLatencyMs.toLocaleString()} ms · ${t("p95Latency")}: ${entry.p95LatencyMs.toLocaleString()} ms`}
                            >
                              <span>{formatDurationShort(entry.avgLatencyMs)}</span>
                              <span className="opacity-60">/</span>
                              <span className="font-semibold">{formatDurationShort(entry.p95LatencyMs)}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">{"\u2014"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {entry.failureCount > 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getFailureSeverityClasses(entry.failureRate)}`}
                            >
                              {entry.failureCount.toLocaleString()} ({entry.failureRate}%)
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">0</span>
                          )}
                        </td>
                        {getTokenCells(entry).map((cell) => (
                          <td
                            key={cell.key}
                            className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]"
                            title={cell.value.toLocaleString()}
                          >
                            {formatCompact(cell.value)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                          {entry.priced ? formatRate(entry) : "\u2014"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {entry.priced ? (
                            <>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatUSD(entry.estimatedCost)}
                              </span>
                              {totalEstimatedCost > 0 && (
                                <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                                  {sharePct.toFixed(1)}%
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)]">{"\u2014"}</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {sortMode === "cost" && displayUnpriced && unpricedModels.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={11}
                            className="bg-[var(--surface-muted)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                          >
                            {t("unpricedModels")} ({unpricedModels.length})
                          </td>
                        </tr>
                        {unpricedModels.map((entry) => (
                          <tr key={entry.model} className="transition-colors hover:bg-[var(--surface-muted)]/40">
                            <td className="max-w-[240px] truncate px-4 py-2 font-mono text-[11px] text-[var(--text-secondary)]" title={entry.model}>
                              {entry.model}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-block rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {entry.provider}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                              {entry.requests.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {entry.p95LatencyMs > 0 || entry.avgLatencyMs > 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getLatencySeverityClasses(entry.p95LatencyMs, entry.avgLatencyMs)}`}
                                  title={`${t("avgLatency")}: ${entry.avgLatencyMs.toLocaleString()} ms · ${t("p95Latency")}: ${entry.p95LatencyMs.toLocaleString()} ms`}
                                >
                                  <span>{formatDurationShort(entry.avgLatencyMs)}</span>
                                  <span className="opacity-60">/</span>
                                  <span className="font-semibold">{formatDurationShort(entry.p95LatencyMs)}</span>
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)]">{"\u2014"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {entry.failureCount > 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getFailureSeverityClasses(entry.failureRate)}`}
                                >
                                  {entry.failureCount.toLocaleString()} ({entry.failureRate}%)
                                </span>
                              ) : (
                                <span className="text-[11px] text-[var(--text-muted)]">0</span>
                              )}
                            </td>
                            {getTokenCells(entry).map((cell) => (
                              <td key={cell.key} className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]" title={cell.value.toLocaleString()}>
                                {formatCompact(cell.value)}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right text-[var(--text-muted)]">{"\u2014"}</td>
                            <td className="px-4 py-2 text-right text-[var(--text-muted)]">{"\u2014"}</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

        {/* Tab 2: Full-Height Provider Breakdown (no inner height cap) */}
        {activeTab === "providers" && (
          <div className="divide-y divide-[var(--surface-border)]/60 px-1 sm:px-4">
            {enrichedProviders.map((prov, index) => {
              const pct = totalEstimatedCost > 0 ? (prov.estimatedCost / totalEstimatedCost) * 100 : 0;
              let barWidth = Math.min(100, Math.max(pct, pct > 0 ? 1.5 : 0));
              let color: string = SERIES_PALETTE[index % SERIES_PALETTE.length] ?? CHART_COLORS.primary;

              if (sortMode === "slowest") {
                const lat = prov.p95LatencyMs || prov.avgLatencyMs;
                barWidth = maxProviderP95 > 0 ? Math.max((lat / maxProviderP95) * 100, lat > 0 ? 3 : 0) : 0;
                color = lat >= 20_000 ? CHART_COLORS.rose : lat >= 5_000 ? CHART_COLORS.warning : CHART_COLORS.primary;
              } else if (sortMode === "failures") {
                barWidth =
                  maxProviderFailures > 0
                    ? Math.max((prov.failureCount / maxProviderFailures) * 100, prov.failureCount > 0 ? 3 : 0)
                    : 0;
                color = prov.failureRate >= 15 ? CHART_COLORS.rose : prov.failureCount > 0 ? CHART_COLORS.warning : CHART_COLORS.success;
              } else if (maxProviderCost > 0) {
                barWidth = Math.max((prov.estimatedCost / maxProviderCost) * 100, prov.estimatedCost > 0 ? 2 : 0);
              }

              return (
                <div key={prov.provider} className="space-y-1.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                      {(prov.p95LatencyMs > 0 || prov.avgLatencyMs > 0) && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums ${getLatencySeverityClasses(prov.p95LatencyMs, prov.avgLatencyMs)}`}
                        >
                          <span>{t("avgLatency")} {formatDurationShort(prov.avgLatencyMs)}</span>
                          <span className="opacity-60">·</span>
                          <span className="font-semibold">{t("p95Latency")} {formatDurationShort(prov.p95LatencyMs)}</span>
                        </span>
                      )}
                      {prov.failureCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${getFailureSeverityClasses(prov.failureRate)}`}
                        >
                          {prov.failureCount.toLocaleString()} · {t("failureRateLabel", { rate: prov.failureRate })}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatUSD(prov.estimatedCost)}
                      </span>
                      {totalEstimatedCost > 0 && (
                        <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
                          ({pct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, barWidth)}%`,
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

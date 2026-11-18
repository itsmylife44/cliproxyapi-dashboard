"use client";

import { useTranslations } from "next-intl";

import { ChartEmpty } from "@/components/ui/chart-theme";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { isModelFirstProviderQuotaUnverified, type ModelFirstProviderSummary } from "@/lib/model-first-monitoring";
import {
  getWindowTermFractions,
  type ProviderSummary,
  type WindowCapacity,
} from "@/lib/quota/provider-summary";

interface QuotaChartProps {
  providerSummaries: ProviderSummary[];
  modelFirstSummary: ModelFirstProviderSummary | null;
  modelFirstOnlyView: boolean;
}

export function getComparableProviderSummaries(providerSummaries: ProviderSummary[]): ProviderSummary[] {
  return providerSummaries.filter((summary) =>
    summary.monitorMode === "model-first"
      ? summary.modelFirstSummary?.minRemainingFraction != null
      : summary.windowCapacities.length > 0
  );
}

/** Average remaining capacity percentage across accounts for each headline term. */
export function getProviderCapacityBars(windowCapacities: WindowCapacity[]): {
  longTerm: number | null;
  shortTerm: number | null;
} {
  const { longTerm, shortTerm } = getWindowTermFractions(windowCapacities);
  return {
    longTerm: longTerm !== null ? Math.round(longTerm * 100) : null,
    shortTerm: shortTerm !== null ? Math.round(shortTerm * 100) : null,
  };
}

function getBarTone(pct: number, kind: "long" | "short"): string {
  if (pct <= 20) return "bg-rose-500/80";
  if (pct <= 60) return "bg-amber-500";
  return kind === "long" ? "bg-emerald-500/80" : "bg-cyan-500";
}

export function QuotaChart({
  providerSummaries,
  modelFirstSummary,
  modelFirstOnlyView,
}: QuotaChartProps) {
  const t = useTranslations("quota");

  if (modelFirstOnlyView && modelFirstSummary) {
    const quotaUnverified = isModelFirstProviderQuotaUnverified(modelFirstSummary);
    const readyPct =
      modelFirstSummary.totalAccounts > 0
        ? Math.round((modelFirstSummary.readyAccounts / modelFirstSummary.totalAccounts) * 100)
        : 0;

    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t("groupedSnapshotTitle")}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs tabular-nums text-[var(--text-secondary)]">
            <span>
              {quotaUnverified
                ? t("freshSnapshotsCount", {
                    fresh: Math.max(0, modelFirstSummary.totalAccounts - modelFirstSummary.staleAccounts),
                    total: modelFirstSummary.totalAccounts,
                  })
                : `${readyPct}% ${t("readyLabel").toLowerCase()} (${modelFirstSummary.readyAccounts}/${modelFirstSummary.totalAccounts})`}
            </span>
            <span className="text-[var(--text-muted)]">
              {t("nextResetShort")}: {formatRelativeTime(modelFirstSummary.nextWindowResetAt, t)}
            </span>
          </div>
        </div>

        {modelFirstSummary.groups.length === 0 ? (
          <ChartEmpty message={t("noGroupedModelData")} />
        ) : (
          <div className="space-y-2.5">
            {modelFirstSummary.groups.map((group) => {
              const minPct = group.minRemainingFraction === null ? null : Math.round(group.minRemainingFraction * 100);
              const p50Pct = group.p50RemainingFraction === null ? null : Math.round(group.p50RemainingFraction * 100);
              const barPct = minPct ?? p50Pct ?? 0;
              return (
                <div key={group.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-[var(--text-primary)]">{group.label}</span>
                    <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                      {minPct !== null ? `${minPct}% min` : "-"}
                      {p50Pct !== null ? ` · ${p50Pct}% p50` : ""}
                      {" · "}
                      {group.readyAccounts}/{group.totalAccounts} {t("readyLabel").toLowerCase()}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getBarTone(barPct, "long")}`}
                      style={{ width: `${Math.max(barPct, barPct > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  const chartSummaries = getComparableProviderSummaries(providerSummaries);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {t("providerCapacityTitle")}
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t("longTermLabel")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            {t("shortTermLabel")}
          </span>
        </div>
      </div>

      {providerSummaries.length === 0 ? (
        <ChartEmpty message={t("noProviderData")} />
      ) : chartSummaries.length === 0 ? (
        <ChartEmpty message={t("noComparableProviderQuota")} />
      ) : (
        <div className="space-y-3 border-t border-[var(--surface-border)] pt-3">
          {chartSummaries.map((summary) => {
            const bars =
              summary.monitorMode === "model-first" && summary.modelFirstSummary
                ? {
                    longTerm:
                      (summary.modelFirstSummary.avgRemainingFraction ?? summary.modelFirstSummary.minRemainingFraction) != null
                        ? Math.round((summary.modelFirstSummary.avgRemainingFraction ?? summary.modelFirstSummary.minRemainingFraction)! * 100)
                        : null,
                    shortTerm: null,
                  }
                : getProviderCapacityBars(summary.windowCapacities);

            const hasLong = bars.longTerm !== null;
            const hasShort = bars.shortTerm !== null;

            return (
              <div key={summary.provider} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
                <div className="flex items-center justify-between gap-2 sm:block">
                  <span className="text-xs font-medium capitalize text-[var(--text-primary)]">{summary.provider}</span>
                  <span className="block text-[11px] tabular-nums text-[var(--text-muted)]">
                    {summary.healthyAccounts}/{summary.totalAccounts} {t("healthyLabel")}
                    {summary.errorAccounts > 0 ? ` · ${summary.errorAccounts} ${t("issuesLabel")}` : ""}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {hasLong && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getBarTone(bars.longTerm!, "long")}`}
                          style={{ width: `${Math.max(bars.longTerm!, bars.longTerm! > 0 ? 2 : 0)}%` }}
                          title={`${t("longTermLabel")}: ${bars.longTerm}%`}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {bars.longTerm}%
                      </span>
                    </div>
                  )}

                  {hasShort && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getBarTone(bars.shortTerm!, "short")}`}
                          style={{ width: `${Math.max(bars.shortTerm!, bars.shortTerm! > 0 ? 2 : 0)}%` }}
                          title={`${t("shortTermLabel")}: ${bars.shortTerm}%`}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {bars.shortTerm}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

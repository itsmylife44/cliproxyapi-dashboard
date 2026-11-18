"use client";

import { useTranslations } from "next-intl";

import { ChartEmpty } from "@/components/ui/chart-theme";
import { QuotaCapacity, QuotaCapacityBar } from "@/components/quota/quota-capacity";
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
      <section aria-labelledby="quota-capacity-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="quota-capacity-title" className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {t("groupedSnapshotTitle")}
          </h2>
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
                  <QuotaCapacityBar percent={barPct} />
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
    <section aria-labelledby="quota-capacity-title" className="space-y-3">
      <h2 id="quota-capacity-title" className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
        {t("providerCapacityTitle")}
      </h2>

      {providerSummaries.length === 0 ? (
        <ChartEmpty message={t("noProviderData")} />
      ) : chartSummaries.length === 0 ? (
        <ChartEmpty message={t("noComparableProviderQuota")} />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
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

            const { longTerm, shortTerm } = bars;
            return (
              <li key={summary.provider} className="min-w-0 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold capitalize text-[var(--text-primary)]">{summary.provider}</h3>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {summary.healthyAccounts}/{summary.totalAccounts} {t("healthyLabel")}
                    {summary.errorAccounts > 0 ? ` · ${summary.errorAccounts} ${t("issuesLabel")}` : ""}
                  </span>
                </div>
                <div className="mt-2.5 grid auto-cols-fr grid-flow-col gap-3 border-t border-[var(--surface-border)] pt-2">
                  {longTerm !== null && (
                    <QuotaCapacity label={t(summary.monitorMode === "model-first" ? "remainingColumnLabel" : "longTermLabel")} percent={longTerm} />
                  )}
                  {shortTerm !== null && <QuotaCapacity label={t("shortTermLabel")} percent={shortTerm} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

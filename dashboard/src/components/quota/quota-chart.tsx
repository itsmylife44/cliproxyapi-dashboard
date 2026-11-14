"use client";

import { Bar, BarChart, Legend, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";

import { CHART_COLORS, ChartContainer, ChartEmpty, useChartTheme } from "@/components/ui/chart-theme";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { isModelFirstProviderQuotaUnverified, type ModelFirstProviderSummary } from "@/lib/model-first-monitoring";
import { headlineQuotaWindows } from "@/lib/quota/headline";
import type { ProviderSummary, WindowCapacity } from "@/lib/quota/provider-summary";

interface QuotaChartProps {
  overallCapacity: { value: number; label: string; provider: string };
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

/** Average remaining capacity across accounts for each headline term. */
export function getProviderCapacityBars(windowCapacities: WindowCapacity[]): {
  longTerm: number | null;
  shortTerm: number | null;
} {
  const windows = headlineQuotaWindows(windowCapacities);
  const average = (isShortTerm: boolean) => {
    const matching = windows.filter((window) => window.isShortTerm === isShortTerm);
    const count = matching.reduce((sum, window) => sum + (window.accountCount ?? 1), 0);
    return count > 0
      ? Math.round(matching.reduce((sum, window) => sum + (window.averageCapacity ?? window.capacity) * (window.accountCount ?? 1), 0) / count * 100)
      : null;
  };
  return { longTerm: average(false), shortTerm: average(true) };
}

export function QuotaChart({
  overallCapacity,
  providerSummaries,
  modelFirstSummary,
  modelFirstOnlyView,
}: QuotaChartProps) {
  const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
  const t = useTranslations("quota");

  if (modelFirstOnlyView && modelFirstSummary) {
    const quotaUnverified = isModelFirstProviderQuotaUnverified(modelFirstSummary);
    const readyPct =
      modelFirstSummary.totalAccounts > 0
        ? Math.round((modelFirstSummary.readyAccounts / modelFirstSummary.totalAccounts) * 100)
        : 0;
    const gaugeColor = quotaUnverified
      ? CHART_COLORS.text.dimmed
      : readyPct > 60
        ? CHART_COLORS.success
        : readyPct > 20
          ? CHART_COLORS.warning
          : CHART_COLORS.danger;
    const gaugeData = [{ value: quotaUnverified ? 100 : readyPct, fill: gaugeColor }];
    const groupData = modelFirstSummary.groups.map((group) => ({
      group: group.label,
      minRemaining: group.minRemainingFraction === null ? null : Math.round(group.minRemainingFraction * 100),
      p50Remaining: group.p50RemainingFraction === null ? null : Math.round(group.p50RemainingFraction * 100),
      readyAccounts: group.readyAccounts,
      totalAccounts: group.totalAccounts,
      nextReset: group.nextWindowResetAt,
      fullReset: group.fullWindowResetAt,
      nextRecovery: group.nextRecoveryAt,
      bottleneckModel: group.bottleneckModel,
    }));

    return (
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartContainer title={t("modelFirstReadinessTitle")} subtitle={t("modelFirstReadinessSubtitle")}>
          {modelFirstSummary.totalAccounts === 0 ? (
            <ChartEmpty message={t("noAntigravitySnapshots")} />
          ) : (
            <div className="relative flex h-48 items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                <RadialBarChart
                  cx="50%"
                  cy="60%"
                  innerRadius="55%"
                  outerRadius="80%"
                  startAngle={210}
                  endAngle={-30}
                  data={[{ value: 100, fill: "rgba(148,163,184,0.1)" }, ...gaugeData]}
                  barSize={14}
                >
                  <RadialBar dataKey="value" background={false} cornerRadius={4} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: gaugeColor }}>
                  {quotaUnverified ? "N/A" : `${readyPct}%`}
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: CHART_COLORS.text.dimmed }}>
                  {quotaUnverified ? t("snapshotLabel") : t("readyLabel")}
                </span>
                <span className="mt-2 text-[11px]" style={{ color: CHART_COLORS.text.dimmed }}>
                  {quotaUnverified
                    ? t("freshSnapshotsCount", { fresh: Math.max(0, modelFirstSummary.totalAccounts - modelFirstSummary.staleAccounts), total: modelFirstSummary.totalAccounts })
                    : t("readyAccountsCount", { ready: modelFirstSummary.readyAccounts, total: modelFirstSummary.totalAccounts })}
                </span>
                <span className="mt-1 text-[10px]" style={{ color: CHART_COLORS.text.muted }}>
                  {t("nextResetShort")}: {formatRelativeTime(modelFirstSummary.nextWindowResetAt, t)}
                </span>
              </div>
            </div>
          )}
        </ChartContainer>

        <ChartContainer title={t("groupedSnapshotTitle")} subtitle={t("groupedSnapshotSubtitle")}>
          {groupData.length === 0 ? (
            <ChartEmpty message={t("noGroupedModelData")} />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                <BarChart data={groupData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barSize={8} barGap={2}>
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: tokens.border }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="group"
                    tick={{ ...axisTickStyle, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={96}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name, props) => {
                      if (value === null) return ["-", name];
                      const label = name === "p50Remaining" ? t("medianRemainingLabel") : t("minimumRemainingLabel");
                      const extra = ` | ${props.payload.readyAccounts}/${props.payload.totalAccounts} ${t("readyLabel").toLowerCase()}`;
                      return [`${value}%${extra}`, label];
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as
                        | { nextReset?: string | null; fullReset?: string | null; nextRecovery?: string | null; bottleneckModel?: string | null }
                        | undefined;
                      if (!item) return label;
                      return `${label} | ${t("resetLabel")} ${formatRelativeTime(item.nextReset, t)} | ${t("recoveryLabel")} ${formatRelativeTime(item.nextRecovery, t)} | ${t("bottleneckLabel")} ${item.bottleneckModel ?? "-"}`;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    formatter={(value: string) => (value === "p50Remaining" ? t("medianRemainingLabel") : t("minimumRemainingLabel"))}
                    wrapperStyle={{ fontSize: 10, color: tokens.text.dimmed }}
                  />
                  <Bar dataKey="p50Remaining" radius={[0, 3, 3, 0]} fill={CHART_COLORS.cyan} />
                  <Bar dataKey="minRemaining" radius={[0, 3, 3, 0]} fill={CHART_COLORS.success} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartContainer>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <ChartContainer title={t("overallCapacityTitle")} subtitle={t("overallCapacitySubtitle")}>
        {providerSummaries.length === 0 || !overallCapacity.provider ? (
          <ChartEmpty message={providerSummaries.length === 0 ? t("noProviderData") : t("noAggregatedQuota")} />
        ) : (() => {
          const comparable = getComparableProviderSummaries(providerSummaries).map((s) =>
            getProviderCapacityBars(s.windowCapacities)
          );
          const longValues = comparable.map((b) => b.longTerm).filter((v): v is number => v !== null && Number.isFinite(v));
          const shortValues = comparable.map((b) => b.shortTerm).filter((v): v is number => v !== null && Number.isFinite(v));
          const longAvg = longValues.length > 0 ? longValues.reduce((a, b) => a + b, 0) / longValues.length / 100 : null;
          const shortAvg = shortValues.length > 0 ? shortValues.reduce((a, b) => a + b, 0) / shortValues.length / 100 : null;
          const dials = [
            { label: t("shortTermLabel"), value: shortAvg },
            { label: t("longTermLabel"), value: longAvg },
          ];
          return (
            <div className="grid h-48 grid-cols-2 gap-2">
              {dials.map(({ label, value }) => {
                if (value === null) {
                  return (
                    <div key={label} className="flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-[var(--text-muted)]">—</span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: tokens.text.dimmed }}>{label}</span>
                    </div>
                  );
                }
                const pct = Math.round(value * 100);
                const gaugeColor =
                  value > 0.6
                    ? CHART_COLORS.success
                    : value > 0.2
                      ? CHART_COLORS.warning
                      : CHART_COLORS.danger;
                return (
                  <div key={label} className="relative flex h-full items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 160, height: 192 }}>
                      <RadialBarChart
                        cx="50%"
                        cy="58%"
                        innerRadius="55%"
                        outerRadius="82%"
                        startAngle={210}
                        endAngle={-30}
                        data={[{ value: 100, fill: "rgba(148,163,184,0.1)" }, { value: pct, fill: gaugeColor }]}
                        barSize={12}
                      >
                        <RadialBar dataKey="value" background={false} cornerRadius={4} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: gaugeColor }}>{pct}%</span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: tokens.text.dimmed }}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </ChartContainer>

      <ChartContainer title={t("providerCapacityTitle")} subtitle={t("providerCapacitySubtitle")}>
        {providerSummaries.length === 0 ? (
          <ChartEmpty message={t("noProviderData")} />
        ) : (() => {
          const chartSummaries = getComparableProviderSummaries(providerSummaries);
          if (chartSummaries.length === 0) {
            return <ChartEmpty message={t("noComparableProviderQuota")} />;
          }

          const barData = chartSummaries.map((summary) => {
            if (summary.monitorMode === "model-first" && summary.modelFirstSummary) {
              const fraction = summary.modelFirstSummary.avgRemainingFraction ?? summary.modelFirstSummary.minRemainingFraction;
              return {
                provider: summary.provider,
                longTerm:
                  fraction === null || fraction === undefined
                    ? null
                    : Math.round(fraction * 100),
                shortTerm: null,
                healthy: summary.healthyAccounts,
                total: summary.totalAccounts,
                issues: summary.errorAccounts,
                monitorMode: summary.monitorMode,
              };
            }

            const { longTerm, shortTerm } = getProviderCapacityBars(summary.windowCapacities);

            return {
              provider: summary.provider,
              longTerm,
              shortTerm,
              healthy: summary.healthyAccounts,
              total: summary.totalAccounts,
              issues: summary.errorAccounts,
              monitorMode: summary.monitorMode,
            };
          });

          return (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barSize={8} barGap={2}>
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: tokens.border }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="provider"
                    tick={{ ...axisTickStyle, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name, props) => {
                      if (value === null) return ["-", name];

                      if (props.payload.monitorMode === "model-first") {
                        return [`${value}% (${props.payload.healthy}/${props.payload.total} ${t("healthyLabel")})`, t("longTermLabel")];
                      }

                      const label = name === "longTerm" ? t("longTermLabel") : t("shortTermLabel");
                      const extra =
                        name === "longTerm"
                          ? ` (${props.payload.healthy}/${props.payload.total} ${t("healthyLabel")}${props.payload.issues > 0 ? `, ${props.payload.issues} ${t("issuesLabel")}` : ""})`
                          : "";
                      return [`${value}%${extra}`, label];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    formatter={(value: string) => (value === "longTerm" ? t("longTermLabel") : t("shortTermLabel"))}
                    wrapperStyle={{ fontSize: 10, color: tokens.text.dimmed }}
                  />
                  <Bar dataKey="longTerm" radius={[0, 3, 3, 0]} fill={CHART_COLORS.success} />
                  <Bar dataKey="shortTerm" radius={[0, 3, 3, 0]} fill={CHART_COLORS.cyan} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </ChartContainer>
    </section>
  );
}

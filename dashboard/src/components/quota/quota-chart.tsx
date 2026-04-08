"use client";

import { Bar, BarChart, Legend, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_COLORS, ChartContainer, ChartEmpty, useChartTheme } from "@/components/ui/chart-theme";
import { isModelFirstProviderQuotaUnverified, type ModelFirstProviderSummary } from "@/lib/model-first-monitoring";

interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  resetTime: string | null;
  isShortTerm: boolean;
}

interface ProviderSummary {
  provider: string;
  monitorMode: "window-based" | "model-first";
  totalAccounts: number;
  healthyAccounts: number;
  errorAccounts: number;
  windowCapacities: WindowCapacity[];
  modelFirstSummary?: ModelFirstProviderSummary;
}

interface QuotaChartProps {
  overallCapacity: { value: number; label: string; provider: string };
  providerSummaries: ProviderSummary[];
  modelFirstSummary: ModelFirstProviderSummary | null;
  modelFirstOnlyView: boolean;
}

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "Unknown";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Resetting...";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function QuotaChart({
  overallCapacity,
  providerSummaries,
  modelFirstSummary,
  modelFirstOnlyView,
}: QuotaChartProps) {
  const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
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
        <ChartContainer title="Effective Snapshot Readiness" subtitle="Fresh grouped Antigravity snapshots with at least one ready family">
          {modelFirstSummary.totalAccounts === 0 ? (
            <ChartEmpty message="No Antigravity snapshots" />
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
                  {quotaUnverified ? "Snapshot" : "Ready"}
                </span>
                <span className="mt-2 text-[11px]" style={{ color: CHART_COLORS.text.dimmed }}>
                  {quotaUnverified
                    ? `${Math.max(0, modelFirstSummary.totalAccounts - modelFirstSummary.staleAccounts)}/${modelFirstSummary.totalAccounts} fresh snapshots`
                    : `${modelFirstSummary.readyAccounts}/${modelFirstSummary.totalAccounts} accounts`}
                </span>
                <span className="mt-1 text-[10px]" style={{ color: CHART_COLORS.text.muted }}>
                  Next reset: {formatRelativeTime(modelFirstSummary.nextWindowResetAt)}
                </span>
              </div>
            </div>
          )}
        </ChartContainer>

        <ChartContainer title="Grouped Snapshot" subtitle="Grouped family quota view with minimum and median remaining percentages">
          {groupData.length === 0 ? (
            <ChartEmpty message="No grouped model data" />
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
                      const label = name === "p50Remaining" ? "Median Remaining" : "Minimum Remaining";
                      const extra = ` | ${props.payload.readyAccounts}/${props.payload.totalAccounts} ready`;
                      return [`${value}%${extra}`, label];
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as
                        | { nextReset?: string | null; fullReset?: string | null; nextRecovery?: string | null; bottleneckModel?: string | null }
                        | undefined;
                      if (!item) return label;
                      return `${label} | reset ${formatRelativeTime(item.nextReset)} | recovery ${formatRelativeTime(item.nextRecovery)} | bottleneck ${item.bottleneckModel ?? "-"}`;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    formatter={(value: string) => (value === "p50Remaining" ? "Median Remaining" : "Minimum Remaining")}
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
      <ChartContainer title="Overall Capacity" subtitle="Weighted across all providers">
        {providerSummaries.length === 0 ? (
          <ChartEmpty message="No provider data" />
        ) : (() => {
          const pct = Math.round(overallCapacity.value * 100);
          const gaugeColor =
            overallCapacity.value > 0.6
              ? CHART_COLORS.success
              : overallCapacity.value > 0.2
                ? CHART_COLORS.warning
                : CHART_COLORS.danger;
          const gaugeData = [{ value: pct, fill: gaugeColor }];
          return (
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
                  {pct}%
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: CHART_COLORS.text.dimmed }}>
                  Capacity
                </span>
              </div>
            </div>
          );
        })()}
      </ChartContainer>

      <ChartContainer title="Provider Capacity" subtitle="Window minimums or grouped snapshot minimums per provider">
        {providerSummaries.length === 0 ? (
          <ChartEmpty message="No provider data" />
        ) : (() => {
          const barData = providerSummaries.map((summary) => {
            if (summary.monitorMode === "model-first" && summary.modelFirstSummary) {
              return {
                provider: summary.provider,
                longTerm:
                  summary.modelFirstSummary.minRemainingFraction === null
                    ? null
                    : Math.round(summary.modelFirstSummary.minRemainingFraction * 100),
                shortTerm: null,
                healthy: summary.healthyAccounts,
                total: summary.totalAccounts,
                issues: summary.errorAccounts,
                monitorMode: summary.monitorMode,
              };
            }

            const longTerm = summary.windowCapacities.filter((window) => !window.isShortTerm);
            const shortTerm = summary.windowCapacities.filter((window) => window.isShortTerm);
            const longMin =
              longTerm.length > 0 ? Math.round(Math.min(...longTerm.map((window) => window.capacity)) * 100) : null;
            const shortMin =
              shortTerm.length > 0 ? Math.round(Math.min(...shortTerm.map((window) => window.capacity)) * 100) : null;

            return {
              provider: summary.provider,
              longTerm: longMin,
              shortTerm: shortMin,
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
                        return [`${value}% (${props.payload.healthy}/${props.payload.total} healthy)`, "Grouped Snapshot Minimum"];
                      }

                      const label = name === "longTerm" ? "Long-Term" : "Short-Term";
                      const extra =
                        name === "longTerm"
                          ? ` (${props.payload.healthy}/${props.payload.total} healthy${props.payload.issues > 0 ? `, ${props.payload.issues} issues` : ""})`
                          : "";
                      return [`${value}%${extra}`, label];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    formatter={(value: string) => (value === "longTerm" ? "Primary Metric" : "Short-Term")}
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

"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartEmpty, CHART_COLORS, TOOLTIP_STYLE, AXIS_TICK_STYLE } from "@/components/ui/chart-theme";

interface WindowCapacity {
  id: string;
  label: string;
  capacity: number;
  resetTime: string | null;
  isShortTerm: boolean;
}

interface ProviderSummary {
  provider: string;
  totalAccounts: number;
  healthyAccounts: number;
  errorAccounts: number;
  windowCapacities: WindowCapacity[];
}

interface QuotaChartProps {
  overallCapacity: { value: number; label: string; provider: string };
  providerSummaries: ProviderSummary[];
}

export function QuotaChart({ overallCapacity, providerSummaries }: QuotaChartProps) {
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
                <span className="text-3xl font-bold" style={{ color: gaugeColor }}>{pct}%</span>
                <span className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: CHART_COLORS.text.dimmed }}>Capacity</span>
              </div>
            </div>
          );
        })()}
      </ChartContainer>

      <ChartContainer title="Provider Capacity" subtitle="Long-term & short-term window minimum per provider">
        {providerSummaries.length === 0 ? (
          <ChartEmpty message="No provider data" />
        ) : (() => {
          const barData = providerSummaries.map((s) => {
            const longTerm = s.windowCapacities.filter((w) => !w.isShortTerm);
            const shortTerm = s.windowCapacities.filter((w) => w.isShortTerm);
            const longMin = longTerm.length > 0 ? Math.round(Math.min(...longTerm.map((w) => w.capacity)) * 100) : null;
            const shortMin = shortTerm.length > 0 ? Math.round(Math.min(...shortTerm.map((w) => w.capacity)) * 100) : null;
            return {
              provider: s.provider,
              longTerm: longMin,
              shortTerm: shortMin,
              healthy: s.healthyAccounts,
              total: s.totalAccounts,
              issues: s.errorAccounts,
            };
          });
          return (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
                  barSize={8}
                  barGap={2}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={AXIS_TICK_STYLE}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.border }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="provider"
                    tick={{ ...AXIS_TICK_STYLE, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name, props) => {
                      if (value === null) return ["-", name];
                      const label = name === "longTerm" ? "Long-Term" : "Short-Term";
                      const extra = name === "longTerm" ? ` (${props.payload.healthy}/${props.payload.total} healthy${props.payload.issues > 0 ? `, ${props.payload.issues} issues` : ""})` : "";
                      return [`${value}%${extra}`, label];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    formatter={(value: string) => value === "longTerm" ? "Long-Term" : "Short-Term"}
                    wrapperStyle={{ fontSize: 10, color: CHART_COLORS.text.dimmed }}
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

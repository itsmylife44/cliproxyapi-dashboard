"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, CHART_COLORS, SERIES_PALETTE, TOOLTIP_STYLE, AXIS_TICK_STYLE, formatCompact } from "@/components/ui/chart-theme";

interface UsageResponse {
  usage: {
    total_requests: number;
    success_count: number;
    failure_count: number;
    total_tokens: number;
    requests_by_day?: Record<string, number>;
    requests_by_hour?: Record<string, number>;
    apis?: Record<string, {
      total_requests: number;
      models?: Record<string, {
        total_requests: number;
        total_tokens: number;
      }>;
    }>;
  };
}

interface UsageStatsProps {
  usage: UsageResponse | null;
}

export function UsageStats({ usage }: UsageStatsProps) {
  const modelStats = usage?.usage.apis
    ? Object.entries(usage.usage.apis).flatMap(([, data]) =>
        data.models
          ? Object.entries(data.models).map(([model, stats]) => ({
              model,
              requests: stats.total_requests,
              tokens: stats.total_tokens,
            }))
          : []
      )
    : [];

  const hourlyData = usage?.usage.requests_by_hour
    ? Object.entries(usage.usage.requests_by_hour).map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
      }))
    : [];

  return (
    <section className="rounded-md border border-[#e5e5e5] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-black">Usage Statistics</h2>
         {usage ? (
           <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              <div className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Total Requests</p>
                <p className="mt-0.5 text-xs font-semibold text-black">
                  {(usage.usage?.total_requests ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Success</p>
                <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                  {(usage.usage?.success_count ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Failed</p>
                <p className="mt-0.5 text-xs font-semibold text-rose-600">
                  {(usage.usage?.failure_count ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Total Tokens</p>
                <p className="mt-0.5 text-xs font-semibold text-black">
                {(usage.usage?.total_tokens ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            {modelStats.length > 0 ? (
              <ChartContainer title="Requests by Model">
                <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                  <BarChart
                    layout="vertical"
                    data={modelStats}
                    margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
                    <YAxis
                      type="category"
                      dataKey="model"
                      tick={AXIS_TICK_STYLE}
                      width={80}
                      tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "\u2026" : v}
                    />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK_STYLE}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
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

            {hourlyData.length > 0 ? (
              <ChartContainer title="Requests by Hour">
                <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
                  <BarChart
                    data={hourlyData}
                    margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                    <XAxis
                      dataKey="hour"
                      tick={AXIS_TICK_STYLE}
                    />
                    <YAxis
                      tick={AXIS_TICK_STYLE}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(value) => [formatCompact(value as number), "Requests"]}
                    />
                    <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-[#777169]">Loading usage statistics...</div>
        )}
    </section>
  );
}

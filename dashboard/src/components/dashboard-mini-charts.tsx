"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_COLORS, formatCompact, TOOLTIP_STYLE } from "@/components/ui/chart-theme";

interface DailyPoint {
  date: string;
  requests: number;
  tokens: number;
  success: number;
  failure: number;
  successRate: number;
}

interface MiniChartData {
  daily: DailyPoint[];
  totalRequests: number;
  totalTokens: number;
  successRate: number;
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardMiniCharts() {
  const [data, setData] = useState<MiniChartData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      const fromStr = toLocalDateString(from);
      const toStr = toLocalDateString(now);

      try {
        const res = await fetch(`/api/usage/history?from=${fromStr}&to=${toStr}`);
        if (!res.ok) return;
        const json = await res.json();
        const rawDaily: Array<{ date: string; requests: number; tokens: number; success: number; failure: number }> = json.data?.dailyBreakdown ?? [];
        const daily: DailyPoint[] = rawDaily.map((d) => ({
          ...d,
          successRate: (d.success + d.failure) > 0 ? (d.success / (d.success + d.failure)) * 100 : 0,
        }));
        const totals = json.data?.totals;
        const totalReqs = totals?.totalRequests ?? 0;
        const successCount = totals?.successCount ?? 0;

        setData({
          daily,
          totalRequests: totalReqs,
          totalTokens: totals?.totalTokens ?? 0,
          successRate: totalReqs > 0 ? (successCount / totalReqs) * 100 : 0,
        });
      } catch {
        // Silently fail — mini charts are optional
      }
    };

    fetchData();
  }, []);

  if (!data || data.daily.length < 2) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <MiniSparkCard
        label="Requests (7d)"
        value={formatCompact(data.totalRequests)}
        data={data.daily}
        dataKey="requests"
        color={CHART_COLORS.primary}
        gradientId="reqGrad"
      />
      <MiniSparkCard
        label="Tokens (7d)"
        value={formatCompact(data.totalTokens)}
        data={data.daily}
        dataKey="tokens"
        color={CHART_COLORS.cyan}
        gradientId="tokGrad"
      />
      <MiniSparkCard
        label="Success Rate (7d)"
        value={`${data.successRate.toFixed(1)}%`}
        data={data.daily}
        dataKey="successRate"
        color={CHART_COLORS.success}
        gradientId="sucGrad"
      />
    </div>
  );
}

function MiniSparkCard({
  label,
  value,
  data,
  dataKey,
  color,
  gradientId,
}: {
  label: string;
  value: string;
  data: DailyPoint[];
  dataKey: keyof DailyPoint;
  color: string;
  gradientId: string;
}) {
  return (
    <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-3 py-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-100">{value}</p>
        </div>
      </div>
      <div className="mt-1.5 h-10">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 200 }}>
          <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle}
              labelStyle={TOOLTIP_STYLE.labelStyle}
              itemStyle={TOOLTIP_STYLE.itemStyle}
              formatter={(val) => [formatCompact(Number(val ?? 0)), label.split(" ")[0]]}
              labelFormatter={(_l, payload) => {
                const dateStr = payload?.[0]?.payload?.date;
                if (!dateStr) return "";
                const d = new Date(String(dateStr) + "T00:00:00");
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

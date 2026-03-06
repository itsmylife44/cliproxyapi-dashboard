"use client";

/**
 * Shared chart theme configuration for Recharts.
 * Matches the glassmorphic dark design of the dashboard.
 */

export const CHART_COLORS = {
  primary: "#3b82f6",
  primaryLight: "#60a5fa",
  primaryDark: "#2563eb",
  success: "#10b981",
  successLight: "#34d399",
  warning: "#f59e0b",
  warningLight: "#fbbf24",
  danger: "#ef4444",
  dangerLight: "#f87171",
  cyan: "#06b6d4",
  cyanLight: "#22d3ee",
  violet: "#8b5cf6",
  violetLight: "#a78bfa",
  rose: "#f43f5e",
  roseLight: "#fb7185",
  orange: "#f97316",
  orangeLight: "#fb923c",
  text: {
    primary: "#e2e8f0",
    muted: "#94a3b8",
    dimmed: "#64748b",
  },
  grid: "rgba(148, 163, 184, 0.1)",
  border: "rgba(148, 163, 184, 0.2)",
  surface: "rgba(15, 23, 42, 0.68)",
  surfaceHover: "rgba(30, 41, 59, 0.78)",
} as const;

export const SERIES_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.violet,
  CHART_COLORS.cyan,
  CHART_COLORS.rose,
  CHART_COLORS.orange,
  CHART_COLORS.primaryDark,
] as const;

export const AXIS_TICK_STYLE = {
  fill: CHART_COLORS.text.dimmed,
  fontSize: 10,
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "6px",
    backdropFilter: "blur(8px)",
    padding: "8px 12px",
  },
  labelStyle: {
    color: CHART_COLORS.text.primary,
    fontSize: "11px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  itemStyle: {
    color: CHART_COLORS.text.muted,
    fontSize: "11px",
    padding: "1px 0",
  },
  cursor: { fill: "rgba(148, 163, 184, 0.06)" },
} as const;

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChartContainer({
  children,
  title,
  subtitle,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`w-full min-w-0 rounded-md border border-slate-700/70 bg-slate-900/25 p-4 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function ChartEmpty({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/15">
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}

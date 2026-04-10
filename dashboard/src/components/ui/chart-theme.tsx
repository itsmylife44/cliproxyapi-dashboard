"use client";

/**
 * Shared chart theme configuration for Recharts.
 * Supports both light and dark themes via `useChartTheme()` hook.
 * Use `useChartTheme()` in components instead of static AXIS_TICK_STYLE/TOOLTIP_STYLE.
 */

import { useEffect, useState } from "react";

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
    primary: "#000000",
    muted: "#4e4e4e",
    dimmed: "#777169",
  },
  grid: "rgba(0, 0, 0, 0.06)",
  border: "rgba(0, 0, 0, 0.1)",
  surface: "#ffffff",
  surfaceHover: "#f5f5f5",
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

const LIGHT_CHART = {
  text: { primary: "#000000", muted: "#4e4e4e", dimmed: "#777169" },
  grid: "rgba(0, 0, 0, 0.06)",
  border: "rgba(0, 0, 0, 0.1)",
  surface: "#ffffff",
  surfaceHover: "#f5f5f5",
  cursor: "rgba(0, 0, 0, 0.03)",
} as const;

const DARK_CHART = {
  text: { primary: "#e5e5e5", muted: "#a3a3a3", dimmed: "#8a8a8a" },
  grid: "rgba(255, 255, 255, 0.08)",
  border: "rgba(255, 255, 255, 0.12)",
  surface: "#1a1a1a",
  surfaceHover: "#242424",
  cursor: "rgba(255, 255, 255, 0.04)",
} as const;

export function useChartTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.dataset.theme === "dark");
    };
    check();

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const tokens = isDark ? DARK_CHART : LIGHT_CHART;

  return {
    isDark,
    tokens,
    axisTickStyle: {
      fill: tokens.text.dimmed,
      fontSize: 10,
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    } as const,
    tooltipStyle: {
      contentStyle: {
        backgroundColor: tokens.surface,
        border: `1px solid ${isDark ? "#333333" : "#e5e5e5"}`,
        borderRadius: "6px",
        padding: "8px 12px",
      },
      labelStyle: {
        color: tokens.text.primary,
        fontSize: "11px",
        fontWeight: 600,
        marginBottom: "4px",
      },
      itemStyle: {
        color: tokens.text.muted,
        fontSize: "11px",
        padding: "1px 0",
      },
      cursor: { fill: tokens.cursor },
    } as const,
  };
}

/**
 * @deprecated Use `useChartTheme().axisTickStyle` for theme-aware styling.
 * Kept for backward compatibility (light-mode defaults).
 */
export const AXIS_TICK_STYLE = {
  fill: LIGHT_CHART.text.dimmed,
  fontSize: 10,
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
} as const;

/**
 * @deprecated Use `useChartTheme().tooltipStyle` for theme-aware styling.
 * Kept for backward compatibility (light-mode defaults).
 */
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: "6px",
    padding: "8px 12px",
  },
  labelStyle: {
    color: LIGHT_CHART.text.primary,
    fontSize: "11px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  itemStyle: {
    color: LIGHT_CHART.text.muted,
    fontSize: "11px",
    padding: "1px 0",
  },
  cursor: { fill: "rgba(0, 0, 0, 0.03)" },
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
    <div className={`w-full min-w-0 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function ChartEmpty({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]">
      <p className="text-xs text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

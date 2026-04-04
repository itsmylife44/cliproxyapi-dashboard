"use client";

import dynamic from "next/dynamic";

const DashboardMiniCharts = dynamic(
  () => import("@/components/dashboard-mini-charts").then(mod => ({ default: mod.DashboardMiniCharts })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-lg bg-slate-800/50" /> }
);

export function LazyDashboardMiniCharts() {
  return <DashboardMiniCharts />;
}

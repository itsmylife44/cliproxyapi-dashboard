"use client";

import { useHealthStatus } from "@/hooks/use-health-status";

function getLatencyColor(ms: number): string {
  if (ms < 100) return "text-emerald-600";
  if (ms < 300) return "text-amber-600";
  return "text-red-600";
}

function getLatencyDotColor(ms: number): string {
  if (ms < 100) return "bg-emerald-500/100";
  if (ms < 300) return "bg-amber-500/100";
  return "bg-red-500/100";
}

export function LatencyIndicator() {
  const { latencyMs } = useHealthStatus();

  if (latencyMs === null) return null;

  if (latencyMs === -1) {
    return (
      <div className="flex items-center gap-1.5" title="Proxy unreachable">
        <div className="h-1.5 w-1.5 rounded-full bg-red-500/100" />
        <span className="text-xs text-red-600">--ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" title={`Latency: ${latencyMs}ms`}>
      <div className={`h-1.5 w-1.5 rounded-full ${getLatencyDotColor(latencyMs)}`} />
      <span className={`text-xs tabular-nums ${getLatencyColor(latencyMs)}`}>{latencyMs}ms</span>
    </div>
  );
}

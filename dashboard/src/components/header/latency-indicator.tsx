"use client";

import { useHealthStatus } from "@/hooks/use-health-status";

function getLatencyColor(ms: number): string {
  if (ms < 100) return "text-emerald-400";
  if (ms < 300) return "text-amber-400";
  return "text-red-400";
}

function getLatencyDotColor(ms: number): string {
  if (ms < 100) return "bg-emerald-500";
  if (ms < 300) return "bg-amber-500";
  return "bg-red-500";
}

export function LatencyIndicator() {
  const { latencyMs } = useHealthStatus();

  if (latencyMs === null) return null;

  if (latencyMs === -1) {
    return (
      <div className="flex items-center gap-1.5" title="Proxy unreachable">
        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-xs text-red-400">--ms</span>
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

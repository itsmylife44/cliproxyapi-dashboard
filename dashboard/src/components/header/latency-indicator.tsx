"use client";

import { useState, useEffect } from "react";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

const PING_INTERVAL = 30_000; // 30 seconds

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
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function measureLatency() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const start = performance.now();
        const res = await fetch(API_ENDPOINTS.HEALTH, { cache: "no-store", signal: controller.signal });
        const end = performance.now();

        if (mounted && res.ok) {
          setLatency(Math.round(end - start));
        } else if (mounted) {
          setLatency(-1);
        }
      } catch {
        if (mounted) setLatency(-1);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    measureLatency();
    const interval = setInterval(measureLatency, PING_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (latency === null) return null;

  if (latency === -1) {
    return (
      <div className="flex items-center gap-1.5" title="Proxy unreachable">
        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-xs text-red-400">--ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" title={`Latency: ${latency}ms`}>
      <div className={`h-1.5 w-1.5 rounded-full ${getLatencyDotColor(latency)}`} />
      <span className={`text-xs tabular-nums ${getLatencyColor(latency)}`}>{latency}ms</span>
    </div>
  );
}

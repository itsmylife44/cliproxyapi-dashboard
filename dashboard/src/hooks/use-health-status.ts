"use client";

import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

export interface HealthStatusData {
  healthy: boolean;
  latencyMs: number;
  raw: unknown;
}

const healthFetcher = async (url: string): Promise<HealthStatusData> => {
  const start = performance.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    const end = performance.now();
    const latencyMs = Math.round(end - start);

    if (!res.ok) {
      return { healthy: false, latencyMs: -1, raw: null };
    }

    const data: unknown = await res.json();
    return { healthy: true, latencyMs, raw: data };
  } catch {
    return { healthy: false, latencyMs: -1, raw: null };
  }
};

export function useHealthStatus() {
  const { data, error, isLoading } = useSWR<HealthStatusData>(
    API_ENDPOINTS.HEALTH,
    healthFetcher,
    {
      refreshInterval: 30_000,
      dedupingInterval: 10_000,
      revalidateOnFocus: false,
    }
  );

  return {
    healthy: data?.healthy ?? null,
    latencyMs: data?.latencyMs ?? null,
    raw: data?.raw ?? null,
    isLoading,
    isError: !!error,
  };
}

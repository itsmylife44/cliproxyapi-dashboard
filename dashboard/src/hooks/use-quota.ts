"use client";

import { useState } from "react";
import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { QuotaResponse } from "@/lib/model-first-monitoring";

async function fetchQuota(url: string): Promise<QuotaResponse> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load quota");
  return response.json();
}

export function useQuota(enabled = true) {
  const [refreshing, setRefreshing] = useState(false);
  const state = useSWR<QuotaResponse>(enabled ? API_ENDPOINTS.QUOTA.BASE : null, fetchQuota, {
    refreshInterval: 60_000,
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await state.mutate(fetchQuota(`${API_ENDPOINTS.QUOTA.BASE}?bust=1`), { revalidate: false });
    } finally {
      setRefreshing(false);
    }
  };

  return { ...state, refreshing, refresh };
}

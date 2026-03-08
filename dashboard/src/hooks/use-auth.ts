"use client";

import useSWR from "swr";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Not authenticated");
    return res.json();
  });

/**
 * Shared auth hook backed by SWR.
 * All components calling useAuth() share a single cached request —
 * SWR deduplicates concurrent fetches to the same key automatically.
 */
export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<AuthUser>(
    API_ENDPOINTS.AUTH.ME,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // dedupe for 60s
    }
  );

  return {
    user: data ?? null,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

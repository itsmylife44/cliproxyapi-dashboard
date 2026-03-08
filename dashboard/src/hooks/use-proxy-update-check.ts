"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useAuth } from "@/hooks/use-auth";

export interface ProxyVersionInfo {
  currentVersion: string;
  currentDigest: string;
  latestVersion: string;
  latestDigest: string;
  updateAvailable: boolean;
  buildInProgress: boolean;
  availableVersions: string[];
}

const DISMISSED_KEY = "proxy_update_dismissed";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to check updates");
    return res.json();
  });

function getDismissedVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function setDismissedVersion(version: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // localStorage not available
  }
}

export function useProxyUpdateCheck() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [showPopup, setShowPopup] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const { data: updateInfo = null } = useSWR<ProxyVersionInfo>(
    isAdmin ? API_ENDPOINTS.UPDATE.CHECK : null,
    fetcher,
    {
      refreshInterval: CHECK_INTERVAL,
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
    }
  );

  // Determine popup visibility when data changes
  useEffect(() => {
    if (!updateInfo) {
      setShowPopup(false);
      return;
    }
    if (updateInfo.buildInProgress || !updateInfo.updateAvailable) {
      setShowPopup(false);
      return;
    }
    const dismissedVersion = getDismissedVersion();
    if (dismissedVersion !== updateInfo.latestVersion) {
      setShowPopup(true);
    }
  }, [updateInfo]);

  const dismissUpdate = useCallback(() => {
    if (updateInfo?.latestVersion) {
      setDismissedVersion(updateInfo.latestVersion);
    }
    setShowPopup(false);
  }, [updateInfo]);

  const performUpdate = useCallback(
    async (version: string) => {
      setIsUpdating(true);
      setUpdateError(null);
      try {
        const res = await fetch(API_ENDPOINTS.UPDATE.BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, confirm: true }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(extractApiError(data, "Update failed"));
        }

        if (updateInfo?.latestVersion) {
          setDismissedVersion(updateInfo.latestVersion);
        }
        setShowPopup(false);
        setShowOverlay(true);

        return true;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : "Update failed");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [updateInfo]
  );

  return {
    updateInfo,
    isAdmin,
    showPopup,
    showOverlay,
    isUpdating,
    updateError,
    dismissUpdate,
    performUpdate,
  };
}

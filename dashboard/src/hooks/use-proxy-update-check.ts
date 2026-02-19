"use client";

import { useState, useEffect, useCallback } from "react";

interface ProxyVersionInfo {
  currentVersion: string;
  currentDigest: string;
  latestVersion: string;
  latestDigest: string;
  updateAvailable: boolean;
  availableVersions: string[];
}

const DISMISSED_KEY = "proxy_update_dismissed";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
  const [updateInfo, setUpdateInfo] = useState<ProxyVersionInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      // Check admin status
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        setIsAdmin(false);
        setShowPopup(false);
        setUpdateInfo(null);
        return;
      }
      const meData = await meRes.json();

      if (!meData.isAdmin) {
        setIsAdmin(false);
        setShowPopup(false);
        setUpdateInfo(null);
        return;
      }
      setIsAdmin(true);

      // Check for proxy updates
      const updateRes = await fetch("/api/update/check");
      if (!updateRes.ok) return;
      const data: ProxyVersionInfo = await updateRes.json();

      setUpdateInfo(data);

      if (data.updateAvailable) {
        const dismissedVersion = getDismissedVersion();
        if (dismissedVersion !== data.latestVersion) {
          setShowPopup(true);
        }
      } else {
        setShowPopup(false);
      }
    } catch {
      // Silently fail - don't bother user with update check errors
    }
  }, []);

  useEffect(() => {
    // Initial check after short delay (let dashboard load first)
    const initialTimeout = setTimeout(checkForUpdate, 4000);

    // Periodic check
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

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
        const res = await fetch("/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, confirm: true }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Update failed");
        }

        if (updateInfo?.latestVersion) {
          setDismissedVersion(updateInfo.latestVersion);
        }
        setShowPopup(false);
        setUpdateInfo(null);

        // Recheck after a delay to reflect new state
        setTimeout(checkForUpdate, 10000);

        return true;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : "Update failed");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [updateInfo, checkForUpdate]
  );

  return {
    updateInfo,
    isAdmin,
    showPopup,
    isUpdating,
    updateError,
    dismissUpdate,
    performUpdate,
  };
}

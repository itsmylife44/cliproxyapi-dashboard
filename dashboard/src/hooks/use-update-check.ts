"use client";

import { useState, useEffect, useCallback } from "react";

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

const DISMISSED_KEY = "dashboard_update_dismissed";
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

export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
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

      // Check for updates
      const updateRes = await fetch("/api/update/dashboard/check");
      if (!updateRes.ok) return;
      const data: UpdateInfo = await updateRes.json();
      
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
    const initialTimeout = setTimeout(checkForUpdate, 3000);

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

  const performUpdate = useCallback(async (version: string) => {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const res = await fetch("/api/update/dashboard", {
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
  }, [updateInfo, checkForUpdate]);

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

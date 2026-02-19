"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useProxyUpdateCheck } from "@/hooks/use-proxy-update-check";
import { useToast } from "@/components/ui/toast";

export function ProxyUpdateNotification() {
  const {
    updateInfo,
    showPopup,
    isUpdating,
    updateError,
    dismissUpdate,
    performUpdate,
  } = useProxyUpdateCheck();
  const { showToast } = useToast();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  if (!showPopup || !updateInfo) return null;

  const targetVersion = selectedVersion || updateInfo.latestVersion || "latest";

  const handleUpdate = async () => {
    const success = await performUpdate(targetVersion);
    if (success) {
      showToast("Proxy update started! Container is restarting...", "success");
    }
  };

  const displayCurrentVersion =
    updateInfo.currentVersion === "unknown"
      ? updateInfo.currentDigest
      : updateInfo.currentVersion;

  return (
    <Modal isOpen={showPopup} onClose={dismissUpdate} className="max-w-lg">
      <ModalHeader>
        <ModalTitle>
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <title>Refresh</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </span>
            Proxy Update Available
          </span>
        </ModalTitle>
      </ModalHeader>

      <ModalContent>
        <div className="space-y-4">
          <p className="text-white/70 text-sm leading-relaxed">
            A new version of CLIProxyAPI (the proxy) is available. Would you like to update now?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Current</p>
              <p className="text-white font-mono text-sm font-medium">
                {displayCurrentVersion || "unknown"}
              </p>
            </div>
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3">
              <p className="text-[11px] uppercase tracking-wider text-cyan-400/60 mb-1">Latest</p>
              <p className="text-cyan-300 font-mono text-sm font-medium">
                {updateInfo.latestVersion || "latest"}
              </p>
            </div>
          </div>

          {updateInfo.availableVersions && updateInfo.availableVersions.length > 1 && (
            <div>
              <label
                htmlFor="proxy-version-select"
                className="block text-[11px] uppercase tracking-wider text-white/40 mb-2"
              >
                Or select a specific version
              </label>
              <select
                id="proxy-version-select"
                value={selectedVersion || ""}
                onChange={(e) => setSelectedVersion(e.target.value || null)}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-blue-500/50 transition-colors"
              >
                <option value="" className="bg-gray-900">
                  Latest ({updateInfo.latestVersion || "latest"})
                </option>
                {updateInfo.availableVersions
                  .filter((v) => v !== updateInfo.latestVersion)
                  .slice(0, 10)
                  .map((version) => (
                    <option key={version} value={version} className="bg-gray-900">
                      {version}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {updateError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-red-400 text-sm">{updateError}</p>
            </div>
          )}

          {isUpdating && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
              <div className="flex items-center gap-3">
                <svg
                  className="h-4 w-4 animate-spin text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Loading</title>
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <p className="text-blue-300 text-sm">
                  Updating to {targetVersion}... This may take a moment.
                </p>
              </div>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={dismissUpdate} disabled={isUpdating}>
          Later
        </Button>
        <Button variant="primary" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : `Update to ${targetVersion}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

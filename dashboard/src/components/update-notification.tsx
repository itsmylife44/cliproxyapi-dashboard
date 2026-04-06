"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useUpdateCheck } from "@/hooks/use-update-check";
import { UpdateOverlay } from "@/components/update-overlay";

export function UpdateNotification() {
  const {
    updateInfo,
    showPopup,
    showOverlay,
    isUpdating,
    updateError,
    dismissUpdate,
    performUpdate,
  } = useUpdateCheck();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const targetVersion = selectedVersion || updateInfo?.latestVersion || "latest";

  const handleUpdate = async () => {
    await performUpdate(targetVersion);
  };

  return (
    <>
      <UpdateOverlay
        isVisible={showOverlay}
        targetVersion={targetVersion}
        variant="dashboard"
      />

      {showPopup && updateInfo && (
        <Modal isOpen={showPopup} onClose={dismissUpdate} className="max-w-lg">
          <ModalHeader>
            <ModalTitle>
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e5e5e5]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#4e4e4e]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <title>Download</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </span>
                Dashboard Update Available
              </span>
            </ModalTitle>
          </ModalHeader>

          <ModalContent>
            <div className="space-y-4">
              <p className="text-[#4e4e4e] text-sm leading-relaxed">
                A new version of the Dashboard is available. Would you like to update now?
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#999] mb-1">Current</p>
                  <p className="text-black font-mono text-sm font-medium">
                    {updateInfo.currentVersion || "unknown"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#4e4e4e]/60 mb-1">Latest</p>
                  <p className="text-black font-mono text-sm font-medium">
                    {updateInfo.latestVersion || "latest"}
                  </p>
                </div>
              </div>

              {updateInfo.releaseNotes && (
                <div className="rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#999] mb-2">What&apos;s New</p>
                  <div className="prose prose-xs max-w-none max-h-40 overflow-y-auto scrollbar-thin text-[#777169] text-xs leading-relaxed [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-[#4e4e4e] [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-[#4e4e4e] [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-[#4e4e4e] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:bg-[#f0f0f0] [&_code]:px-1 [&_code]:rounded [&_a]:text-blue-600 [&_a]:underline [&_p]:my-1">
                    <Markdown>{updateInfo.releaseNotes}</Markdown>
                  </div>
                </div>
              )}

              {updateInfo.availableVersions && updateInfo.availableVersions.length > 1 && (
                <div>
                  <label
                    htmlFor="version-select"
                    className="block text-[11px] uppercase tracking-wider text-[#999] mb-2"
                  >
                    Or select a specific version
                  </label>
                  <select
                    id="version-select"
                    value={selectedVersion || ""}
                    onChange={(e) => setSelectedVersion(e.target.value || null)}
                    className="w-full rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-black text-sm px-3 py-2 outline-none focus:border-black/20 transition-colors"
                  >
                    <option value="" className="bg-white">
                      Latest ({updateInfo.latestVersion || "latest"})
                    </option>
                    {updateInfo.availableVersions
                      .filter((v) => v !== updateInfo.latestVersion)
                      .slice(0, 10)
                      .map((version) => (
                        <option key={version} value={version} className="bg-white">
                          {version}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {updateError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-red-600 text-sm">{updateError}</p>
                </div>
              )}

              {isUpdating && (
                <div className="rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] p-3">
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-4 w-4 animate-spin text-[#4e4e4e]"
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
                    <p className="text-black text-sm">
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
      )}
    </>
  );
}

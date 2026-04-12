"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useUpdateCheck } from "@/hooks/use-update-check";
import { UpdateOverlay } from "@/components/update-overlay";
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('updateOverlay');

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
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-border)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[var(--text-secondary)]"
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
                {t('dashboardTitle')}
              </span>
            </ModalTitle>
          </ModalHeader>

          <ModalContent>
            <div className="space-y-4">
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                {t('dashboardUpdateMessage')}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-border)] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{t('currentVersion')}</p>
                  <p className="text-[var(--text-primary)] font-mono text-sm font-medium">
                    {updateInfo.currentVersion || "unknown"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-border)] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)]/60 mb-1">{t('latestVersion')}</p>
                  <p className="text-[var(--text-primary)] font-mono text-sm font-medium">
                    {updateInfo.latestVersion || "latest"}
                  </p>
                </div>
              </div>

              {updateInfo.releaseNotes && (
                <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-border)] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('whatsNew')}</p>
                  <div className="prose prose-xs max-w-none max-h-40 overflow-y-auto scrollbar-thin text-[var(--text-muted)] text-xs leading-relaxed [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-[var(--text-secondary)] [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-[var(--text-secondary)] [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-[var(--text-secondary)] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:bg-[var(--surface-hover)] [&_code]:px-1 [&_code]:rounded [&_a]:text-blue-600 [&_a]:underline [&_p]:my-1">
                    <Markdown>{updateInfo.releaseNotes}</Markdown>
                  </div>
                </div>
              )}

              {updateInfo.availableVersions && updateInfo.availableVersions.length > 1 && (
                <div>
                  <label
                    htmlFor="version-select"
                    className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2"
                  >
                    {t('selectVersion')}
                  </label>
                  <select
                    id="version-select"
                    value={selectedVersion || ""}
                    onChange={(e) => setSelectedVersion(e.target.value || null)}
                    className="w-full rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm px-3 py-2 outline-none focus:border-[var(--accent)]/20 transition-colors"
                  >
                    <option value="" className="bg-[var(--surface-base)]">
                      Latest ({updateInfo.latestVersion || "latest"})
                    </option>
                    {updateInfo.availableVersions
                      .filter((v) => v !== updateInfo.latestVersion)
                      .slice(0, 10)
                      .map((version) => (
                        <option key={version} value={version} className="bg-[var(--surface-base)]">
                          {version}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {updateError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-red-600 text-sm">{updateError}</p>
                </div>
              )}

              {isUpdating && (
                <div className="rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] p-3">
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-4 w-4 animate-spin text-[var(--text-secondary)]"
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
                    <p className="text-[var(--text-primary)] text-sm">
                      {t('updatingMessage', { targetVersion })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ModalContent>

          <ModalFooter>
            <Button variant="ghost" onClick={dismissUpdate} disabled={isUpdating}>
              {t('laterButton')}
            </Button>
            <Button variant="primary" onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? t('updatingButton') : t('updateToButton', { version: targetVersion })}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}

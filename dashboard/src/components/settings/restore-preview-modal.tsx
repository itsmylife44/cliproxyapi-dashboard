"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";

interface RestorePreview {
  backupDate: string;
  dashboardVersion: string;
  backupVersion?: number;
  isCompatible?: boolean;
  warnings?: string[];
  counts: {
    users: number;
    providerKeys: number;
    oauthAccounts: number;
    customProviders: number;
    usageRecords: number;
    auditLogs: number;
  };
}

interface RestorePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: RestorePreview | null;
  currentVersion: string;
  restoring: boolean;
}

export function RestorePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  preview,
  currentVersion,
  restoring,
}: RestorePreviewModalProps) {
  const t = useTranslations("backup.preview");
  const tBackup = useTranslations("backup");

  if (!preview) return null;

  const versionMismatch = preview.dashboardVersion !== currentVersion;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <ModalHeader>
        <ModalTitle>{t("title")}</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">{t("backupFrom")}</span>
              <div className="font-medium text-[var(--text-primary)]">
                {new Date(preview.backupDate).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">{t("version")}</span>
              <div className="font-medium text-[var(--text-primary)]">
                {preview.dashboardVersion}
              </div>
            </div>
          </div>

          {versionMismatch && (
            <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700">
              <div className="flex items-start gap-2">
                <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-medium">{t("versionMismatch")}</div>
                  <div className="text-xs mt-1">
                    {t("currentVersion")}: {currentVersion}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--surface-border)] pt-4">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("willRestore")}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between rounded-sm bg-[var(--surface-muted)] px-3 py-2">
                <span className="text-[var(--text-muted)]">Users</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {t("users", { count: preview.counts.users })}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-sm bg-[var(--surface-muted)] px-3 py-2">
                <span className="text-[var(--text-muted)]">Provider Keys</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {t("providerKeys", { count: preview.counts.providerKeys })}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-sm bg-[var(--surface-muted)] px-3 py-2">
                <span className="text-[var(--text-muted)]">OAuth Accounts</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {t("oauthAccounts", { count: preview.counts.oauthAccounts })}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-sm bg-[var(--surface-muted)] px-3 py-2">
                <span className="text-[var(--text-muted)]">Custom Providers</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {t("customProviders", { count: preview.counts.customProviders })}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-sm bg-[var(--surface-muted)] px-3 py-2">
                <span className="text-[var(--text-muted)]">Usage Records</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {t("usageRecords", { count: preview.counts.usageRecords })}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-sm bg-[var(--surface-muted)] px-3 py-2">
                <span className="text-[var(--text-muted)]">Audit Logs</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {t("auditLogs", { count: preview.counts.auditLogs })}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{t("warning")}</span>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={restoring}>
          {t("cancel")}
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={restoring}>
          {restoring ? tBackup("restoring") : t("confirmRestore")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

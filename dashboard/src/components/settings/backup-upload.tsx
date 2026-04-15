"use client";

import { useTranslations } from "next-intl";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { RestorePreviewModal } from "./restore-preview-modal";

interface RestorePreview {
  backupDate: string;
  dashboardVersion: string;
  counts: {
    users: number;
    providerKeys: number;
    oauthAccounts: number;
    customProviders: number;
    usageRecords: number;
    auditLogs: number;
  };
}

interface BackupUploadProps {
  currentVersion: string;
  onRestoreSuccess: () => void;
  onError: (message: string) => void;
}

export function BackupUpload({ currentVersion, onRestoreSuccess, onError }: BackupUploadProps) {
  const t = useTranslations("backup.upload");
  const tBackup = useTranslations("backup");
  const tError = useTranslations("backup.error");
  const tSuccess = useTranslations("backup.success");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file inline
    if (!file.name.endsWith(".json.gz")) {
      onError(t("invalidFile"));
      return;
    }
    // 100MB max
    if (file.size > 100 * 1024 * 1024) {
      onError(t("fileTooLarge", { maxSize: "100MB" }));
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP_PREVIEW, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || tError("uploadFailed"));
      }

      const responseData = await response.json();
      setPreview(responseData.preview);
      setShowPreviewModal(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : tError("uploadFailed"));
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  }, [onError, t, tError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setRestoring(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP_RESTORE, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || tError("restoreFailed"));
      }

      setShowPreviewModal(false);
      setSelectedFile(null);
      setPreview(null);
      onRestoreSuccess();

      // Redirect to login after successful restore
      window.location.href = "/login?restored=true";
    } catch (err) {
      onError(err instanceof Error ? err.message : tError("restoreFailed"));
    } finally {
      setRestoring(false);
    }
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
    setSelectedFile(null);
    setPreview(null);
  };

  return (
    <>
      <label
        className={`relative block rounded-sm border-2 border-dashed transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-500/5"
            : "border-[var(--surface-border)] bg-[var(--surface-base)]"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json.gz"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center px-6 py-8">
          {uploading ? (
            <>
              <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t("uploading")}</p>
            </>
          ) : selectedFile ? (
            <>
              <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-sm text-[var(--text-primary)]">
                {t("selectedFile", { filename: selectedFile.name })}
              </p>
            </>
          ) : (
            <>
              <svg className="h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-[var(--text-primary)]">{t("dragDrop")}</p>
              <p className="text-xs text-[var(--text-muted)]">{t("orClick")}</p>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3"
              >
                {t("selectFile")}
              </Button>
            </>
          )}
        </div>
      </label>

      <RestorePreviewModal
        isOpen={showPreviewModal}
        onClose={handleClosePreview}
        onConfirm={handleRestore}
        preview={preview}
        currentVersion={currentVersion}
        restoring={restoring}
      />
    </>
  );
}

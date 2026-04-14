"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { extractApiError } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface BackupRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  recordCounts: Record<string, number>;
  trigger: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface DiskSpace {
  availableBytes: number;
  totalBytes: number;
  ok: boolean;
}

interface Schedule {
  enabled: boolean;
  intervalHours: number;
}

interface RestorePreview {
  metadata: {
    version: string;
    dashboardVersion: string;
    timestamp: string;
    recordCounts: Record<string, number>;
  };
  currentCounts: Record<string, number>;
  backupCounts: Record<string, number>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function BackupSettings() {
  const t = useTranslations("backup");
  const tc = useTranslations("common");
  const { showToast } = useToast();

  // State
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [diskSpace, setDiskSpace] = useState<DiskSpace | null>(null);
  const [schedule, setSchedule] = useState<Schedule>({ enabled: false, intervalHours: 24 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);

  // Dialog state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  // Fetch functions
  const fetchBackups = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.BACKUP, { signal });
      const data = await res.json();
      
      if (data.success) {
        setBackups(data.backups || []);
        setDiskSpace(data.diskSpace || null);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        showToast(t("networkError"), "error");
      }
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  const fetchSchedule = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.BACKUP_SCHEDULE, { signal });
      const data = await res.json();
      
      if (data.success) {
        setSchedule(data.schedule);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Failed to fetch schedule:", error);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchBackups(controller.signal);
    fetchSchedule(controller.signal);
    return () => controller.abort();
  }, [fetchBackups, fetchSchedule]);

  // Backup operations
  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.BACKUP, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        showToast(t("backupCreated"), "success");
        await fetchBackups();
      } else {
        showToast(extractApiError(data, t("backupFailed")), "error");
      }
    } catch {
      showToast(t("networkError"), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.ADMIN.BACKUP}/${id}`);
      if (!res.ok) {
        showToast(t("backupFailed"), "error");
        return;
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t("networkError"), "error");
    }
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setShowConfirmDelete(true);
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    
    setDeleting(pendingDeleteId);
    try {
      const res = await fetch(`${API_ENDPOINTS.ADMIN.BACKUP}/${pendingDeleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast(t("backupDeleted"), "success");
        await fetchBackups();
      } else {
        showToast(t("backupDeleteFailed"), "error");
      }
    } catch {
      showToast(t("networkError"), "error");
    } finally {
      setDeleting(null);
      setShowConfirmDelete(false);
      setPendingDeleteId(null);
    }
  };

  // Schedule operations
  const handleScheduleChange = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.BACKUP_SCHEDULE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const data = await res.json();

      if (data.success) {
        showToast(t("scheduleSaved"), "success");
        setSchedule(data.schedule);
      } else {
        showToast(extractApiError(data, t("scheduleSaveFailed")), "error");
      }
    } catch {
      showToast(t("networkError"), "error");
    } finally {
      setSavingSchedule(false);
    }
  };

  // File upload operations
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files.find(f => f.name.endsWith(".gz"));
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      showToast(t("fileTooLarge"), "error");
      return;
    }
    
    if (!file.name.endsWith(".gz")) {
      showToast(t("invalidFile"), "error");
      return;
    }
    
    setSelectedFile(file);
    setPreview(null);
  };

  const handlePreviewRestore = async () => {
    if (!selectedFile) return;
    
    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      const res = await fetch(`${API_ENDPOINTS.ADMIN.RESTORE}?preview=true`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setPreview(data.preview);
      } else {
        showToast(extractApiError(data, t("invalidFile")), "error");
      }
    } catch {
      showToast(t("networkError"), "error");
    } finally {
      setPreviewing(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      const res = await fetch(API_ENDPOINTS.ADMIN.RESTORE, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        showToast(t("restoreSuccess"), "success");
        setSelectedFile(null);
        setPreview(null);
        await fetchBackups();
      } else {
        showToast(extractApiError(data, t("restoreFailed")), "error");
      }
    } catch {
      showToast(t("networkError"), "error");
    } finally {
      setRestoring(false);
      setShowConfirmRestore(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case "manual": return t("triggerManual");
      case "scheduled": return t("triggerScheduled");
      case "pre_restore": return t("triggerPreRestore");
      default: return trigger;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium";
    switch (status) {
      case "completed":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "failed":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "in_progress":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return t("statusCompleted");
      case "failed": return t("statusFailed");
      case "in_progress": return t("statusInProgress");
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Backup + Disk Space Header */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handleCreateBackup}
          disabled={creating}
          variant="primary"
        >
          {creating ? t("creatingBackup") : t("createBackup")}
        </Button>
        
        {diskSpace && (
          <div className={`text-sm ${!diskSpace.ok ? "text-red-600" : "text-[var(--text-muted)]"}`}>
            {diskSpace.availableBytes < 0 ? (
              t("diskSpaceUnknown")
            ) : diskSpace.ok ? (
              t("diskSpaceAvailable", {
                available: formatBytes(diskSpace.availableBytes),
                total: formatBytes(diskSpace.totalBytes),
              })
            ) : (
              t("diskSpaceLow")
            )}
          </div>
        )}
      </div>

      {/* Backup History */}
      <div className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {t("historyTitle")}
        </h3>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {t("historyDescription")}
        </p>

        {loading ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            {t("historyLoading")}
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            {t("historyEmpty")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--surface-border)]">
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--text-secondary)]">
                    {t("headerFilename")}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--text-secondary)]">
                    {t("headerSize")}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--text-secondary)]">
                    {t("headerTrigger")}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--text-secondary)]">
                    {t("headerStatus")}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--text-secondary)]">
                    {t("headerCreatedAt")}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--text-secondary)]">
                    {t("headerActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id} className="border-b border-[var(--surface-border)]/50">
                    <td className="py-3 px-2 text-sm text-[var(--text-primary)]">
                      {backup.filename}
                    </td>
                    <td className="py-3 px-2 text-sm text-[var(--text-muted)]">
                      {formatBytes(backup.sizeBytes)}
                    </td>
                    <td className="py-3 px-2 text-sm text-[var(--text-muted)]">
                      {getTriggerLabel(backup.trigger)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={getStatusBadge(backup.status)}>
                        {getStatusLabel(backup.status)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm text-[var(--text-muted)]">
                      {formatDate(backup.createdAt)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        {backup.status === "completed" && (
                          <Button
                            variant="ghost"
                            onClick={() => handleDownload(backup.id, backup.filename)}
                          >
                            {t("downloadBackup")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteClick(backup.id)}
                          disabled={deleting === backup.id}
                        >
                          {deleting === backup.id ? t("deletingBackup") : t("deleteBackup")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore from File */}
      <div className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {t("restoreTitle")}
        </h3>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {t("restoreDescription")}
        </p>

        <div className="space-y-4">
          {/* File Drop Zone */}
          {selectedFile ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center border-[var(--surface-border)]">
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-primary)]">
                  {t("selectedFile", { filename: selectedFile.name })}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                >
                  {tc('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <label
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer block ${
                isDragging
                  ? "border-blue-400 bg-blue-50/50"
                  : "border-[var(--surface-border)] hover:border-[var(--surface-border)]/80"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".gz"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <p className="text-[var(--text-muted)]">
                {isDragging ? t("dropZoneActive") : t("dropZoneText")}
              </p>
            </label>
          )}

          {/* Preview/Restore Actions */}
          {selectedFile && (
            <div className="flex gap-2">
              <Button
                onClick={handlePreviewRestore}
                disabled={previewing}
                variant="secondary"
              >
                {previewing ? t("previewing") : t("previewRestore")}
              </Button>
              
              {preview && (
                <Button
                  onClick={() => setShowConfirmRestore(true)}
                  disabled={restoring}
                  variant="danger"
                >
                  {restoring ? t("restoring") : t("confirmRestore")}
                </Button>
              )}
            </div>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] p-4">
              <h4 className="font-medium text-[var(--text-primary)] mb-2">
                {t("previewTitle")}
              </h4>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                {t("previewDescription")}
              </p>
              
              {/* Metadata */}
              <div className="mb-4 text-sm">
                <p className="text-[var(--text-secondary)]">
                  <strong>{t("previewVersion")}:</strong> {preview.metadata.dashboardVersion}
                </p>
                <p className="text-[var(--text-secondary)]">
                  <strong>{t("previewCreatedAt")}:</strong> {formatDate(preview.metadata.timestamp)}
                </p>
              </div>

              {/* Data Counts Table */}
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)]">
                      <th className="text-left py-2 text-[var(--text-secondary)]">
                        {t("previewTableName")}
                      </th>
                      <th className="text-left py-2 text-[var(--text-secondary)]">
                        {t("previewCurrentCount")}
                      </th>
                      <th className="text-left py-2 text-[var(--text-secondary)]">
                        {t("previewBackupCount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(preview.backupCounts).map((table) => (
                      <tr key={table} className="border-b border-[var(--surface-border)]/50">
                        <td className="py-2 text-[var(--text-primary)]">{table}</td>
                        <td className="py-2 text-[var(--text-muted)]">
                          {preview.currentCounts[table] || 0}
                        </td>
                        <td className="py-2 text-[var(--text-muted)]">
                          {preview.backupCounts[table] || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <p className="text-sm text-amber-600">
                {t("previewWarning")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Backups */}
      <div className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {t("scheduleTitle")}
        </h3>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {t("scheduleDescription")}
        </p>

        <div className="space-y-4">
          <label htmlFor="schedule-enabled" className="flex items-center gap-3">
            <input
              id="schedule-enabled"
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
              className="rounded border-[var(--surface-border)]"
            />
            <span className="text-[var(--text-primary)]">{t("scheduleEnabled")}</span>
          </label>

          {schedule.enabled && (
            <div className="space-y-2">
              <label htmlFor="schedule-interval" className="block text-sm font-medium text-[var(--text-secondary)]">
                {t("scheduleInterval")}
              </label>
              <input
                id="schedule-interval"
                type="number"
                min="1"
                max="168"
                value={schedule.intervalHours}
                onChange={(e) => setSchedule({ ...schedule, intervalHours: parseInt(e.target.value) || 24 })}
                className="block w-24 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("scheduleIntervalHint")}
              </p>
            </div>
          )}

          <Button
            onClick={handleScheduleChange}
            disabled={savingSchedule}
            variant="secondary"
          >
            {savingSchedule ? t("scheduleSaving") : tc("save")}
          </Button>
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false);
          setPendingDeleteId(null);
        }}
        onConfirm={handleDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteMessage")}
        confirmLabel={t("confirmDeleteLabel")}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showConfirmRestore}
        onClose={() => setShowConfirmRestore(false)}
        onConfirm={handleRestore}
        title={t("confirmRestoreTitle")}
        message={t("confirmRestoreMessage")}
        confirmLabel={t("confirmRestoreLabel")}
        variant="danger"
      />
    </div>
  );
}
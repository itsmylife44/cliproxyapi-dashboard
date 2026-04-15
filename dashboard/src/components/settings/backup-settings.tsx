"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { StorageIndicator } from "./storage-indicator";
import { BackupHistory } from "./backup-history";
import { BackupUpload } from "./backup-upload";

interface Backup {
  id: string;
  filename: string;
  sizeBytes: string; // Backend returns BigInt as string
  type: "MANUAL" | "SCHEDULED"; // Backend uses SCREAMING_CASE
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  createdAt: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    username: string;
  };
}

interface BackupSchedule {
  enabled: boolean;
  cronExpr: string; // Backend uses cronExpr not cronExpression
  retention: number; // Backend uses retention not retentionDays
  nextRun: string | null;
  lastRun: string | null;
}

interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  backupCount: number;
}

interface BackupSettingsProps {
  currentVersion: string;
  showToast: (message: string, type: "success" | "error") => void;
}

export function BackupSettings({ currentVersion, showToast }: BackupSettingsProps) {
  const t = useTranslations("backup");
  const tSchedule = useTranslations("backup.schedule");
  const tSuccess = useTranslations("backup.success");
  const tError = useTranslations("backup.error");

  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  // Local state for schedule form
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState("0 3 * * *");
  const [retentionDays, setRetentionDays] = useState(30);

  const fetchBackups = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP);
      if (!response.ok) throw new Error("Failed to fetch backups");
      const data = await response.json();
      setBackups(data.backups || []);
    } catch {
      showToast(tError("fetchFailed"), "error");
    } finally {
      setBackupsLoading(false);
    }
  }, [showToast, tError]);

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP_SCHEDULE);
      if (!response.ok) throw new Error("Failed to fetch schedule");
      const data = await response.json();
      const scheduleData = data.schedule;
      setSchedule(scheduleData);
      setScheduleEnabled(scheduleData.enabled);
      setCronExpression(scheduleData.cronExpr || "0 3 * * *");
      setRetentionDays(scheduleData.retention || 30);
    } catch {
      // Schedule might not exist yet
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const fetchStorage = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP_STORAGE);
      if (!response.ok) throw new Error("Failed to fetch storage");
      const data = await response.json();
      setStorage(data.storage);
    } catch {
      // Storage info might not be available
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchSchedule();
    fetchStorage();
  }, [fetchBackups, fetchSchedule, fetchStorage]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || tError("createFailed"));
      }
      showToast(tSuccess("created"), "success");
      fetchBackups();
      fetchStorage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : tError("createFailed"), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    setDeleting(id);
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.BACKUP}?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || tError("deleteFailed"));
      }
      showToast(tSuccess("deleted"), "success");
      fetchBackups();
      fetchStorage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : tError("deleteFailed"), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.BACKUP_SCHEDULE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: scheduleEnabled,
          cronExpr: cronExpression,
          retention: retentionDays,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || tError("scheduleFailed"));
      }
      const data = await response.json();
      setSchedule(data.schedule);
      showToast(tSuccess("scheduled"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : tError("scheduleFailed"), "error");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleRestoreSuccess = () => {
    showToast(tSuccess("restored"), "success");
  };

  const handleRestoreError = (message: string) => {
    showToast(message, "error");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h2>
        <p className="text-xs text-[var(--text-muted)]">{t("description")}</p>
      </div>

      {/* Create Backup & Storage */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("createBackup")}</h3>
          <Button onClick={handleCreateBackup} disabled={creating}>
            {creating ? t("creating") : t("createNow")}
          </Button>
        </div>
        <StorageIndicator storage={storage} loading={storageLoading} />
      </div>

      {/* Scheduled Backups */}
      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{tSchedule("title")}</h3>
        
        {scheduleLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-10 w-full animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--surface-border)] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-[var(--text-primary)]">{tSchedule("enable")}</span>
            </label>

            {scheduleEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="backup-cron-expression" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    {tSchedule("cron")}
                  </label>
                  <input
                    id="backup-cron-expression"
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 3 * * *"
                    className="w-full rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{tSchedule("cronHint")}</p>
                </div>
                <div>
                  <label htmlFor="backup-retention-days" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    {tSchedule("retention")}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="backup-retention-days"
                      type="number"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={365}
                      className="w-20 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none"
                    />
                    <span className="text-sm text-[var(--text-muted)]">
                      {tSchedule("retentionDays", { count: retentionDays })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {schedule && (
              <div className="flex gap-4 text-xs text-[var(--text-muted)] border-t border-[var(--surface-border)] pt-3">
                <span>
                  {tSchedule("nextRun")}: {schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : tSchedule("never")}
                </span>
                <span>
                  {tSchedule("lastRun")}: {schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : tSchedule("never")}
                </span>
              </div>
            )}

            <Button onClick={handleSaveSchedule} disabled={scheduleSaving}>
              {scheduleSaving ? "..." : tSchedule("save")}
            </Button>
          </div>
        )}
      </div>

      {/* Restore from Backup */}
      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("restore")}</h3>
        <BackupUpload
          currentVersion={currentVersion}
          onRestoreSuccess={handleRestoreSuccess}
          onError={handleRestoreError}
        />
      </div>

      {/* Backup History */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("history.title")}</h3>
        <BackupHistory
          backups={backups}
          loading={backupsLoading}
          onDelete={handleDeleteBackup}
          deleting={deleting}
        />
      </div>
    </div>
  );
}

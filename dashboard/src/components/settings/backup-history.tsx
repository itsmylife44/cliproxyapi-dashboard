"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useState } from "react";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

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

interface BackupHistoryProps {
  backups: Backup[];
  loading: boolean;
  onDelete: (id: string) => void;
  deleting: string | null;
}

function formatBytes(bytes: string | number): string {
  const numBytes = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (numBytes === 0 || isNaN(numBytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  return `${parseFloat((numBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function BackupHistory({ backups, loading, onDelete, deleting }: BackupHistoryProps) {
  const t = useTranslations("backup.history");
  const tConfirm = useTranslations("backup.confirmDelete");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDownload = async (id: string, filename: string) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN.BACKUP}/${id}/download`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // Error handled by parent
    }
  };

  const getStatusBadge = (status: Backup["status"]) => {
    const styles: Record<Backup["status"], string> = {
      PENDING: "bg-yellow-500/10 text-yellow-600",
      IN_PROGRESS: "bg-blue-500/10 text-blue-600",
      COMPLETED: "bg-emerald-500/10 text-emerald-600",
      FAILED: "bg-red-500/10 text-red-600",
    };
    const labels: Record<Backup["status"], string> = {
      PENDING: t("pending"),
      IN_PROGRESS: t("inProgress"),
      COMPLETED: t("completed"),
      FAILED: t("failed"),
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-sm bg-[var(--surface-muted)]" />
        ))}
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">{t("noBackups")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-muted)]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">{t("date")}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">{t("size")}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">{t("type")}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">{t("status")}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.id} className="border-b border-[var(--surface-border)] last:border-b-0">
                <td className="px-3 py-2 text-[var(--text-primary)]">
                  {new Date(backup.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatBytes(backup.sizeBytes)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    backup.type === "MANUAL" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"
                  }`}>
                    {backup.type === "MANUAL" ? t("manual") : t("scheduled")}
                  </span>
                </td>
                <td className="px-3 py-2">{getStatusBadge(backup.status)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    {backup.status === "COMPLETED" && (
                      <Button
                        variant="secondary"
                        onClick={() => handleDownload(backup.id, backup.filename)}
                      >
                        {t("download")}
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      onClick={() => setConfirmDeleteId(backup.id)}
                      disabled={deleting === backup.id}
                    >
                      {deleting === backup.id ? "..." : t("delete")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) {
            onDelete(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        title={tConfirm("title")}
        message={tConfirm("message")}
        confirmLabel={tConfirm("confirm")}
        cancelLabel={tConfirm("cancel")}
        variant="danger"
      />
    </>
  );
}

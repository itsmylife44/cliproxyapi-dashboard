"use client";

import { useTranslations } from "next-intl";

interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  backupCount: number;
}

interface StorageIndicatorProps {
  storage: StorageInfo | null;
  loading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function StorageIndicator({ storage, loading }: StorageIndicatorProps) {
  const t = useTranslations("backup.storage");

  if (loading) {
    return (
      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
        <div className="h-2 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="mt-2 h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
    );
  }

  if (!storage) {
    return (
      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
        <div className="text-sm text-[var(--text-muted)]">{t("unknown")}</div>
      </div>
    );
  }

  const percentUsed = storage.totalBytes > 0 
    ? Math.round((storage.usedBytes / storage.totalBytes) * 100) 
    : 0;
  const isWarning = percentUsed > 90;

  const usedFormatted = formatBytes(storage.usedBytes);
  const totalFormatted = formatBytes(storage.totalBytes);
  const freeFormatted = formatBytes(storage.freeBytes);

  return (
    <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">{t("title")}</span>
        {isWarning && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {t("warning")}
          </span>
        )}
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
            isWarning ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>
          {t("used", { used: usedFormatted, total: totalFormatted })}
        </span>
        <span className="text-[var(--text-muted)]">
          {t("free", { free: freeFormatted })}
        </span>
      </div>
    </div>
  );
}

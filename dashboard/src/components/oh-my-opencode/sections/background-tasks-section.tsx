"use client";

import { useTranslations } from "next-intl";
import type { BackgroundTaskConfig, OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";

interface ConcurrencyRow {
  _id: string;
  key: string;
  value: number;
}

interface BackgroundTasksSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  overrides: OhMyOpenCodeFullConfig;
  providerConcurrencyRows: ReadonlyArray<ConcurrencyRow>;
  modelConcurrencyRows: ReadonlyArray<ConcurrencyRow>;
  onBgTaskNumberChange: (field: keyof BackgroundTaskConfig, value: number) => void;
  onProviderConcurrencyChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onProviderConcurrencyAdd: () => void;
  onProviderConcurrencyRemove: (index: number) => void;
  onModelConcurrencyChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onModelConcurrencyAdd: () => void;
  onModelConcurrencyRemove: (index: number) => void;
}

export function BackgroundTasksSection({
  isExpanded,
  onToggleExpand,
  overrides,
  providerConcurrencyRows,
  modelConcurrencyRows,
  onBgTaskNumberChange,
  onProviderConcurrencyChange,
  onProviderConcurrencyAdd,
  onProviderConcurrencyRemove,
  onModelConcurrencyChange,
  onModelConcurrencyAdd,
  onModelConcurrencyRemove,
}: BackgroundTasksSectionProps) {
  const t = useTranslations("ohMyOpenCode");

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-muted)] overflow-hidden transition-colors hover:border-[var(--surface-border)]">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="flex-1 text-left">{t("backgroundTasks")}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{t("defaultConcurrency")}</span>
            <input
              type="number"
              min={1}
              defaultValue={overrides.background_task?.defaultConcurrency ?? 5}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(parsed) && parsed > 0) {
                  onBgTaskNumberChange("defaultConcurrency", parsed);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{t("staleTimeout")}</span>
            <input
              type="number"
              min={60000}
              defaultValue={overrides.background_task?.staleTimeoutMs ?? 180000}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(parsed) && parsed >= 60000) {
                  onBgTaskNumberChange("staleTimeoutMs", parsed);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">{t("providerConcurrency")}</span>
              <button
                type="button"
                onClick={onProviderConcurrencyAdd}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {t("addItem")}
              </button>
            </div>
            {providerConcurrencyRows.map((row, idx) => (
              <div key={row._id} className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("providerPlaceholder")}
                  value={row.key}
                  onChange={(e) => onProviderConcurrencyChange(idx, "key", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
                />
                <input
                  type="number"
                  min={1}
                  value={row.value}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed) && parsed > 0) {
                      onProviderConcurrencyChange(idx, "value", parsed);
                    }
                  }}
                  className="w-20 px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
                />
                <button
                  type="button"
                  onClick={() => onProviderConcurrencyRemove(idx)}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  {t("removeItem")}
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">{t("modelConcurrency")}</span>
              <button
                type="button"
                onClick={onModelConcurrencyAdd}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {t("addItem")}
              </button>
            </div>
            {modelConcurrencyRows.map((row, idx) => (
              <div key={row._id} className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("modelPlaceholder")}
                  value={row.key}
                  onChange={(e) => onModelConcurrencyChange(idx, "key", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
                />
                <input
                  type="number"
                  min={1}
                  value={row.value}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed) && parsed > 0) {
                      onModelConcurrencyChange(idx, "value", parsed);
                    }
                  }}
                  className="w-20 px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
                />
                <button
                  type="button"
                  onClick={() => onModelConcurrencyRemove(idx)}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  {t("removeItem")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

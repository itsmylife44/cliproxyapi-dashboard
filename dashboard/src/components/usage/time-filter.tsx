"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type DateFilter = "today" | "7d" | "30d" | "all" | "custom";

interface TimeFilterProps {
  activeFilter: DateFilter;
  customFrom: string;
  customTo: string;
  onFilterChange: (filter: DateFilter) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onCustomDateApply: () => void;
}

const PRESETS = [
  { id: "today", labelKey: "today" },
  { id: "7d", labelKey: "sevenDays" },
  { id: "30d", labelKey: "thirtyDays" },
  { id: "all", labelKey: "allTime" },
] as const;

export function TimeFilter({
  activeFilter,
  customFrom,
  customTo,
  onFilterChange,
  onCustomFromChange,
  onCustomToChange,
  onCustomDateApply,
}: TimeFilterProps) {
  const t = useTranslations("usage");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div
        role="group"
        aria-label={t("timePeriod")}
        className="inline-flex rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
      >
        {PRESETS.map((preset) => {
          const active = activeFilter === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onFilterChange(preset.id)}
              aria-pressed={active}
              className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(preset.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="custom-from" className="text-[11px] text-[var(--text-muted)]">
          {t("from")}
        </label>
        <input
          id="custom-from"
          type="date"
          value={customFrom}
          onChange={(e) => onCustomFromChange(e.target.value)}
          className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-primary)]"
        />
        <label htmlFor="custom-to" className="text-[11px] text-[var(--text-muted)]">
          {t("to")}
        </label>
        <input
          id="custom-to"
          type="date"
          value={customTo}
          onChange={(e) => onCustomToChange(e.target.value)}
          className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-primary)]"
        />
        <Button onClick={onCustomDateApply} disabled={!customFrom || !customTo} variant="secondary" className="px-2.5 py-1 text-xs">
          {t("apply")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const PRESETS = { today: 1, sevenDays: 7, thirtyDays: 30, allTime: null } as const;
const ALL_TIME = { from: "2020-01-01", to: "2099-12-31" };
type Preset = keyof typeof PRESETS;
type DateRange = { from: string; to: string };
export type DateFilter = Preset | DateRange;

export function getDateRange(filter: DateFilter): DateRange {
  if (typeof filter !== "string") return filter;
  const days = PRESETS[filter];
  if (days === null) return ALL_TIME;
  const date = new Date();
  const to = date.toLocaleDateString("en-CA");
  date.setDate(date.getDate() - (days - 1));
  return { from: date.toLocaleDateString("en-CA"), to };
}

interface TimeFilterProps {
  activeFilter: DateFilter;
  onFilterChange: (filter: DateFilter) => void;
}

export function TimeFilter({ activeFilter, onFilterChange }: TimeFilterProps) {
  const t = useTranslations("usage");
  const id = useId();
  const [draft, setDraft] = useState<DateRange>({ from: "", to: "" });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div
        role="group"
        aria-label={t("timePeriod")}
        className="inline-flex max-w-full flex-wrap rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 p-0.5"
      >
        {(Object.keys(PRESETS) as Preset[]).map((preset) => {
          const active = activeFilter === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onFilterChange(preset)}
              aria-pressed={active}
              className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(preset)}
            </button>
          );
        })}
      </div>

      <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
        event.preventDefault();
        onFilterChange(draft);
      }}>
        {(["from", "to"] as const).map((field) => (
          <label key={field} htmlFor={`${id}-${field}`} className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {t(field)}
            <input
              id={`${id}-${field}`}
              type="date"
              required
              value={draft[field]}
              min={field === "to" ? draft.from || undefined : undefined}
              onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
              className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-primary)]"
            />
          </label>
        ))}
        <Button type="submit" disabled={!draft.from || !draft.to} variant="secondary" className="px-2.5 py-1 text-xs">
          {t("apply")}
        </Button>
      </form>
    </div>
  );
}

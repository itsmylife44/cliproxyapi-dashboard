"use client";

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

export function TimeFilter({
  activeFilter,
  customFrom,
  customTo,
  onFilterChange,
  onCustomFromChange,
  onCustomToChange,
  onCustomDateApply,
}: TimeFilterProps) {
  return (
    <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Time Period</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onFilterChange("today")}
          variant={activeFilter === "today" ? "primary" : "secondary"}
          className="text-xs"
        >
          Today
        </Button>
        <Button
          onClick={() => onFilterChange("7d")}
          variant={activeFilter === "7d" ? "primary" : "secondary"}
          className="text-xs"
        >
          7 Days
        </Button>
        <Button
          onClick={() => onFilterChange("30d")}
          variant={activeFilter === "30d" ? "primary" : "secondary"}
          className="text-xs"
        >
          30 Days
        </Button>
        <Button
          onClick={() => onFilterChange("all")}
          variant={activeFilter === "all" ? "primary" : "secondary"}
          className="text-xs"
        >
          All Time
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="custom-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">From</label>
          <input
            id="custom-from"
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2 py-1 text-xs text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="custom-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">To</label>
          <input
            id="custom-to"
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2 py-1 text-xs text-slate-100"
          />
        </div>
        <Button onClick={onCustomDateApply} disabled={!customFrom || !customTo} className="text-xs">
          Apply
        </Button>
      </div>
    </section>
  );
}

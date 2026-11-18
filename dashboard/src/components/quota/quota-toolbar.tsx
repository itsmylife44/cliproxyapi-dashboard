"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  QUOTA_PROVIDERS,
  QUOTA_STATUSES,
  type QuotaQueryProvider,
  type QuotaQueryState,
  type QuotaQueryStatus,
} from "@/lib/quota/query-state";

interface QuotaToolbarProps {
  query: QuotaQueryState;
  total: number;
  onSearchChange: (value: string) => void;
  onProviderChange: (value: QuotaQueryProvider) => void;
  onStatusChange: (value: QuotaQueryStatus) => void;
  onClear: () => void;
}

export function QuotaToolbar({
  query,
  total,
  onSearchChange,
  onProviderChange,
  onStatusChange,
  onClear,
}: QuotaToolbarProps) {
  const t = useTranslations("quota");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasFacetFilter = query.provider !== "all" || query.status !== "all";
  const hasFilters = query.q !== "" || hasFacetFilter || query.page !== 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          name="quota-search"
          aria-label={t("searchLabel")}
          value={query.q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchLabel")}
          className="glass-input h-7 w-28 rounded-md pl-6 pr-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[width] duration-200 focus:w-44 focus:outline-none sm:w-32"
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("providerFilterLabel")}
        aria-expanded={open}
        title={t("providerFilterLabel")}
        className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
          hasFacetFilter || open
            ? "border-[var(--accent)] bg-[var(--surface-hover)] text-[var(--text-primary)]"
            : "border-[var(--surface-border)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {hasFacetFilter && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-500" />
        )}
      </button>

      {open && (
        <div className="glass-card absolute right-0 top-9 z-30 w-60 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 shadow-lg">
          <div className="space-y-2.5">
            <label className="block space-y-1 text-[11px] font-medium text-[var(--text-muted)]">
              <span>{t("providerFilterLabel")}</span>
              <select
                value={query.provider}
                onChange={(event) => onProviderChange(event.target.value as QuotaQueryProvider)}
                className="glass-input h-8 w-full rounded-md px-2 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                {QUOTA_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {t(`providerOption.${provider}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-[11px] font-medium text-[var(--text-muted)]">
              <span>{t("statusFilterLabel")}</span>
              <select
                value={query.status}
                onChange={(event) => onStatusChange(event.target.value as QuotaQueryStatus)}
                className="glass-input h-8 w-full rounded-md px-2 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                {QUOTA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`statusOption.${status}`)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between border-t border-[var(--surface-border)] pt-2 text-[11px] text-[var(--text-muted)]">
              <span className="tabular-nums">{t("resultsCount", { count: total })}</span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                  className="font-medium text-[var(--text-primary)] hover:underline"
                >
                  {t("clearFiltersButton")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

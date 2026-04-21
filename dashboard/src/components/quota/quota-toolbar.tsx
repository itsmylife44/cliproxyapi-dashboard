"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const hasFilters =
    query.q !== "" || query.provider !== "all" || query.status !== "all" || query.page !== 1;

  return (
    <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_180px_180px] lg:flex-1">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            <span>{t("searchLabel")}</span>
            <Input
              name="quota-search"
              value={query.q}
              onChange={onSearchChange}
              placeholder={t("searchPlaceholder")}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            <span>{t("providerFilterLabel")}</span>
            <select
              value={query.provider}
              onChange={(event) => onProviderChange(event.target.value as QuotaQueryProvider)}
              className="glass-input rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
            >
              {QUOTA_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {t(`providerOption.${provider}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            <span>{t("statusFilterLabel")}</span>
            <select
              value={query.status}
              onChange={(event) => onStatusChange(event.target.value as QuotaQueryStatus)}
              className="glass-input rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
            >
              {QUOTA_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`statusOption.${status}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-shrink-0">
          <div className="text-sm text-[var(--text-muted)]">
            {t("resultsCount", { count: total })}
          </div>
          <Button
            variant="ghost"
            onClick={onClear}
            disabled={!hasFilters}
            className="px-2.5 py-1 text-xs"
          >
            {t("clearFiltersButton")}
          </Button>
        </div>
      </div>
    </section>
  );
}

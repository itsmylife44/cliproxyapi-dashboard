interface QuotaCapacityProps {
  label: string;
  percent: number;
  resetLabel?: string | null;
  resetTitle?: string;
  isResetting?: boolean;
}

export function QuotaCapacityBar({ percent }: { percent: number }) {
  const tone = percent <= 20 ? "bg-rose-500" : percent <= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-[var(--surface-border)]">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
    </span>
  );
}

export function QuotaCapacity({ label, percent, resetLabel, resetTitle, isResetting }: QuotaCapacityProps) {
  return (
    <span className="grid min-w-0 content-start gap-1.5">
      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{percent}%</span>
      </span>
      <QuotaCapacityBar percent={percent} />
      {resetLabel && (
        <span
          title={resetTitle}
          className={`inline-flex min-w-0 items-center gap-1 text-[11px] leading-none tabular-nums ${
            isResetting ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-[var(--text-muted)]"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="size-3 shrink-0 opacity-75"
          >
            <path
              d="M13.5 8a5.5 5.5 0 1 1-1.4-3.67M13.5 2.5v2.75h-2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="truncate" suppressHydrationWarning>{resetLabel}</span>
        </span>
      )}
    </span>
  );
}

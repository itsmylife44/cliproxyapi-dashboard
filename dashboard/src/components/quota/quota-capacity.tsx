interface QuotaCapacityProps {
  label: string;
  percent: number;
}

export function QuotaCapacityBar({ percent }: { percent: number }) {
  const tone = percent <= 20 ? "bg-rose-500" : percent <= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-[var(--surface-border)]">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
    </span>
  );
}

export function QuotaCapacity({ label, percent }: QuotaCapacityProps) {
  return (
    <span className="grid min-w-0 gap-1.5">
      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{percent}%</span>
      </span>
      <QuotaCapacityBar percent={percent} />
    </span>
  );
}

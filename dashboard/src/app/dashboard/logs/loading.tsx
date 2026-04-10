export default function LogsLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-7 w-16 animate-pulse rounded-md bg-[var(--surface-muted)]" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-7 w-20 animate-pulse rounded-md bg-[var(--surface-muted)]" />
            <div className="h-7 w-24 animate-pulse rounded-md bg-[var(--surface-muted)]" />
          </div>
        </div>
      </section>

      {/* Log viewer section */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
        {/* Monospace log lines */}
        <div className="rounded-sm border border-[var(--surface-border)] bg-[#1a1a1a] p-4">
          <div className="space-y-1.5">
            {Array.from({ length: 18 }).map((_, idx) => (
              <div
                key={`log-${idx}`}
                className="h-3 animate-pulse rounded bg-white/10"
                style={{ width: `${55 + (idx * 17 + 7) % 40}%` }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Tip banner */}
      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}

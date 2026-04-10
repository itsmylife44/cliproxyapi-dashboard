export default function MonitoringLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="h-7 w-28 animate-pulse rounded-md bg-[var(--surface-muted)]" />
      </section>

      {/* Service Status */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-6 w-20 animate-pulse rounded-sm bg-[var(--surface-muted)]" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
          <div className="pt-2">
            <div className="h-10 animate-pulse rounded-md bg-[var(--surface-muted)]" />
          </div>
        </div>
      </section>

      {/* Usage Statistics */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="mb-3 h-4 w-36 animate-pulse rounded bg-[var(--surface-muted)]" />
        {/* Stat cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`stat-${idx}`} className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
              <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="mt-1.5 h-4 w-16 animate-pulse rounded bg-[var(--surface-muted)]" />
            </div>
          ))}
        </div>
        {/* 2 chart sections */}
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={`chart-${idx}`} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
              <div className="mb-3 h-4 w-36 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-[200px] animate-pulse rounded-md bg-[var(--surface-muted)]" />
            </div>
          ))}
        </div>
      </section>

      {/* Live Logs */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-7 w-16 animate-pulse rounded-md bg-[var(--surface-muted)]" />
        </div>
        {/* Log lines */}
        <div className="rounded-sm border border-[var(--surface-border)] bg-[#1a1a1a] p-3">
          <div className="space-y-1.5">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div
                key={`logline-${idx}`}
                className="h-3 animate-pulse rounded bg-white/10"
                style={{ width: `${50 + (idx * 13 + 9) % 45}%` }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

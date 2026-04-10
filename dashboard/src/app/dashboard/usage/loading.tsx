export default function UsageLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 animate-pulse rounded-md bg-[var(--surface-muted)]" />
            <div className="flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
            </div>
          </div>
          <div className="h-8 w-20 animate-pulse rounded-md bg-[var(--surface-muted)]" />
        </div>
      </section>

      {/* Time Period filter */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`filter-${idx}`} className="h-8 w-20 animate-pulse rounded-md bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={`date-${idx}`} className="space-y-1">
              <div className="h-2.5 w-8 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-8 w-36 animate-pulse rounded-md bg-[var(--surface-muted)]" />
            </div>
          ))}
          <div className="h-8 w-16 animate-pulse rounded-md bg-[var(--surface-muted)]" />
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`stat-${idx}`} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-2">
            <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="mt-1.5 h-4 w-16 animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>

      {/* Charts 2x2 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`chart-${idx}`} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
            <div className="mb-3 h-4 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-[220px] animate-pulse rounded-md bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>

      {/* Usage by API Key table */}
      <section className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
          {/* Table header */}
          <div className="flex items-center gap-4 border-b border-[var(--surface-border)] bg-[var(--surface-base)]/60 px-3 py-2">
            <div className="h-2.5 w-8 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="ml-auto flex gap-6">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`th-${idx}`} className="h-2.5 w-12 animate-pulse rounded bg-[var(--surface-muted)]" />
              ))}
            </div>
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={`row-${idx}`} className="flex items-center gap-4 border-b border-[var(--surface-border)] px-3 py-2 last:border-b-0">
              <div className="h-3 w-4 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-3 w-36 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="ml-auto flex gap-6">
                {Array.from({ length: 4 }).map((_, jdx) => (
                  <div key={`cell-${idx}-${jdx}`} className="h-3 w-12 animate-pulse rounded bg-[var(--surface-muted)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

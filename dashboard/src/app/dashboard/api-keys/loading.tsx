export default function ApiKeysLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-24 animate-pulse rounded-md bg-[var(--surface-muted)]" />
            <div className="h-3 w-72 animate-pulse rounded-md bg-[var(--surface-muted)]" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-md bg-[var(--surface-muted)]" />
        </div>
      </section>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] border-b border-[var(--surface-border)] bg-[var(--surface-base)]/60 px-3 py-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`th-${idx}`} className="h-2.5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`row-${idx}`}
            className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] items-center border-b border-[var(--surface-border)] px-3 py-2.5 last:border-b-0"
          >
            <div className="space-y-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-2.5 w-48 animate-pulse rounded bg-[var(--surface-muted)]" />
            </div>
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="flex justify-end">
              <div className="h-7 w-16 animate-pulse rounded-md bg-[var(--surface-muted)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

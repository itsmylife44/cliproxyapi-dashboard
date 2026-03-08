export default function AdminLogsLoading() {
  return (
    <div className="space-y-4">
      {/* Header with filter controls */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-56 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Level filter select */}
            <div className="flex items-center gap-2">
              <div className="h-3 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-8 w-28 animate-pulse rounded-sm bg-white/5 backdrop-blur-sm" />
            </div>
            {/* Auto-refresh checkbox */}
            <div className="flex items-center gap-2">
              <div className="size-4 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-28 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-7 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`stat-${idx}`} className="flex items-center gap-1.5">
            <div className="size-2 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
        ))}
      </div>

      {/* Log entries table */}
      <section className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/40">
        {/* Table title bar */}
        <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <div className="h-2.5 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-3 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>
        {/* Table header row */}
        <div className="flex items-center gap-4 border-b border-slate-700/70 bg-slate-900/95 px-3 py-2">
          <div className="h-2.5 w-28 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-2.5 flex-1 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, idx) => (
          <div key={`row-${idx}`} className="flex items-start gap-4 border-b border-slate-700/60 px-3 py-2.5 last:border-b-0">
            {/* Time column */}
            <div className="w-28 space-y-1 shrink-0">
              <div className="h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-2.5 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            </div>
            {/* Level badge */}
            <div className="h-5 w-14 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
            {/* Message */}
            <div className="h-3 flex-1 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            {/* Details */}
            <div className="h-3 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
        ))}
      </section>
    </div>
  );
}

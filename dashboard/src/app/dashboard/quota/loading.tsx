export default function QuotaLoading() {
  return (
    <div className="space-y-4">
      {/* Header with provider filter tabs + refresh */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-20 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={`tab-${idx}`} className="h-7 w-20 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
              ))}
            </div>
            <div className="h-7 w-20 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
      </section>

      {/* 4 stat cards */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`stat-${idx}`} className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
            <div className="h-2.5 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="mt-1.5 h-4 w-12 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
        ))}
      </section>

      {/* Charts: RadialBar gauge + Bar chart side by side */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Gauge */}
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
          <div className="mb-1 h-4 w-36 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="mb-3 h-3 w-52 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="flex h-48 items-center justify-center">
            <div className="size-36 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
        {/* Bar chart */}
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
          <div className="mb-1 h-4 w-36 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="mb-3 h-3 w-56 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-48 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
      </section>

      {/* Provider Capacity summary table */}
      <section className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/40">
          <div className="flex items-center gap-3 border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={`ph-${idx}`} className="h-2.5 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`prow-${idx}`} className="flex items-center gap-3 border-b border-slate-700/60 px-3 py-2.5 last:border-b-0">
              <div className="h-3 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="space-y-1">
                <div className="h-2.5 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-1.5 w-32 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
              </div>
              <div className="space-y-1">
                <div className="h-2.5 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-1.5 w-32 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-6 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            </div>
          ))}
        </div>
      </section>

      {/* Accounts list */}
      <section className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/40">
          <div className="flex items-center gap-3 border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`ah-${idx}`} className="h-2.5 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={`arow-${idx}`} className="flex items-center gap-3 border-b border-slate-700/60 px-3 py-2.5 last:border-b-0">
              <div className="h-3 w-3 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-36 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="space-y-1">
                <div className="h-2.5 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-1.5 w-28 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
              </div>
              <div className="space-y-1">
                <div className="h-2.5 w-10 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-1.5 w-28 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

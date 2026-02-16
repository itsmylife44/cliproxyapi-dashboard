export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-4 w-96 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_minmax(280px,1fr)]">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`status-${idx}`} className="glass-card rounded-md border border-slate-700/70 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="size-3 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
              </div>
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
          <div className="mb-4 space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-4 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={`checklist-${idx}`} className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <div className="size-3 animate-pulse rounded-full bg-white/5 backdrop-blur-sm" />
                  <div className="h-4 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-4 w-64 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="h-8 w-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          <div className="h-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="space-y-1">
            <div className="h-4 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="size-4 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="size-4 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>
      </section>
    </div>
  );
}

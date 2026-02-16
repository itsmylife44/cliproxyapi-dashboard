export default function ProvidersLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="h-7 w-64 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        <div className="mt-1 h-4 w-96 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`stat-${idx}`} className="rounded-md border border-slate-700/70 bg-slate-900/25 px-2.5 py-2">
            <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="mt-2 h-4 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>

        <div className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/20">
          <div className="grid grid-cols-[minmax(0,1.6fr)_96px_120px_128px] items-center border-b border-slate-700/70 bg-slate-900/60 px-4 py-2">
            <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-12 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-12 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`provider-${idx}`} className="border-b border-slate-700/70 last:border-b-0">
              <div className="grid grid-cols-[minmax(0,1.6fr)_96px_120px_128px] items-center gap-3 px-4 py-3">
                <div className="space-y-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                  <div className="h-3 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                </div>
                <div className="h-3 w-12 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="flex justify-end">
                  <div className="h-7 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="h-4 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-8">
            <div className="flex items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="h-8 w-40 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>

        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
          <div className="h-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
      </section>
    </div>
  );
}

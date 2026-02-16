export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-3">
        <div className="h-7 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        <div className="mt-1 h-4 w-96 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
      </section>

      <section className="space-y-3">
        <div className="h-3 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`pwd-${idx}`} className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                  <div className="h-10 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
                </div>
              ))}
            </div>
            <div className="h-10 w-40 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-64 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-10 w-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
            <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4">
              <div className="h-4 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-5 w-32 animate-pulse rounded-sm bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={`ver-${idx}`} className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4">
                  <div className="h-3 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                  <div className="mt-1 h-6 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                  <div className="mt-1 h-3 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-10 w-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
              <div className="h-10 w-20 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
          </div>

          <div className="border-t border-slate-700/70 pt-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-5 w-32 animate-pulse rounded-sm bg-white/5 backdrop-blur-sm" />
            </div>
          </div>

          <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4">
            <div className="mb-3 h-4 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="grid gap-3 text-sm md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`sys-${idx}`} className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                  <div className="mt-1 h-4 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

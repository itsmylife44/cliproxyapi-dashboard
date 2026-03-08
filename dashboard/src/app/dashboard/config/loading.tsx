export default function ConfigLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div className="space-y-2">
            <div className="h-7 w-36 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-4 w-80 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-28 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-8 w-28 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
      </section>

      {/* Warning banner */}
      <div className="h-10 animate-pulse rounded-sm border border-slate-700/70 bg-white/5 backdrop-blur-sm" />

      {/* General Settings section */}
      <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="mb-3 h-3 w-36 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={`general-${idx}`} className="space-y-2">
              <div className="h-3.5 w-36 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-56 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-10 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
          ))}
        </div>
      </section>

      {/* Streaming section */}
      <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`stream-${idx}`} className="space-y-2">
              <div className="h-3.5 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-10 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
          ))}
        </div>
      </section>

      {/* Retry & Resilience section */}
      <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="mb-3 h-3 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={`retry-${idx}`} className="space-y-2">
              <div className="h-3.5 w-44 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-52 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-10 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
          ))}
        </div>
      </section>

      {/* Logging section */}
      <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="mb-3 h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`log-${idx}`} className="space-y-2">
              <div className="h-3.5 w-36 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-44 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-10 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
          ))}
        </div>
      </section>

      {/* Advanced raw JSON section */}
      <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="h-3 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-7 w-28 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
      </section>

      {/* Tip banner */}
      <div className="rounded-sm border border-slate-700/70 bg-slate-900/25 p-4">
        <div className="h-3 w-4/5 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
      </div>
    </div>
  );
}

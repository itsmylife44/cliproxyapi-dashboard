export default function AdminUsersLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-56 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/40">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`th-${idx}`} className="h-2.5 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={`row-${idx}`} className="flex items-center gap-4 border-b border-slate-700/60 px-3 py-2.5 last:border-b-0">
            <div className="h-3 w-28 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-5 w-14 animate-pulse rounded-sm bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-6 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          </div>
        ))}
      </section>
    </div>
  );
}

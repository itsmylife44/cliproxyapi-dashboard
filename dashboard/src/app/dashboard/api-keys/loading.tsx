export default function ApiKeysLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-72 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
        </div>
      </section>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/40">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`th-${idx}`} className="h-2.5 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`row-${idx}`}
            className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] items-center border-b border-slate-700/60 px-3 py-2.5 last:border-b-0"
          >
            <div className="space-y-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-2.5 w-48 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            </div>
            <div className="h-3 w-24 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
            <div className="flex justify-end">
              <div className="h-7 w-16 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

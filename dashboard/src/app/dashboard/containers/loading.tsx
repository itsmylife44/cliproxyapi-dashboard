export default function ContainersLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="h-7 w-32 animate-pulse rounded-md bg-white/5 backdrop-blur-sm" />
      </section>

      <div className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
        <div className="grid grid-cols-[minmax(0,1.2fr)_100px_120px_120px_220px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <div className="h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-3 w-12 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-3 w-14 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
        </div>
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={`container-${idx}`} className="border-b border-slate-700/60 px-3 py-3 last:border-b-0">
            <div className="grid grid-cols-[minmax(0,1.2fr)_100px_120px_120px_220px] items-start gap-3">
              <div className="space-y-1">
                <div className="h-4 w-40 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-3 w-56 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-20 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              <div className="flex flex-wrap justify-end gap-1.5">
                <div className="h-7 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
                <div className="h-7 w-16 animate-pulse rounded bg-white/5 backdrop-blur-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

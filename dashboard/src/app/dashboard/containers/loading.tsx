export default function ContainersLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#e5e5e5] bg-white p-4">
        <div className="h-7 w-32 animate-pulse rounded-md bg-[#f5f5f5]" />
      </section>

      <div className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
        <div className="grid grid-cols-[minmax(0,1.2fr)_100px_120px_120px_220px] border-b border-[#e5e5e5] bg-white/60 px-3 py-2">
          <div className="h-3 w-20 animate-pulse rounded bg-[#f5f5f5]" />
          <div className="h-3 w-12 animate-pulse rounded bg-[#f5f5f5]" />
          <div className="h-3 w-14 animate-pulse rounded bg-[#f5f5f5]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[#f5f5f5]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[#f5f5f5]" />
        </div>
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={`container-${idx}`} className="border-b border-[#e5e5e5] px-3 py-3 last:border-b-0">
            <div className="grid grid-cols-[minmax(0,1.2fr)_100px_120px_120px_220px] items-start gap-3">
              <div className="space-y-1">
                <div className="h-4 w-40 animate-pulse rounded bg-[#f5f5f5]" />
                <div className="h-3 w-56 animate-pulse rounded bg-[#f5f5f5]" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded bg-[#f5f5f5]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[#f5f5f5]" />
              <div className="h-3 w-16 animate-pulse rounded bg-[#f5f5f5]" />
              <div className="flex flex-wrap justify-end gap-1.5">
                <div className="h-7 w-16 animate-pulse rounded bg-[#f5f5f5]" />
                <div className="h-7 w-16 animate-pulse rounded bg-[#f5f5f5]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

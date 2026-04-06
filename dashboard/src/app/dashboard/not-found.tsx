import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-[#e5e5e5] bg-white p-8">
        <div className="flex flex-col items-center space-y-4 text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="text-[#777169]"
          >
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1.5" />
            <line x1="24" y1="4" x2="24" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="24" y1="34" x2="24" y2="44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="4" y1="24" x2="14" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="34" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#777169]">404</p>
            <h1 className="text-xl font-semibold tracking-tight text-black">Page not found</h1>
            <p className="text-sm text-[#777169]">
              This section does not exist or you may not have access to it.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="glass-button-primary inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080b11] text-[#e5e7eb] antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-slate-700/70 bg-slate-900/40 p-8">
            <div className="flex flex-col items-center space-y-4 text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden="true"
                className="text-rose-400/70"
              >
                <path
                  d="M24 6L44 40H4L24 6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <line x1="24" y1="20" x2="24" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="24" cy="35" r="1" fill="currentColor" />
              </svg>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Fatal Error</p>
                <h1 className="text-xl font-semibold tracking-tight text-slate-100">Something went wrong</h1>
                <p className="text-sm text-slate-400">
                  A critical error occurred. Please try again or return to the dashboard.
                </p>
                {error.digest && (
                  <p className="mt-2 font-mono text-[11px] text-slate-600">
                    ID: {error.digest}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)] bg-blue-600 border-blue-700 hover:bg-blue-700"
              >
                Try Again
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 text-slate-100 bg-slate-800/70 border-slate-600/80 hover:bg-slate-700/80"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

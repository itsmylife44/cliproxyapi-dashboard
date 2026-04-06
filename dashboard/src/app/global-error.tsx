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
      <body className="min-h-screen bg-[#f5f5f5] text-black antialiased">
        <main id="main-content" className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-[#e5e5e5] bg-white p-8">
            <div className="flex flex-col items-center space-y-4 text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden="true"
                className="text-rose-500"
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
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#777169]">Fatal Error</p>
                <h1 className="text-xl font-semibold tracking-tight text-black">Something went wrong</h1>
                <p className="text-sm text-[#777169]">
                  A critical error occurred. Please try again or return to the dashboard.
                </p>
                {error.digest && (
                  <p className="mt-2 font-mono text-[11px] text-[#777169]">
                    ID: {error.digest}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 text-white bg-black border-black hover:bg-gray-900"
              >
                Try Again
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 text-black bg-[#f5f5f5]/70 border-[#e5e5e5]/80 hover:bg-[#e5e5e5]/80"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

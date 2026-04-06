"use client";

import Link from "next/link";

export function SuccessBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 shadow-[0_0_32px_rgba(16,185,129,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-400/40">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-emerald-700">
            All steps complete
          </p>
          <p className="mt-0.5 text-sm text-[#777169]">
            Your CLIProxyAPI instance is fully configured and ready to use.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-md border bg-black text-white border-black hover:bg-gray-900"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

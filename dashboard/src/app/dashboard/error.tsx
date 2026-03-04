"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
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
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Error</p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Something went wrong</h1>
            <p className="text-sm text-slate-400">
              An unexpected error occurred while loading this page.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-[11px] text-slate-600">
                ID: {error.digest}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="primary" onClick={reset}>
            Try Again
          </Button>
          <Link href="/dashboard" className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 glass-button-secondary text-slate-100">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

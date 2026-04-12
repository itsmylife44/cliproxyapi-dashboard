"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { getThemeBootstrapScript } from "@/lib/theme-script";
import { PublicThemeToggle } from "@/components/public-theme-toggle";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script>{getThemeBootstrapScript()}</script>
      </head>
      <body className="min-h-screen antialiased">
        <PublicThemeToggle />
        <main id="main-content" className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-8">
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
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{t("fatalError")}</p>
                <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t("somethingWentWrong")}</h1>
                <p className="text-sm text-[var(--text-muted)]">
                  {t("criticalError")}
                </p>
                {error.digest && (
                  <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">
                    ID: {error.digest}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 glass-button-primary"
              >
                {t("tryAgain")}
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 text-[var(--text-primary)] bg-[var(--surface-muted)] border-[var(--surface-border)] hover:bg-[var(--surface-hover)]"
              >
                {t("goToDashboard")}
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

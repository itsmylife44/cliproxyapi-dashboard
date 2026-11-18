"use client";

import { useMobileSidebar } from "@/components/mobile-sidebar-context";
import { useTranslations } from "next-intl";

export function MobileTopBar() {
  const { isOpen, toggle } = useMobileSidebar();
  const t = useTranslations('mobile');

  return (
    <div className="fixed inset-x-0 top-0 z-30 overflow-hidden border-b border-[var(--surface-border)] glass-nav lg:hidden">
      <div className="flex items-center justify-start gap-2.5 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          className="rounded-md p-1.5 text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--surface-hover)]"
          aria-label={t('toggleMenuAriaLabel')}
          aria-expanded={isOpen}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt={t('logoAlt')}
            width={20}
            height={22}
            className="shrink-0 rounded-sm"
          />
          <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {t('appName')}
          </span>
        </div>
      </div>
    </div>
  );
}

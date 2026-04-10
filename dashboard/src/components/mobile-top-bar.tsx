"use client";

import { useMobileSidebar } from "@/components/mobile-sidebar-context";

export function MobileTopBar() {
  const { isOpen, toggle } = useMobileSidebar();

  return (
    <div className="fixed left-0 right-0 top-0 z-30 border-b border-[var(--surface-border)] glass-nav lg:hidden">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          type="button"
          onClick={toggle}
          className="rounded-md p-2 text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--surface-hover)]"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          <svg
            className="w-6 h-6"
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
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="CLIProxy Logo"
            width={22}
            height={24}
            className="rounded-sm"
          />
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            CLIProxy
          </h1>
        </div>
      </div>
    </div>
  );
}

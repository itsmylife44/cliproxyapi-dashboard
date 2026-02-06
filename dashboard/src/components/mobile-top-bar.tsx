"use client";

import { useMobileSidebar } from "@/components/mobile-sidebar-context";

export function MobileTopBar() {
  const { toggle } = useMobileSidebar();

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-30 glass-nav border-b border-white/10">
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={toggle}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors duration-200"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Menu</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-white">
          CLIProxy
        </h1>
      </div>
    </div>
  );
}

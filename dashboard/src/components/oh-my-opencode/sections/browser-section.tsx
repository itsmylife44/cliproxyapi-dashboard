"use client";

import type { OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { BROWSER_PROVIDERS } from "@/lib/config-generators/oh-my-opencode-types";

interface BrowserSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  overrides: OhMyOpenCodeFullConfig;
  onBrowserProviderChange: (provider: string) => void;
}

export function BrowserSection({
  isExpanded,
  onToggleExpand,
  overrides,
  onBrowserProviderChange,
}: BrowserSectionProps) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-muted)] overflow-hidden transition-colors hover:border-[var(--surface-border)]">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="flex-1 text-left">Browser Automation</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          <span className="text-xs text-[var(--text-muted)]">Provider</span>
          <select
            value={overrides.browser_automation_engine?.provider ?? "playwright"}
            onChange={(e) => onBrowserProviderChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/20"
          >
            {BROWSER_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

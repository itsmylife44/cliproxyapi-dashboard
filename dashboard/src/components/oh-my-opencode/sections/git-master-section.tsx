"use client";

import { useTranslations } from "next-intl";
import type { GitMasterConfig, OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";

interface GitMasterSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  overrides: OhMyOpenCodeFullConfig;
  onGitMasterToggle: (field: keyof GitMasterConfig) => void;
}

const GIT_MASTER_FIELDS: ReadonlyArray<{
  field: keyof GitMasterConfig;
  labelKey: string;
  defaultValue: boolean;
}> = [
  { field: "commit_footer", labelKey: "commitFooter", defaultValue: false },
  { field: "include_co_authored_by", labelKey: "includeCoAuthoredBy", defaultValue: false },
];

export function GitMasterSection({
  isExpanded,
  onToggleExpand,
  overrides,
  onGitMasterToggle,
}: GitMasterSectionProps) {
  const t = useTranslations("ohMyOpenCode");

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
        <span className="flex-1 text-left">{t("gitMaster")}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {GIT_MASTER_FIELDS.map(({ field, labelKey, defaultValue }) => {
            const isEnabled = overrides.git_master?.[field] ?? defaultValue;
            return (
              <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--surface-muted)]">
                <span className="text-xs text-[var(--text-secondary)] font-mono">{t(labelKey as never)}</span>
                <button
                  type="button"
                  onClick={() => onGitMasterToggle(field)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    isEnabled ? "bg-emerald-500/100" : "bg-[var(--surface-hover)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                      isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

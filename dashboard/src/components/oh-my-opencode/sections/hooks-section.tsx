"use client";

import { useTranslations } from "next-intl";
import type { HookGroupName } from "@/lib/config-generators/oh-my-opencode-types";
import { HOOK_GROUPS } from "@/lib/config-generators/oh-my-opencode-types";

interface HooksSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  disabledHooks: readonly string[];
  expandedHookGroups: Set<HookGroupName>;
  onHookToggle: (hook: string) => void;
  onHookGroupToggle: (group: HookGroupName) => void;
}

export function HooksSection({
  isExpanded,
  onToggleExpand,
  disabledHooks,
  expandedHookGroups,
  onHookToggle,
  onHookGroupToggle,
}: HooksSectionProps) {
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
        <span className="flex-1 text-left">{t("hooks")}</span>
        <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)] text-[10px] font-mono">
          {t("disabledCount", { count: disabledHooks.length })}
        </span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {(Object.entries(HOOK_GROUPS) as [HookGroupName, readonly string[]][]).map(([groupName, hooks]) => {
            const disabledCount = hooks.filter((h) => disabledHooks.includes(h)).length;
            const isGroupExpanded = expandedHookGroups.has(groupName);
            return (
              <div key={groupName}>
                <button
                  type="button"
                  onClick={() => onHookGroupToggle(groupName)}
                  className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
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
                    className={`transition-transform duration-200 ${isGroupExpanded ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {groupName} {t("hookGroupStats", { disabled: disabledCount, total: hooks.length })}
                </button>
                {isGroupExpanded && (
                  <div className="space-y-1 pl-4 mt-1">
                    {hooks.map((hook) => {
                      const isEnabled = !disabledHooks.includes(hook);
                      return (
                        <div key={hook} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--surface-muted)]">
                          <span className="text-xs text-[var(--text-secondary)] font-mono">{hook}</span>
                          <button
                            type="button"
                            onClick={() => onHookToggle(hook)}
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
          })}
        </div>
      )}
    </div>
  );
}

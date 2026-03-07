"use client";

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
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
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
        <span className="flex-1 text-left">Hooks</span>
        <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
          {disabledHooks.length} disabled
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
                  className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
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
                  {groupName} ({disabledCount}/{hooks.length} disabled)
                </button>
                {isGroupExpanded && (
                  <div className="space-y-1 pl-4 mt-1">
                    {hooks.map((hook) => {
                      const isEnabled = !disabledHooks.includes(hook);
                      return (
                        <div key={hook} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                          <span className="text-xs text-white/70 font-mono">{hook}</span>
                          <button
                            type="button"
                            onClick={() => onHookToggle(hook)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                              isEnabled ? "bg-emerald-500/60" : "bg-white/10"
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

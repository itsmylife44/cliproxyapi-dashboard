"use client";

import type { OhMyOpenCodeFullConfig, SisyphusAgentConfig } from "@/lib/config-generators/oh-my-opencode-types";

interface SisyphusSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  overrides: OhMyOpenCodeFullConfig;
  onSisyphusToggle: (field: keyof SisyphusAgentConfig) => void;
}

const SISYPHUS_FIELDS: ReadonlyArray<{
  field: keyof SisyphusAgentConfig;
  label: string;
  defaultValue: boolean;
}> = [
  { field: "disabled", label: "Disabled", defaultValue: false },
  { field: "default_builder_enabled", label: "Default Builder Enabled", defaultValue: false },
  { field: "planner_enabled", label: "Planner Enabled", defaultValue: true },
  { field: "replace_plan", label: "Replace Plan", defaultValue: true },
];

export function SisyphusSection({
  isExpanded,
  onToggleExpand,
  overrides,
  onSisyphusToggle,
}: SisyphusSectionProps) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] overflow-hidden transition-colors hover:border-[#e5e5e5]">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[#777169] hover:text-black hover:bg-[#f5f5f5] transition-colors"
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
        <span className="flex-1 text-left">Sisyphus Agent</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {SISYPHUS_FIELDS.map(({ field, label, defaultValue }) => {
            const isEnabled = overrides.sisyphus_agent?.[field] ?? defaultValue;
            return (
              <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#f5f5f5]">
                <span className="text-xs text-[#4e4e4e] font-mono">{label}</span>
                <button
                  type="button"
                  onClick={() => onSisyphusToggle(field)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    isEnabled ? "bg-emerald-500" : "bg-[#f0f0f0]"
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

"use client";

import type { OhMyOpenCodeFullConfig, TmuxConfig } from "@/lib/config-generators/oh-my-opencode-types";
import { TMUX_LAYOUTS } from "@/lib/config-generators/oh-my-opencode-types";

interface TmuxSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  overrides: OhMyOpenCodeFullConfig;
  onTmuxEnabledToggle: () => void;
  onTmuxLayoutChange: (layout: string) => void;
  onTmuxNumberChange: (field: keyof TmuxConfig, value: number) => void;
}

export function TmuxSection({
  isExpanded,
  onToggleExpand,
  overrides,
  onTmuxEnabledToggle,
  onTmuxLayoutChange,
  onTmuxNumberChange,
}: TmuxSectionProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-colors hover:border-white/15">
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
        <span className="flex-1 text-left">Tmux</span>
        {overrides.tmux?.enabled && (
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 text-[10px] font-mono">
            enabled
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
            <span className="text-xs text-white/70 font-mono">Enabled</span>
            <button
              type="button"
              onClick={onTmuxEnabledToggle}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                overrides.tmux?.enabled ? "bg-emerald-500/60" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                  overrides.tmux?.enabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                }`}
              />
            </button>
          </div>
          {overrides.tmux?.enabled && (
            <>
              <div className="space-y-1">
                <span className="text-xs text-white/50">Layout</span>
                <select
                  value={overrides.tmux.layout ?? "main-vertical"}
                  onChange={(e) => onTmuxLayoutChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                >
                  {TMUX_LAYOUTS.map((layout) => (
                    <option key={layout} value={layout}>
                      {layout}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-white/50">Main Pane Size (20-80)</span>
                <input
                  type="number"
                  min={20}
                  max={80}
                  value={overrides.tmux.main_pane_size ?? 60}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed)) {
                      onTmuxNumberChange("main_pane_size", parsed);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-white/50">Main Pane Min Width</span>
                <input
                  type="number"
                  min={0}
                  value={overrides.tmux.main_pane_min_width ?? 120}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed) && parsed >= 0) {
                      onTmuxNumberChange("main_pane_min_width", parsed);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-white/50">Agent Pane Min Width</span>
                <input
                  type="number"
                  min={0}
                  value={overrides.tmux.agent_pane_min_width ?? 40}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed) && parsed >= 0) {
                      onTmuxNumberChange("agent_pane_min_width", parsed);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

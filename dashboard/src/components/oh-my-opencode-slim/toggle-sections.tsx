"use client";

import { useState } from "react";
import type {
  OhMyOpenCodeSlimFullConfig,
  SlimTmuxConfig,
  SlimBackgroundConfig,
  SlimFallbackConfig,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import { SLIM_TMUX_LAYOUTS, SLIM_SCORING_VERSIONS } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { HelpTooltip } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function Section({
  label,
  isExpanded,
  onToggle,
  tooltip,
  children,
}: {
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">{label} {tooltip && <HelpTooltip content={tooltip} />}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-white/40 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {isExpanded && <div className="border-t border-white/5 px-3 py-3 space-y-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlimToggleSectionsProps {
  overrides: OhMyOpenCodeSlimFullConfig;
  onTmuxChange: (tmux: SlimTmuxConfig | undefined) => void;
  onBackgroundChange: (bg: SlimBackgroundConfig | undefined) => void;
  onFallbackChange: (fb: SlimFallbackConfig | undefined) => void;
  onDisabledMcpAdd: (mcp: string) => boolean;
  onDisabledMcpRemove: (mcp: string) => void;
  onScalarChange: (field: string, value: unknown) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlimToggleSections({
  overrides,
  onTmuxChange,
  onBackgroundChange,
  onFallbackChange,
  onDisabledMcpAdd,
  onDisabledMcpRemove,
  onScalarChange,
}: SlimToggleSectionsProps) {
  const [showTmux, setShowTmux] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showMcps, setShowMcps] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [mcpInput, setMcpInput] = useState("");

  const tmux = overrides.tmux ?? {};
  const bg = overrides.background ?? {};
  const fb = overrides.fallback ?? {};

  return (
    <div className="border-t border-white/5 pt-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 space-y-3">
          {/* Tmux */}
          <Section label="Tmux" isExpanded={showTmux} onToggle={() => setShowTmux(!showTmux)} tooltip="Split your terminal into panes to monitor agent activity in real-time">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={tmux.enabled ?? false}
                onChange={() => {
                  const newEnabled = !tmux.enabled;
                  onTmuxChange(newEnabled ? { enabled: true, layout: tmux.layout ?? "main-vertical", main_pane_size: tmux.main_pane_size ?? 60 } : undefined);
                }}
                className="accent-violet-500"
              />
              Enable tmux integration
            </label>
            {tmux.enabled && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-16">Layout</span>
                  <select
                    value={tmux.layout ?? "main-vertical"}
                    onChange={(e) => onTmuxChange({ ...tmux, layout: e.target.value as SlimTmuxConfig["layout"] })}
                    className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
                  >
                    {SLIM_TMUX_LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-16">Pane %</span>
                  <input
                    type="number" min={20} max={80}
                    value={tmux.main_pane_size ?? 60}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); onTmuxChange({ ...tmux, main_pane_size: isNaN(v) ? 60 : v }); }}
                    className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
                  />
                </div>
              </>
            )}
          </Section>

          {/* Background */}
          <Section label="Background" isExpanded={showBackground} onToggle={() => setShowBackground(!showBackground)} tooltip="Limit how many agent tasks can run simultaneously">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Max concurrent</span>
              <input
                type="number" min={1} max={50}
                value={bg.maxConcurrentStarts ?? 10}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onBackgroundChange(val > 0 ? { maxConcurrentStarts: Math.min(50, val) } : undefined);
                }}
                className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
              />
            </div>
          </Section>

          {/* Scoring Engine */}
          <Section label="Scoring & Balance" isExpanded={showScoring} onToggle={() => setShowScoring(!showScoring)} tooltip="Scoring engine ranks models for auto-assignment. Balance distributes requests across providers to avoid rate limits.">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 w-28">Scoring engine</span>
              <select
                value={overrides.scoringEngineVersion ?? "v1"}
                onChange={(e) => onScalarChange("scoringEngineVersion", e.target.value)}
                className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
              >
                {SLIM_SCORING_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={overrides.balanceProviderUsage ?? false}
                onChange={() => onScalarChange("balanceProviderUsage", !overrides.balanceProviderUsage)}
                className="accent-violet-500"
              />
              Balance provider usage
            </label>
          </Section>
        </div>

        <div className="flex-1 space-y-3">
          {/* Fallback */}
          <Section label="Fallback" isExpanded={showFallback} onToggle={() => setShowFallback(!showFallback)} tooltip="When a model times out, automatically retry with the next model in the fallback chain">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={fb.enabled ?? true}
                onChange={() => onFallbackChange({ ...fb, enabled: !(fb.enabled ?? true) })}
                className="accent-violet-500"
              />
              Enable fallback
            </label>
            {(fb.enabled ?? true) && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-24">Timeout (ms)</span>
                  <input
                    type="number" min={0}
                    value={fb.timeoutMs ?? 15000}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); onFallbackChange({ ...fb, timeoutMs: isNaN(v) ? 15000 : v }); }}
                    className="w-24 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-24">Retry delay</span>
                  <input
                    type="number" min={0}
                    value={fb.retryDelayMs ?? 500}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); onFallbackChange({ ...fb, retryDelayMs: isNaN(v) ? 500 : v }); }}
                    className="w-24 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80"
                  />
                </div>
              </>
            )}
          </Section>

          {/* Disabled MCPs */}
          <Section label="Disabled MCPs" isExpanded={showMcps} onToggle={() => setShowMcps(!showMcps)} tooltip="MCP servers you want to exclude from agent use. Agents won't be able to call these tools.">
            {(overrides.disabled_mcps ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(overrides.disabled_mcps ?? []).map((mcp) => (
                  <span key={mcp} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                    {mcp}
                    <button type="button" onClick={() => onDisabledMcpRemove(mcp)} className="text-white/40 hover:text-white/80" aria-label={`Remove ${mcp}`}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={mcpInput}
                onChange={(e) => setMcpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (onDisabledMcpAdd(mcpInput)) setMcpInput("");
                  }
                }}
                placeholder="MCP name to disable"
                className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80 placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => { if (onDisabledMcpAdd(mcpInput)) setMcpInput(""); }}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60 hover:text-white/90"
              >
                Add
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

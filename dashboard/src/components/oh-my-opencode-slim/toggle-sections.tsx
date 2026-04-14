"use client";

import { useState } from "react";
import type {
  OhMyOpenCodeSlimFullConfig,
  SlimTmuxConfig,
  SlimBackgroundConfig,
  SlimFallbackConfig,
  SlimCouncilConfig,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import { SLIM_TMUX_LAYOUTS, SLIM_SCORING_VERSIONS, SLIM_COUNCILLOR_EXECUTION_MODES } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { HelpTooltip } from "@/components/ui/tooltip";
import { useTranslations } from 'next-intl';

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
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label} {tooltip && <HelpTooltip content={tooltip} />}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
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
  onCouncilChange: (council: SlimCouncilConfig | undefined) => void;
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
  onCouncilChange,
  onDisabledMcpAdd,
  onDisabledMcpRemove,
  onScalarChange,
}: SlimToggleSectionsProps) {
  const t = useTranslations('ohMyOpenCode');
  const [showTmux, setShowTmux] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showMcps, setShowMcps] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);
  const [mcpInput, setMcpInput] = useState("");

  const tmux = overrides.tmux ?? {};
  const bg = overrides.background ?? {};
  const fb = overrides.fallback ?? {};
  const council = overrides.council ?? {};

  return (
    <div className="border-t border-white/5 pt-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 space-y-3">
          {/* Tmux */}
          <Section label={t("tmuxSectionLabel")} isExpanded={showTmux} onToggle={() => setShowTmux(!showTmux)} tooltip={t("tmuxSectionTooltip")}>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={tmux.enabled ?? false}
                onChange={() => {
                  const newEnabled = !tmux.enabled;
                  onTmuxChange(newEnabled ? { enabled: true, layout: tmux.layout ?? "main-vertical", main_pane_size: tmux.main_pane_size ?? 60 } : undefined);
                }}
                className="accent-black"
              />
              {t("enableTmux")}
            </label>
            {tmux.enabled && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] w-16">{t("layoutLabel")}</span>
                  <select
                    value={tmux.layout ?? "main-vertical"}
                    onChange={(e) => onTmuxChange({ ...tmux, layout: e.target.value as SlimTmuxConfig["layout"] })}
                    className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                  >
                    {SLIM_TMUX_LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] w-16">{t("paneSizeLabel")}</span>
                  <input
                    type="number" min={20} max={80}
                    value={tmux.main_pane_size ?? 60}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); onTmuxChange({ ...tmux, main_pane_size: isNaN(v) ? 60 : v }); }}
                    className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                  />
                </div>
              </>
            )}
          </Section>

          {/* Background */}
          <Section label={t("backgroundSectionLabel")} isExpanded={showBackground} onToggle={() => setShowBackground(!showBackground)} tooltip={t("backgroundSectionTooltip")}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{t("maxConcurrentLabel")}</span>
              <input
                type="number" min={1} max={50}
                value={bg.maxConcurrentStarts ?? 10}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onBackgroundChange(val > 0 ? { maxConcurrentStarts: Math.min(50, val) } : undefined);
                }}
                className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              />
            </div>
          </Section>

          {/* Scoring Engine */}
          <Section label={t("scoringSectionLabel")} isExpanded={showScoring} onToggle={() => setShowScoring(!showScoring)} tooltip={t("scoringSectionTooltip")}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-28">{t("scoringEngineLabel")}</span>
              <select
                value={overrides.scoringEngineVersion ?? "v1"}
                onChange={(e) => onScalarChange("scoringEngineVersion", e.target.value)}
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                {SLIM_SCORING_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={overrides.balanceProviderUsage ?? false}
                onChange={() => onScalarChange("balanceProviderUsage", !overrides.balanceProviderUsage)}
                className="accent-black"
              />
              {t("balanceProviderLabel")}
            </label>
          </Section>
        </div>

        <div className="flex-1 space-y-3">
          {/* Fallback */}
          <Section label={t("fallbackSectionLabel")} isExpanded={showFallback} onToggle={() => setShowFallback(!showFallback)} tooltip={t("fallbackSectionTooltip")}>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={fb.enabled ?? true}
                onChange={() => onFallbackChange({ ...fb, enabled: !(fb.enabled ?? true) })}
                className="accent-black"
              />
              {t("enableFallback")}
            </label>
            {(fb.enabled ?? true) && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] w-24">{t("timeoutLabel")}</span>
                  <input
                    type="number" min={0}
                    value={fb.timeoutMs ?? 15000}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); onFallbackChange({ ...fb, timeoutMs: isNaN(v) ? 15000 : v }); }}
                    className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] w-24">{t("retryDelayLabel")}</span>
                  <input
                    type="number" min={0}
                    value={fb.retryDelayMs ?? 500}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); onFallbackChange({ ...fb, retryDelayMs: isNaN(v) ? 500 : v }); }}
                    className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                  />
                </div>
              </>
            )}
          </Section>

          {/* Disabled MCPs */}
          <Section label={t("disabledMcpsSectionLabel")} isExpanded={showMcps} onToggle={() => setShowMcps(!showMcps)} tooltip={t("disabledMcpsSectionTooltip")}>
            {(overrides.disabled_mcps ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(overrides.disabled_mcps ?? []).map((mcp) => (
                  <span key={mcp} className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                    {mcp}
                    <button type="button" onClick={() => onDisabledMcpRemove(mcp)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" aria-label={`Remove ${mcp}`}>&times;</button>
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
                placeholder={t("mcpNamePlaceholder")}
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              />
              <button
                type="button"
                onClick={() => { if (onDisabledMcpAdd(mcpInput)) setMcpInput(""); }}
                className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {t("mcpAddButton")}
              </button>
            </div>
          </Section>

          {/* Council */}
          <Section label={t("councilSectionLabel")} isExpanded={showCouncil} onToggle={() => setShowCouncil(!showCouncil)} tooltip={t("councilSectionTooltip")}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-20">{t("councilMasterModelLabel")}</span>
              <input
                type="text"
                value={council.master?.model ?? ""}
                onChange={(e) => {
                  const model = e.target.value;
                  const newCouncil = { ...council, master: { ...council.master, model } };
                  const isEmpty = !model && !newCouncil.master?.variant && 
                    !newCouncil.councillor_execution_mode && 
                    !newCouncil.master_timeout && 
                    !newCouncil.councillors_timeout &&
                    !newCouncil.councillor_retries;
                  onCouncilChange(isEmpty ? undefined : newCouncil);
                }}
                placeholder="gpt-4o"
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-20">{t("councilMasterVariantLabel")}</span>
              <input
                type="text"
                value={council.master?.variant ?? ""}
                onChange={(e) => {
                  const variant = e.target.value;
                  const newCouncil = { ...council };
                  if (newCouncil.master?.model) {
                    newCouncil.master = { ...newCouncil.master, variant: variant || undefined };
                  } else if (variant) {
                    newCouncil.master = { model: "", variant };
                  }
                  const isEmpty = !newCouncil.master?.model && !variant && 
                    !newCouncil.councillor_execution_mode && 
                    !newCouncil.master_timeout && 
                    !newCouncil.councillors_timeout &&
                    !newCouncil.councillor_retries;
                  onCouncilChange(isEmpty ? undefined : newCouncil);
                }}
                placeholder="Optional"
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-20">{t("councilExecModeLabel")}</span>
              <select
                value={council.councillor_execution_mode ?? "parallel"}
                onChange={(e) => {
                  const mode = e.target.value;
                  const newCouncil = { ...council, councillor_execution_mode: mode as SlimCouncilConfig["councillor_execution_mode"] };
                  const isEmpty = !newCouncil.master?.model && !newCouncil.master?.variant && 
                    mode === "parallel" && 
                    !newCouncil.master_timeout && 
                    !newCouncil.councillors_timeout &&
                    !newCouncil.councillor_retries;
                  onCouncilChange(isEmpty ? undefined : newCouncil);
                }}
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                {SLIM_COUNCILLOR_EXECUTION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-20">{t("councilMasterTimeoutLabel")}</span>
              <input
                type="number" min={0} max={600000}
                value={council.master_timeout ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const timeout = isNaN(val) ? undefined : Math.min(600000, Math.max(0, val));
                  const newCouncil = { ...council, master_timeout: timeout };
                  const isEmpty = !newCouncil.master?.model && !newCouncil.master?.variant && 
                    !newCouncil.councillor_execution_mode && 
                    !timeout && 
                    !newCouncil.councillors_timeout &&
                    !newCouncil.councillor_retries;
                  onCouncilChange(isEmpty ? undefined : newCouncil);
                }}
                placeholder="15000"
                className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-20">{t("councilCouncillorsTimeoutLabel")}</span>
              <input
                type="number" min={0} max={600000}
                value={council.councillors_timeout ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const timeout = isNaN(val) ? undefined : Math.min(600000, Math.max(0, val));
                  const newCouncil = { ...council, councillors_timeout: timeout };
                  const isEmpty = !newCouncil.master?.model && !newCouncil.master?.variant && 
                    !newCouncil.councillor_execution_mode && 
                    !newCouncil.master_timeout && 
                    !timeout &&
                    !newCouncil.councillor_retries;
                  onCouncilChange(isEmpty ? undefined : newCouncil);
                }}
                placeholder="30000"
                className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-20">{t("councilRetriesLabel")}</span>
              <input
                type="number" min={0} max={5}
                value={council.councillor_retries ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const retries = isNaN(val) ? undefined : Math.min(5, Math.max(0, val));
                  const newCouncil = { ...council, councillor_retries: retries };
                  const isEmpty = !newCouncil.master?.model && !newCouncil.master?.variant && 
                    !newCouncil.councillor_execution_mode && 
                    !newCouncil.master_timeout && 
                    !newCouncil.councillors_timeout &&
                    !retries;
                  onCouncilChange(isEmpty ? undefined : newCouncil);
                }}
                placeholder="2"
                className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

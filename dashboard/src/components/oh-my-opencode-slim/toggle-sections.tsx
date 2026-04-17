"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type {
  OhMyOpenCodeSlimFullConfig,
  SlimTmuxConfig,
  SlimBackgroundConfig,
  SlimFallbackConfig,
  SlimCouncilConfig,
  SlimMultiplexerConfig,
  SlimInterviewConfig,
  SlimTodoContinuationConfig,
  SlimWebsearchConfig,
  SlimManualPlanEntry,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import {
  SLIM_TMUX_LAYOUTS,
  SLIM_SCORING_VERSIONS,
  SLIM_COUNCILLOR_EXECUTION_MODES,
  SLIM_MULTIPLEXER_TYPES,
  SLIM_WEBSEARCH_PROVIDERS,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import { HelpTooltip } from "@/components/ui/tooltip";

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
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {label}
          {tooltip && <HelpTooltip content={tooltip} />}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
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

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function JsonApplyEditor({
  value,
  placeholder,
  onApply,
  applyLabel,
  invalidLabel,
}: {
  value: unknown;
  placeholder: string;
  onApply: (parsed: unknown) => void;
  applyLabel: string;
  invalidLabel: string;
}) {
  const [draft, setDraft] = useState(() => formatJson(value));
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    try {
      const parsed = draft.trim() ? JSON.parse(draft) : {};
      setError(null);
      onApply(parsed);
    } catch {
      setError(invalidLabel);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
        className="h-32 w-full rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 font-mono text-xs text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors resize-y"
        placeholder={placeholder}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] text-red-600/70">{error}</div>
        <button
          type="button"
          onClick={handleApply}
          className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}

interface SlimToggleSectionsProps {
  overrides: OhMyOpenCodeSlimFullConfig;
  onTmuxChange: (tmux: SlimTmuxConfig | undefined) => void;
  onBackgroundChange: (background: SlimBackgroundConfig | undefined) => void;
  onFallbackChange: (fallback: SlimFallbackConfig | undefined) => void;
  onCouncilChange: (council: SlimCouncilConfig | undefined) => void;
  onDisabledMcpAdd: (mcp: string) => boolean;
  onDisabledMcpRemove: (mcp: string) => void;
  onScalarChange: (field: string, value: unknown) => void;
  onMultiplexerChange: (multiplexer: SlimMultiplexerConfig | undefined) => void;
  onDisabledAgentAdd: (agent: string) => boolean;
  onDisabledAgentRemove: (agent: string) => void;
  onInterviewChange: (interview: SlimInterviewConfig | undefined) => void;
  onTodoContinuationChange: (todoContinuation: SlimTodoContinuationConfig | undefined) => void;
  onWebsearchChange: (websearch: SlimWebsearchConfig | undefined) => void;
  onManualPlanChange: (manualPlan: Record<string, SlimManualPlanEntry> | undefined) => void;
  onRawOverridesChange: (overrides: unknown) => void;
}

export function SlimToggleSections({
  overrides,
  onTmuxChange,
  onBackgroundChange,
  onFallbackChange,
  onCouncilChange,
  onDisabledMcpAdd,
  onDisabledMcpRemove,
  onScalarChange,
  onMultiplexerChange,
  onDisabledAgentAdd,
  onDisabledAgentRemove,
  onInterviewChange,
  onTodoContinuationChange,
  onWebsearchChange,
  onManualPlanChange,
  onRawOverridesChange,
}: SlimToggleSectionsProps) {
  const t = useTranslations("ohMyOpenCodeSlim");
  const [showTmux, setShowTmux] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showMcps, setShowMcps] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);
  const [showMultiplexer, setShowMultiplexer] = useState(false);
  const [showDisabledAgents, setShowDisabledAgents] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showTodoContinuation, setShowTodoContinuation] = useState(false);
  const [showWebsearch, setShowWebsearch] = useState(false);
  const [showManualPlan, setShowManualPlan] = useState(false);
  const [showRawConfig, setShowRawConfig] = useState(false);
  const [mcpInput, setMcpInput] = useState("");
  const [agentInput, setAgentInput] = useState("");

  const tmux = overrides.tmux ?? {};
  const background = overrides.background ?? {};
  const fallback = overrides.fallback ?? {};
  const council = overrides.council ?? {};
  const multiplexer = overrides.multiplexer ?? {};
  const interview = overrides.interview ?? {};
  const todoContinuation = overrides.todoContinuation ?? {};
  const websearch = overrides.websearch ?? {};

  return (
    <div className="border-t border-white/5 pt-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Section
          label={t("scoringSectionLabel")}
          isExpanded={showScoring}
          onToggle={() => setShowScoring((value) => !value)}
          tooltip={t("scoringSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-28">{t("scoringEngineLabel")}</span>
            <select
              value={overrides.scoringEngineVersion ?? "v1"}
              onChange={(event) => onScalarChange("scoringEngineVersion", event.target.value)}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_SCORING_VERSIONS.map((version) => <option key={version} value={version}>{version}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.balanceProviderUsage ?? false}
              onChange={() => onScalarChange("balanceProviderUsage", !(overrides.balanceProviderUsage ?? false))}
              className="accent-black"
            />
            {t("balanceProviderLabel")}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.setDefaultAgent ?? false}
              onChange={() => onScalarChange("setDefaultAgent", !(overrides.setDefaultAgent ?? false))}
              className="accent-black"
            />
            {t("setDefaultAgentLabel")}
          </label>
        </Section>

        <Section
          label={t("multiplexerSectionLabel")}
          isExpanded={showMultiplexer}
          onToggle={() => setShowMultiplexer((value) => !value)}
          tooltip={t("multiplexerSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-16">{t("typeLabel")}</span>
            <select
              value={multiplexer.type ?? "auto"}
              onChange={(event) => onMultiplexerChange({ ...multiplexer, type: event.target.value as SlimMultiplexerConfig["type"] })}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_MULTIPLEXER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          {(multiplexer.type === "tmux" || multiplexer.type === "auto" || multiplexer.type === undefined) && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] w-16">{t("layoutLabel")}</span>
                <select
                  value={multiplexer.layout ?? "main-vertical"}
                  onChange={(event) => onMultiplexerChange({ ...multiplexer, layout: event.target.value as SlimMultiplexerConfig["layout"] })}
                  className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {SLIM_TMUX_LAYOUTS.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] w-16">{t("paneSizeLabel")}</span>
                <input
                  type="number"
                  min={20}
                  max={80}
                  value={multiplexer.main_pane_size ?? 60}
                  onChange={(event) => {
                    const next = parseInt(event.target.value, 10);
                    onMultiplexerChange({ ...multiplexer, main_pane_size: Number.isNaN(next) ? 60 : next });
                  }}
                  className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                />
              </div>
            </>
          )}
        </Section>

        <Section
          label={t("backgroundSectionLabel")}
          isExpanded={showBackground}
          onToggle={() => setShowBackground((value) => !value)}
          tooltip={t("backgroundSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">{t("maxConcurrentLabel")}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={background.maxConcurrentStarts ?? 10}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onBackgroundChange(next > 0 ? { maxConcurrentStarts: Math.min(50, next) } : undefined);
              }}
              className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
        </Section>

        <Section
          label={t("disabledAgentsSectionLabel")}
          isExpanded={showDisabledAgents}
          onToggle={() => setShowDisabledAgents((value) => !value)}
          tooltip={t("disabledAgentsSectionTooltip")}
        >
          {(overrides.disabled_agents ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(overrides.disabled_agents ?? []).map((agent) => (
                <span key={agent} className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                  {agent}
                  <button type="button" onClick={() => onDisabledAgentRemove(agent)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" aria-label={t("removeAgentAria", { agent })}>&times;</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={agentInput}
              onChange={(event) => setAgentInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (onDisabledAgentAdd(agentInput)) setAgentInput("");
                }
              }}
              placeholder={t("agentNamePlaceholder")}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={() => { if (onDisabledAgentAdd(agentInput)) setAgentInput(""); }}
              className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {t("agentAddButton")}
            </button>
          </div>
        </Section>

        <Section
          label={t("fallbackSectionLabel")}
          isExpanded={showFallback}
          onToggle={() => setShowFallback((value) => !value)}
          tooltip={t("fallbackSectionTooltip")}
        >
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={fallback.enabled ?? true}
              onChange={() => onFallbackChange({ ...fallback, enabled: !(fallback.enabled ?? true) })}
              className="accent-black"
            />
            {t("enableFallback")}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("timeoutLabel")}</span>
            <input
              type="number"
              min={0}
              value={fallback.timeoutMs ?? 15000}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onFallbackChange({ ...fallback, timeoutMs: Number.isNaN(next) ? 15000 : next });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("retryDelayLabel")}</span>
            <input
              type="number"
              min={0}
              value={fallback.retryDelayMs ?? 500}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onFallbackChange({ ...fallback, retryDelayMs: Number.isNaN(next) ? 500 : next });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={fallback.retry_on_empty ?? true}
              onChange={() => onFallbackChange({ ...fallback, retry_on_empty: !(fallback.retry_on_empty ?? true) })}
              className="accent-black"
            />
            {t("retryOnEmptyLabel")}
          </label>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">{t("fallbackChainsLabel")}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{t("fallbackChainsHelp")}</p>
            <JsonApplyEditor
            key={formatJson(fallback.chains ?? {})}
              value={fallback.chains ?? {}}
              placeholder={t("fallbackChainsPlaceholder")}
              invalidLabel={t("jsonInvalidLabel")}
              applyLabel={t("applyJsonButton")}
              onApply={(parsed) => {
                onFallbackChange({
                  ...fallback,
                  chains: isObjectRecord(parsed) && Object.keys(parsed).length > 0
                    ? parsed as Record<string, string[]>
                    : undefined,
                });
              }}
            />
          </div>
        </Section>

        <Section
          label={t("disabledMcpsSectionLabel")}
          isExpanded={showMcps}
          onToggle={() => setShowMcps((value) => !value)}
          tooltip={t("disabledMcpsSectionTooltip")}
        >
          {(overrides.disabled_mcps ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(overrides.disabled_mcps ?? []).map((mcp) => (
                <span key={mcp} className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                  {mcp}
                  <button type="button" onClick={() => onDisabledMcpRemove(mcp)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" aria-label={t("removeMcpAria", { mcp })}>&times;</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={mcpInput}
              onChange={(event) => setMcpInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (onDisabledMcpAdd(mcpInput)) setMcpInput("");
                }
              }}
              placeholder={t("mcpNamePlaceholder")}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={() => { if (onDisabledMcpAdd(mcpInput)) setMcpInput(""); }}
              className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {t("mcpAddButton")}
            </button>
          </div>
        </Section>

        <Section
          label={t("councilSectionLabel")}
          isExpanded={showCouncil}
          onToggle={() => setShowCouncil((value) => !value)}
          tooltip={t("councilSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilMasterModelLabel")}</span>
            <input
              type="text"
              value={council.master?.model ?? ""}
              onChange={(event) => onCouncilChange({ ...council, master: { ...council.master, model: event.target.value || undefined } })}
              placeholder="anthropic/claude-opus-4-6"
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilMasterVariantLabel")}</span>
            <input
              type="text"
              value={council.master?.variant ?? ""}
              onChange={(event) => onCouncilChange({ ...council, master: { ...council.master, variant: event.target.value || undefined } })}
              placeholder={t("optionalLabel")}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilExecModeLabel")}</span>
            <select
              value={council.councillor_execution_mode ?? "parallel"}
              onChange={(event) => onCouncilChange({ ...council, councillor_execution_mode: event.target.value as SlimCouncilConfig["councillor_execution_mode"] })}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_COUNCILLOR_EXECUTION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilDefaultPresetLabel")}</span>
            <input
              type="text"
              value={council.default_preset ?? ""}
              onChange={(event) => onCouncilChange({ ...council, default_preset: event.target.value || undefined })}
              placeholder="default"
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilMasterTimeoutLabel")}</span>
            <input
              type="number"
              min={0}
              max={600000}
              value={council.master_timeout ?? ""}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onCouncilChange({ ...council, master_timeout: Number.isNaN(next) ? undefined : Math.min(600000, Math.max(0, next)) });
              }}
              className="w-28 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilCouncillorsTimeoutLabel")}</span>
            <input
              type="number"
              min={0}
              max={600000}
              value={council.councillors_timeout ?? ""}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onCouncilChange({ ...council, councillors_timeout: Number.isNaN(next) ? undefined : Math.min(600000, Math.max(0, next)) });
              }}
              className="w-28 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilRetriesLabel")}</span>
            <input
              type="number"
              min={0}
              max={5}
              value={council.councillor_retries ?? ""}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onCouncilChange({ ...council, councillor_retries: Number.isNaN(next) ? undefined : Math.min(5, Math.max(0, next)) });
              }}
              className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilMasterFallbackLabel")}</span>
            <input
              type="text"
              value={(council.master_fallback ?? []).join(", ")}
              onChange={(event) => {
                const next = event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean);
                onCouncilChange({ ...council, master_fallback: next.length > 0 ? next : undefined });
              }}
              placeholder={t("modelListPlaceholder")}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          {council.master && (!council.presets || Object.keys(council.presets).length === 0) && (
            <p className="text-[11px] text-amber-600/90">{t("councilIncompleteHint")}</p>
          )}
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">{t("councilPresetsLabel")}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{t("councilPresetsHelp")}</p>
            <JsonApplyEditor
            key={formatJson(council.presets ?? {})}
              value={council.presets ?? {}}
              placeholder={t("councilPresetsPlaceholder")}
              invalidLabel={t("jsonInvalidLabel")}
              applyLabel={t("applyJsonButton")}
              onApply={(parsed) => onCouncilChange({
                ...council,
                presets: isObjectRecord(parsed) && Object.keys(parsed).length > 0
                  ? parsed as SlimCouncilConfig["presets"]
                  : undefined,
              })}
            />
          </div>
        </Section>

        <Section
          label={t("interviewSectionLabel")}
          isExpanded={showInterview}
          onToggle={() => setShowInterview((value) => !value)}
          tooltip={t("interviewSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("maxQuestionsLabel")}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={interview.maxQuestions ?? 2}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onInterviewChange({ ...interview, maxQuestions: Number.isNaN(next) ? 2 : Math.min(10, Math.max(1, next)) });
              }}
              className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("outputFolderLabel")}</span>
            <input
              type="text"
              value={interview.outputFolder ?? "interview"}
              onChange={(event) => onInterviewChange({ ...interview, outputFolder: event.target.value || "interview" })}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("interviewPortLabel")}</span>
            <input
              type="number"
              min={0}
              max={65535}
              value={interview.port ?? 0}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onInterviewChange({ ...interview, port: Number.isNaN(next) ? 0 : Math.min(65535, Math.max(0, next)) });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={interview.autoOpenBrowser ?? true}
              onChange={() => onInterviewChange({ ...interview, autoOpenBrowser: !(interview.autoOpenBrowser ?? true) })}
              className="accent-black"
            />
            {t("autoOpenBrowserLabel")}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={interview.dashboard ?? false}
              onChange={() => onInterviewChange({ ...interview, dashboard: !(interview.dashboard ?? false) })}
              className="accent-black"
            />
            {t("interviewDashboardLabel")}
          </label>
        </Section>

        <Section
          label={t("todoContinuationSectionLabel")}
          isExpanded={showTodoContinuation}
          onToggle={() => setShowTodoContinuation((value) => !value)}
          tooltip={t("todoContinuationSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("maxContinuationsLabel")}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={todoContinuation.maxContinuations ?? 5}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onTodoContinuationChange({ ...todoContinuation, maxContinuations: Number.isNaN(next) ? 5 : Math.min(50, Math.max(1, next)) });
              }}
              className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("cooldownMsLabel")}</span>
            <input
              type="number"
              min={0}
              max={30000}
              value={todoContinuation.cooldownMs ?? 3000}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onTodoContinuationChange({ ...todoContinuation, cooldownMs: Number.isNaN(next) ? 3000 : Math.min(30000, Math.max(0, next)) });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={todoContinuation.autoEnable ?? false}
              onChange={() => onTodoContinuationChange({ ...todoContinuation, autoEnable: !(todoContinuation.autoEnable ?? false) })}
              className="accent-black"
            />
            {t("autoEnableLabel")}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("autoEnableThresholdLabel")}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={todoContinuation.autoEnableThreshold ?? 4}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onTodoContinuationChange({ ...todoContinuation, autoEnableThreshold: Number.isNaN(next) ? 4 : Math.min(50, Math.max(1, next)) });
              }}
              className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
        </Section>

        <Section
          label={t("websearchSectionLabel")}
          isExpanded={showWebsearch}
          onToggle={() => setShowWebsearch((value) => !value)}
          tooltip={t("websearchSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-16">{t("providerLabel")}</span>
            <select
              value={websearch.provider ?? "exa"}
              onChange={(event) => onWebsearchChange({ ...websearch, provider: event.target.value as SlimWebsearchConfig["provider"] })}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_WEBSEARCH_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </div>
        </Section>

        <Section
          label={t("tmuxSectionLabel")}
          isExpanded={showTmux}
          onToggle={() => setShowTmux((value) => !value)}
          tooltip={t("tmuxSectionTooltip")}
        >
          <p className="text-[11px] text-[var(--text-muted)]">{t("tmuxLegacyHint")}</p>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={tmux.enabled ?? false}
              onChange={() => {
                const enabled = !(tmux.enabled ?? false);
                onTmuxChange(enabled ? { enabled: true, layout: tmux.layout ?? "main-vertical", main_pane_size: tmux.main_pane_size ?? 60 } : undefined);
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
                  onChange={(event) => onTmuxChange({ ...tmux, layout: event.target.value as SlimTmuxConfig["layout"] })}
                  className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {SLIM_TMUX_LAYOUTS.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] w-16">{t("paneSizeLabel")}</span>
                <input
                  type="number"
                  min={20}
                  max={80}
                  value={tmux.main_pane_size ?? 60}
                  onChange={(event) => {
                    const next = parseInt(event.target.value, 10);
                    onTmuxChange({ ...tmux, main_pane_size: Number.isNaN(next) ? 60 : next });
                  }}
                  className="w-20 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                />
              </div>
            </>
          )}
        </Section>
      </div>

      <Section
        label={t("manualPlanSectionLabel")}
        isExpanded={showManualPlan}
        onToggle={() => setShowManualPlan((value) => !value)}
        tooltip={t("manualPlanSectionTooltip")}
      >
        <JsonApplyEditor
          key={formatJson(overrides.manualPlan ?? {})}
          value={overrides.manualPlan ?? {}}
          placeholder={t("manualPlanPlaceholder")}
          invalidLabel={t("jsonInvalidLabel")}
          applyLabel={t("applyJsonButton")}
          onApply={(parsed) => onManualPlanChange(isObjectRecord(parsed) && Object.keys(parsed).length > 0 ? parsed as Record<string, SlimManualPlanEntry> : undefined)}
        />
      </Section>

      <Section
        label={t("advancedSectionLabel")}
        isExpanded={showRawConfig}
        onToggle={() => setShowRawConfig((value) => !value)}
        tooltip={t("advancedSectionTooltip")}
      >
        <p className="text-[11px] text-[var(--text-muted)]">{t("jsonEditorWarning")}</p>
        <JsonApplyEditor
          key={formatJson(overrides)}
          value={overrides}
          placeholder={t("jsonEditorPlaceholder")}
          invalidLabel={t("jsonInvalidLabel")}
          applyLabel={t("applyJsonButton")}
          onApply={onRawOverridesChange}
        />
      </Section>
    </div>
  );
}

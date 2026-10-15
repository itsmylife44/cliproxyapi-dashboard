"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type {
  OhMyOpenCodeSlimFullConfig,
  SlimFallbackConfig,
  SlimCouncilConfig,
  SlimMultiplexerConfig,
  SlimInterviewConfig,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import {
  SLIM_BUNDLED_SKILLS,
  SLIM_DEFAULT_MAX_RETRIES,
  SLIM_HOOKS,
  SLIM_TMUX_LAYOUTS,
  SLIM_MULTIPLEXER_TYPES,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import { ToggleListSection } from "@/components/oh-my-opencode/sections/toggle-list-section";
import { HelpTooltip } from "@/components/ui/tooltip";
import { isRecord } from "@/lib/utils";

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
  onFallbackChange: (fallback: SlimFallbackConfig | undefined) => void;
  onCouncilChange: (council: SlimCouncilConfig | undefined) => void;
  onDisabledMcpAdd: (mcp: string) => boolean;
  onDisabledMcpRemove: (mcp: string) => void;
  onSetDefaultAgentChange: (setDefaultAgent: boolean) => void;
  onMultiplexerChange: (multiplexer: SlimMultiplexerConfig | undefined) => void;
  onDisabledAgentAdd: (agent: string) => boolean;
  onDisabledAgentRemove: (agent: string) => void;
  onInterviewChange: (interview: SlimInterviewConfig | undefined) => void;
  onRawOverridesChange: (overrides: unknown) => void;
}

export function SlimToggleSections({
  overrides,
  onFallbackChange,
  onCouncilChange,
  onDisabledMcpAdd,
  onDisabledMcpRemove,
  onSetDefaultAgentChange,
  onMultiplexerChange,
  onDisabledAgentAdd,
  onDisabledAgentRemove,
  onInterviewChange,
  onRawOverridesChange,
}: SlimToggleSectionsProps) {
  const t = useTranslations("ohMyOpenCodeSlim");
  const [showFallback, setShowFallback] = useState(false);
  const [showMcps, setShowMcps] = useState(false);
  const [showDefaultAgent, setShowDefaultAgent] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);
  const [showMultiplexer, setShowMultiplexer] = useState(false);
  const [showDisabledAgents, setShowDisabledAgents] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showRawConfig, setShowRawConfig] = useState(false);
  const [showHooks, setShowHooks] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [mcpInput, setMcpInput] = useState("");
  const [agentInput, setAgentInput] = useState("");

  const fallback = overrides.fallback ?? {};
  const council = overrides.council ?? {};
  const multiplexer = overrides.multiplexer ?? {};
  const interview = overrides.interview ?? {};

  const toggleDisabled = (key: "disabled_hooks" | "disabled_skills", item: string) => {
    const current = overrides[key] ?? [];
    const next = current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item];
    onRawOverridesChange({ ...overrides, [key]: next.length > 0 ? next : undefined });
  };

  return (
    <div className="border-t border-white/5 pt-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Section
          label={t("defaultAgentSectionLabel")}
          isExpanded={showDefaultAgent}
          onToggle={() => setShowDefaultAgent((value) => !value)}
          tooltip={t("defaultAgentSectionTooltip")}
        >
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.setDefaultAgent ?? false}
              onChange={() => onSetDefaultAgentChange(!(overrides.setDefaultAgent ?? false))}
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-24">{t("maxRetriesLabel")}</span>
            <input
              type="number"
              min={0}
              value={fallback.maxRetries ?? SLIM_DEFAULT_MAX_RETRIES}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onFallbackChange({ ...fallback, maxRetries: Number.isNaN(next) ? undefined : Math.max(0, next) });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
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
                  chains: isRecord(parsed) && Object.keys(parsed).length > 0
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
            <span className="text-xs text-[var(--text-muted)] w-24">{t("councilDefaultPresetLabel")}</span>
            <input
              type="text"
              value={council.default_preset ?? ""}
              onChange={(event) => onCouncilChange({ ...council, default_preset: event.target.value || undefined })}
              placeholder="default"
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          {Object.keys(council).length > 0 && Object.keys(council.presets ?? {}).length === 0 && (
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
                presets: isRecord(parsed) && Object.keys(parsed).length > 0
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

        <ToggleListSection
          label={t("disabledHooksSectionLabel")}
          isExpanded={showHooks}
          onToggleExpand={() => setShowHooks((value) => !value)}
          items={SLIM_HOOKS}
          disabledItems={overrides.disabled_hooks ?? []}
          onItemToggle={(hook) => toggleDisabled("disabled_hooks", hook)}
        />

        <ToggleListSection
          label={t("disabledSkillsSectionLabel")}
          isExpanded={showSkills}
          onToggleExpand={() => setShowSkills((value) => !value)}
          items={SLIM_BUNDLED_SKILLS}
          disabledItems={overrides.disabled_skills ?? []}
          onItemToggle={(skill) => toggleDisabled("disabled_skills", skill)}
        />
      </div>

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

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type {
  OhMyOpenCodeSlimFullConfig,
  SlimBackgroundJobsConfig,
  SlimFallbackConfig,
  SlimCouncilConfig,
  SlimMultiplexerConfig,
  SlimInterviewConfig,
} from "@/lib/config-generators/oh-my-opencode-slim-types";
import {
  SLIM_BACKGROUND_JOB_STRATEGIES,
  SLIM_IMAGE_ROUTING_MODES,
  SLIM_MULTIPLEXER_LAYOUTS,
  SLIM_MULTIPLEXER_TYPES,
  SLIM_ZELLIJ_PANE_MODES,
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

/** Reusable "tag list" editor for the disabled_* string arrays. */
function DisabledListSection({
  entries,
  onAdd,
  onRemove,
  placeholder,
  addLabel,
  removeAriaLabel,
}: {
  entries: string[];
  onAdd: (value: string) => boolean;
  onRemove: (value: string) => void;
  placeholder: string;
  addLabel: string;
  removeAriaLabel: (value: string) => string;
}) {
  const [input, setInput] = useState("");

  const submit = () => {
    if (onAdd(input)) setInput("");
  };

  return (
    <>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <span
              key={entry}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
              {entry}
              <button
                type="button"
                onClick={() => onRemove(entry)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                aria-label={removeAriaLabel(entry)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {addLabel}
        </button>
      </div>
    </>
  );
}

interface SlimToggleSectionsProps {
  overrides: OhMyOpenCodeSlimFullConfig;
  onBackgroundJobsChange: (backgroundJobs: SlimBackgroundJobsConfig | undefined) => void;
  onFallbackChange: (fallback: SlimFallbackConfig | undefined) => void;
  onCouncilChange: (council: SlimCouncilConfig | undefined) => void;
  onDisabledMcpAdd: (mcp: string) => boolean;
  onDisabledMcpRemove: (mcp: string) => void;
  onDisabledToolAdd: (tool: string) => boolean;
  onDisabledToolRemove: (tool: string) => void;
  onDisabledSkillAdd: (skill: string) => boolean;
  onDisabledSkillRemove: (skill: string) => void;
  onScalarChange: (field: string, value: unknown) => void;
  onMultiplexerChange: (multiplexer: SlimMultiplexerConfig | undefined) => void;
  onDisabledAgentAdd: (agent: string) => boolean;
  onDisabledAgentRemove: (agent: string) => void;
  onInterviewChange: (interview: SlimInterviewConfig | undefined) => void;
  onRawOverridesChange: (overrides: unknown) => void;
}

export function SlimToggleSections({
  overrides,
  onBackgroundJobsChange,
  onFallbackChange,
  onCouncilChange,
  onDisabledMcpAdd,
  onDisabledMcpRemove,
  onDisabledToolAdd,
  onDisabledToolRemove,
  onDisabledSkillAdd,
  onDisabledSkillRemove,
  onScalarChange,
  onMultiplexerChange,
  onDisabledAgentAdd,
  onDisabledAgentRemove,
  onInterviewChange,
  onRawOverridesChange,
}: SlimToggleSectionsProps) {
  const t = useTranslations("ohMyOpenCodeSlim");
  const [showGeneral, setShowGeneral] = useState(false);
  const [showBackgroundJobs, setShowBackgroundJobs] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showMcps, setShowMcps] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);
  const [showMultiplexer, setShowMultiplexer] = useState(false);
  const [showDisabledAgents, setShowDisabledAgents] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showRawConfig, setShowRawConfig] = useState(false);

  const backgroundJobs = overrides.backgroundJobs ?? {};
  const fallback = overrides.fallback ?? {};
  const council = overrides.council ?? {};
  const multiplexer = overrides.multiplexer ?? {};
  const interview = overrides.interview ?? {};

  return (
    <div className="border-t border-white/5 pt-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Section
          label={t("generalSectionLabel")}
          isExpanded={showGeneral}
          onToggle={() => setShowGeneral((value) => !value)}
          tooltip={t("generalSectionTooltip")}
        >
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.setDefaultAgent ?? false}
              onChange={() => onScalarChange("setDefaultAgent", !(overrides.setDefaultAgent ?? false))}
              className="accent-black"
            />
            {t("setDefaultAgentLabel")}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.compactSidebar ?? true}
              onChange={() => onScalarChange("compactSidebar", !(overrides.compactSidebar ?? true))}
              className="accent-black"
            />
            {t("compactSidebarLabel")}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.stripOrchestratorModel ?? false}
              onChange={() =>
                onScalarChange("stripOrchestratorModel", !(overrides.stripOrchestratorModel ?? false))
              }
              className="accent-black"
            />
            {t("stripOrchestratorModelLabel")}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={overrides.autoUpdate ?? true}
              onChange={() => onScalarChange("autoUpdate", !(overrides.autoUpdate ?? true))}
              className="accent-black"
            />
            {t("autoUpdateLabel")}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-28">{t("imageRoutingLabel")}</span>
            <select
              value={overrides.image_routing ?? "direct"}
              onChange={(event) => onScalarChange("image_routing", event.target.value)}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_IMAGE_ROUTING_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>
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
              value={multiplexer.type ?? "none"}
              onChange={(event) => onMultiplexerChange({ ...multiplexer, type: event.target.value as SlimMultiplexerConfig["type"] })}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_MULTIPLEXER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          {(multiplexer.type === "tmux" || multiplexer.type === "auto" || multiplexer.type === undefined) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-16">{t("layoutLabel")}</span>
              <select
                value={multiplexer.layout ?? "main-vertical"}
                onChange={(event) => onMultiplexerChange({ ...multiplexer, layout: event.target.value as SlimMultiplexerConfig["layout"] })}
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                {SLIM_MULTIPLEXER_LAYOUTS.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
              </select>
            </div>
          )}
          {multiplexer.type === "zellij" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-16">{t("zellijPaneModeLabel")}</span>
              <select
                value={multiplexer.zellij_pane_mode ?? "agent-tab"}
                onChange={(event) => onMultiplexerChange({ ...multiplexer, zellij_pane_mode: event.target.value as SlimMultiplexerConfig["zellij_pane_mode"] })}
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                {SLIM_ZELLIJ_PANE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </div>
          )}
          {(multiplexer.type === "tmux" || multiplexer.type === "auto" || multiplexer.type === undefined) && (
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
          )}
        </Section>

        <Section
          label={t("backgroundJobsSectionLabel")}
          isExpanded={showBackgroundJobs}
          onToggle={() => setShowBackgroundJobs((value) => !value)}
          tooltip={t("backgroundJobsSectionTooltip")}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-32">{t("backgroundStrategyLabel")}</span>
            <select
              value={backgroundJobs.strategy ?? "latest"}
              onChange={(event) => onBackgroundJobsChange({ ...backgroundJobs, strategy: event.target.value as SlimBackgroundJobsConfig["strategy"] })}
              className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            >
              {SLIM_BACKGROUND_JOB_STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>{strategy}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-32">{t("maxSessionsPerAgentLabel")}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={backgroundJobs.maxSessionsPerAgent ?? 2}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onBackgroundJobsChange({
                  ...backgroundJobs,
                  maxSessionsPerAgent: Number.isNaN(next) ? 2 : Math.min(10, Math.max(1, next)),
                });
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
          <DisabledListSection
            entries={overrides.disabled_agents ?? []}
            onAdd={onDisabledAgentAdd}
            onRemove={onDisabledAgentRemove}
            placeholder={t("agentNamePlaceholder")}
            addLabel={t("agentAddButton")}
            removeAriaLabel={(agent) => t("removeAgentAria", { agent })}
          />
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
            <span className="text-xs text-[var(--text-muted)] w-32">{t("maxRetriesLabel")}</span>
            <input
              type="number"
              min={0}
              value={fallback.maxRetries ?? 3}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onFallbackChange({ ...fallback, maxRetries: Number.isNaN(next) ? 3 : Math.max(0, next) });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-32">{t("initialRetryDelayLabel")}</span>
            <input
              type="number"
              min={0}
              value={fallback.initialRetryDelayMs ?? 0}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onFallbackChange({ ...fallback, initialRetryDelayMs: Number.isNaN(next) ? 0 : Math.max(0, next) });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-32">{t("retryDelayLabel")}</span>
            <input
              type="number"
              min={0}
              value={fallback.retryDelayMs ?? 500}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                onFallbackChange({ ...fallback, retryDelayMs: Number.isNaN(next) ? 500 : Math.max(0, next) });
              }}
              className="w-24 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
            />
          </div>
        </Section>

        <Section
          label={t("disabledMcpsSectionLabel")}
          isExpanded={showMcps}
          onToggle={() => setShowMcps((value) => !value)}
          tooltip={t("disabledMcpsSectionTooltip")}
        >
          <DisabledListSection
            entries={overrides.disabled_mcps ?? []}
            onAdd={onDisabledMcpAdd}
            onRemove={onDisabledMcpRemove}
            placeholder={t("mcpNamePlaceholder")}
            addLabel={t("mcpAddButton")}
            removeAriaLabel={(mcp) => t("removeMcpAria", { mcp })}
          />
        </Section>

        <Section
          label={t("disabledToolsSectionLabel")}
          isExpanded={showTools}
          onToggle={() => setShowTools((value) => !value)}
          tooltip={t("disabledToolsSectionTooltip")}
        >
          <DisabledListSection
            entries={overrides.disabled_tools ?? []}
            onAdd={onDisabledToolAdd}
            onRemove={onDisabledToolRemove}
            placeholder={t("toolNamePlaceholder")}
            addLabel={t("toolAddButton")}
            removeAriaLabel={(tool) => t("removeToolAria", { tool })}
          />
        </Section>

        <Section
          label={t("disabledSkillsSectionLabel")}
          isExpanded={showSkills}
          onToggle={() => setShowSkills((value) => !value)}
          tooltip={t("disabledSkillsSectionTooltip")}
        >
          <DisabledListSection
            entries={overrides.disabled_skills ?? []}
            onAdd={onDisabledSkillAdd}
            onRemove={onDisabledSkillRemove}
            placeholder={t("skillNamePlaceholder")}
            addLabel={t("skillAddButton")}
            removeAriaLabel={(skill) => t("removeSkillAria", { skill })}
          />
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

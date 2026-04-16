"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { CopyBlock } from "@/components/copy-block";
import { downloadFile } from "@/components/oh-my-opencode/model-badge";
import { SlimTierAssignments } from "@/components/oh-my-opencode-slim/tier-assignments";
import { SlimToggleSections } from "@/components/oh-my-opencode-slim/toggle-sections";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import {
  SLIM_AGENT_ROLES,
  buildSlimConfig,
  pickBestModel,
  type ConfigData,
  type OAuthAccount,
} from "@/lib/config-generators/oh-my-opencode-slim";
import {
  validateSlimConfig,
  type OhMyOpenCodeSlimFullConfig,
  type SlimAgentConfig,
  type SlimBackgroundConfig,
  type SlimFallbackConfig,
  type SlimTmuxConfig,
  type SlimCouncilConfig,
  type SlimPreset,
  type SlimMultiplexerConfig,
  type SlimInterviewConfig,
  type SlimTodoContinuationConfig,
  type SlimWebsearchConfig,
  type SlimManualPlanEntry,
} from "@/lib/config-generators/oh-my-opencode-slim-types";

interface OhMyOpenCodeSlimConfigGeneratorProps {
  apiKeys: { key: string; name: string | null }[];
  config: ConfigData | null;
  oauthAccounts: OAuthAccount[];
  proxyModelIds?: string[];
  excludedModels?: string[];
  slimOverrides?: OhMyOpenCodeSlimFullConfig;
  modelSourceMap?: Map<string, string>;
}

type EditingScope = "agents" | "preset";

const DEFAULT_PRESET_NAME = "cliproxyapi";

export function applySlimTerminalOverrides(
  overrides: OhMyOpenCodeSlimFullConfig,
  change: { tmux: SlimTmuxConfig | undefined } | { multiplexer: SlimMultiplexerConfig | undefined },
): OhMyOpenCodeSlimFullConfig {
  // Legacy tmux and canonical multiplexer are mutually exclusive editor surfaces.
  if ("tmux" in change) {
    return { ...overrides, tmux: change.tmux, multiplexer: undefined };
  }

  return { ...overrides, multiplexer: change.multiplexer, tmux: undefined };
}

export function OhMyOpenCodeSlimConfigGenerator(props: OhMyOpenCodeSlimConfigGeneratorProps) {
  const { apiKeys, proxyModelIds, excludedModels, slimOverrides: initialOverrides, modelSourceMap } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [editingConfig, setEditingConfig] = useState<EditingScope>("preset");
  const [agentJsonDraft, setAgentJsonDraft] = useState("{}");
  const [saving, setSaving] = useState(false);

  const t = useTranslations("ohMyOpenCodeSlim");
  const { showToast } = useToast();
  const validatedInitialOverrides = useMemo(
    () => validateSlimConfig(initialOverrides ?? {}),
    [initialOverrides],
  );

  const [overrides, setOverrides] = useState<OhMyOpenCodeSlimFullConfig>(validatedInitialOverrides);
  const [activePreset, setActivePreset] = useState<string>(validatedInitialOverrides.preset ?? DEFAULT_PRESET_NAME);
  const latestSaveRef = useRef<OhMyOpenCodeSlimFullConfig>(validatedInitialOverrides);

  useEffect(() => {
    latestSaveRef.current = validatedInitialOverrides;
    setOverrides(validatedInitialOverrides);
    setActivePreset(validatedInitialOverrides.preset ?? DEFAULT_PRESET_NAME);
  }, [validatedInitialOverrides]);

  const saveOverrides = useCallback(
    async (newOverrides: OhMyOpenCodeSlimFullConfig) => {
      const previous = latestSaveRef.current;
      latestSaveRef.current = newOverrides;
      setSaving(true);
      try {
        const res = await fetch(API_ENDPOINTS.AGENT_CONFIG_SLIM, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: newOverrides }),
        });
        if (!res.ok) {
          if (latestSaveRef.current === newOverrides) {
            latestSaveRef.current = previous;
            setOverrides(previous);
            setActivePreset(previous.preset ?? DEFAULT_PRESET_NAME);
          }
          showToast(t("toastSaveFailed"), "error");
          return;
        }
        showToast(t("toastSaved"), "success");
      } catch {
        if (latestSaveRef.current === newOverrides) {
          latestSaveRef.current = previous;
          setOverrides(previous);
          setActivePreset(previous.preset ?? DEFAULT_PRESET_NAME);
        }
        showToast(t("toastNetworkError"), "error");
      } finally {
        setSaving(false);
      }
    },
    [showToast, t],
  );

  const commitOverrides = useCallback(
    (nextRaw: OhMyOpenCodeSlimFullConfig) => {
      const next = validateSlimConfig(nextRaw);
      setOverrides(next);
      void saveOverrides(next);
    },
    [saveOverrides],
  );

  const allModelIds = proxyModelIds ?? [];
  const availableModelIds = excludedModels
    ? allModelIds.filter((id: string) => !excludedModels.includes(id))
    : allModelIds;
  const hasModels = availableModelIds.length > 0;

  const presetNames = useMemo(() => {
    const names = new Set(Object.keys(overrides.presets ?? {}).filter((name) => name !== DEFAULT_PRESET_NAME));
    if (activePreset !== DEFAULT_PRESET_NAME) names.add(activePreset);
    return [DEFAULT_PRESET_NAME, ...names];
  }, [activePreset, overrides.presets]);

  const currentEditableAgents = useMemo<Record<string, SlimAgentConfig>>(
    () => editingConfig === "preset"
      ? ((overrides.presets?.[activePreset] ?? {}) as Record<string, SlimAgentConfig>)
      : (overrides.agents ?? {}),
    [activePreset, editingConfig, overrides.agents, overrides.presets],
  );

  useEffect(() => {
    setAgentJsonDraft(JSON.stringify(currentEditableAgents, null, 2));
  }, [currentEditableAgents]);

  const slimConfig = hasModels
    ? buildSlimConfig(availableModelIds, overrides, { presetName: activePreset })
    : null;
  const configJson = slimConfig ? JSON.stringify(slimConfig, null, 2) : "";

  const updateCurrentAgents = useCallback(
    (updater: (current: Record<string, SlimAgentConfig>) => Record<string, SlimAgentConfig>) => {
      const nextAgents = updater({ ...currentEditableAgents });

      if (editingConfig === "preset") {
        const nextPresets = { ...(overrides.presets ?? {}) };
        if (Object.keys(nextAgents).length > 0) {
          nextPresets[activePreset] = nextAgents as SlimPreset;
        } else {
          delete nextPresets[activePreset];
        }

        commitOverrides({
          ...overrides,
          preset: activePreset === DEFAULT_PRESET_NAME ? undefined : activePreset,
          presets: Object.keys(nextPresets).length > 0 ? nextPresets : undefined,
        });
        return;
      }

      commitOverrides({
        ...overrides,
        agents: Object.keys(nextAgents).length > 0 ? nextAgents : undefined,
      });
    },
    [activePreset, commitOverrides, currentEditableAgents, editingConfig, overrides],
  );

  const createPreset = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || presetNames.includes(trimmed)) return false;

    const nextPresets = { ...(overrides.presets ?? {}), [trimmed]: {} as SlimPreset };
    setActivePreset(trimmed);
    setEditingConfig("preset");
    commitOverrides({
      ...overrides,
      preset: trimmed,
      presets: nextPresets,
    });
    return true;
  };

  const switchPreset = (name: string) => {
    setActivePreset(name);
    setEditingConfig("preset");
    commitOverrides({
      ...overrides,
      preset: name === DEFAULT_PRESET_NAME ? undefined : name,
    });
  };

  const deletePreset = (name: string) => {
    if (name === DEFAULT_PRESET_NAME) return;

    const nextPresets = { ...(overrides.presets ?? {}) };
    delete nextPresets[name];
    const nextActivePreset = activePreset === name ? DEFAULT_PRESET_NAME : activePreset;
    setActivePreset(nextActivePreset);

    commitOverrides({
      ...overrides,
      preset: nextActivePreset === DEFAULT_PRESET_NAME ? undefined : nextActivePreset,
      presets: Object.keys(nextPresets).length > 0 ? nextPresets : undefined,
    });
  };

  const handleAgentModelChange = (agent: string, model: string | undefined) => {
    updateCurrentAgents((current) => {
      const existing = current[agent] ?? {};
      const next = { ...current };

      if (model === undefined) {
        const updated = { ...existing };
        delete updated.model;
        if (Object.keys(updated).length === 0) {
          delete next[agent];
        } else {
          next[agent] = updated;
        }
        return next;
      }

      next[agent] = { ...existing, model };
      return next;
    });
  };

  const handleAgentFieldChange = (agent: string, field: string, value: string | number | string[] | undefined) => {
    let processedValue = value;
    if ((field === "skills" || field === "mcps") && typeof value === "string") {
      const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
      processedValue = entries.length > 0 ? entries : undefined;
    }

    updateCurrentAgents((current) => {
      const existing = current[agent] ?? {};
      const next = { ...current };

      if (
        processedValue === undefined ||
        processedValue === "" ||
        (Array.isArray(processedValue) && processedValue.length === 0)
      ) {
        const updated = { ...existing } as Record<string, unknown>;
        delete updated[field];
        if (Object.keys(updated).length === 0) {
          delete next[agent];
        } else {
          next[agent] = updated as SlimAgentConfig;
        }
        return next;
      }

      next[agent] = { ...existing, [field]: processedValue } as SlimAgentConfig;
      return next;
    });
  };

  const handleAgentSkillsChange = (agent: string, skills: string[] | undefined) => {
    updateCurrentAgents((current) => {
      const existing = current[agent] ?? {};
      const next = { ...current };

      if (skills === undefined || skills.length === 0) {
        const updated = { ...existing } as Record<string, unknown>;
        delete updated.skills;
        if (Object.keys(updated).length === 0) {
          delete next[agent];
        } else {
          next[agent] = updated as SlimAgentConfig;
        }
        return next;
      }

      next[agent] = { ...existing, skills } as SlimAgentConfig;
      return next;
    });
  };

  const applyAgentJsonDraft = () => {
    try {
      const parsed = agentJsonDraft.trim() ? JSON.parse(agentJsonDraft) : {};
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Agent JSON must be an object");
      }

      if (editingConfig === "preset") {
        const sanitized = validateSlimConfig({ presets: { [activePreset]: parsed } });
        const nextPreset = sanitized.presets?.[activePreset];
        const nextPresets = { ...(overrides.presets ?? {}) };

        if (nextPreset && Object.keys(nextPreset).length > 0) {
          nextPresets[activePreset] = nextPreset;
        } else {
          delete nextPresets[activePreset];
        }

        commitOverrides({
          ...overrides,
          preset: activePreset === DEFAULT_PRESET_NAME ? undefined : activePreset,
          presets: Object.keys(nextPresets).length > 0 ? nextPresets : undefined,
        });
        return;
      }

      const sanitized = validateSlimConfig({ agents: parsed });
      commitOverrides({
        ...overrides,
        agents: sanitized.agents,
      });
    } catch {
      showToast(t("toastInvalidJson"), "error");
    }
  };

  const handleTmuxChange = (tmux: SlimTmuxConfig | undefined) => {
    commitOverrides(applySlimTerminalOverrides(overrides, { tmux }));
  };

  const handleBackgroundChange = (background: SlimBackgroundConfig | undefined) => {
    commitOverrides({ ...overrides, background });
  };

  const handleFallbackChange = (fallback: SlimFallbackConfig | undefined) => {
    commitOverrides({ ...overrides, fallback });
  };

  const handleCouncilChange = (council: SlimCouncilConfig | undefined) => {
    commitOverrides({ ...overrides, council });
  };

  const handleDisabledMcpAdd = (mcp: string) => {
    const trimmed = mcp.trim();
    if (!trimmed) return false;
    const current = overrides.disabled_mcps ?? [];
    if (current.includes(trimmed)) return true;
    commitOverrides({ ...overrides, disabled_mcps: [...current, trimmed] });
    return true;
  };

  const handleDisabledMcpRemove = (mcp: string) => {
    const next = (overrides.disabled_mcps ?? []).filter((item) => item !== mcp);
    commitOverrides({ ...overrides, disabled_mcps: next.length > 0 ? next : undefined });
  };

  const handleMultiplexerChange = (multiplexer: SlimMultiplexerConfig | undefined) => {
    commitOverrides(applySlimTerminalOverrides(overrides, { multiplexer }));
  };

  const handleDisabledAgentAdd = (agent: string) => {
    const trimmed = agent.trim();
    if (!trimmed) return false;
    const current = overrides.disabled_agents ?? [];
    if (current.includes(trimmed)) return true;
    commitOverrides({ ...overrides, disabled_agents: [...current, trimmed] });
    return true;
  };

  const handleDisabledAgentRemove = (agent: string) => {
    const next = (overrides.disabled_agents ?? []).filter((item) => item !== agent);
    commitOverrides({ ...overrides, disabled_agents: next.length > 0 ? next : undefined });
  };

  const handleInterviewChange = (interview: SlimInterviewConfig | undefined) => {
    commitOverrides({ ...overrides, interview });
  };

  const handleTodoContinuationChange = (todoContinuation: SlimTodoContinuationConfig | undefined) => {
    commitOverrides({ ...overrides, todoContinuation });
  };

  const handleWebsearchChange = (websearch: SlimWebsearchConfig | undefined) => {
    commitOverrides({ ...overrides, websearch });
  };

  const handleManualPlanChange = (manualPlan: Record<string, SlimManualPlanEntry> | undefined) => {
    commitOverrides({ ...overrides, manualPlan });
  };

  const handleRawOverridesChange = (nextRaw: unknown) => {
    if (typeof nextRaw !== "object" || nextRaw === null || Array.isArray(nextRaw)) {
      showToast(t("toastInvalidJson"), "error");
      return;
    }
    commitOverrides(nextRaw as OhMyOpenCodeSlimFullConfig);
  };

  const handleScalarChange = (field: string, value: unknown) => {
    if (!["setDefaultAgent", "scoringEngineVersion", "balanceProviderUsage"].includes(field)) return;
    commitOverrides({ ...overrides, [field]: value } as OhMyOpenCodeSlimFullConfig);
  };

  if (apiKeys.length === 0) {
    return (
      <div className="space-y-3">
        <div className="border-l-4 border-amber-300 bg-amber-500/10 p-4 rounded-r-xl">
          <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t("apiKeyRequiredTitle")}</div>
          <p className="text-sm text-[var(--text-secondary)]">{t("apiKeyRequiredDesc")}</p>
          <Link
            href="/dashboard/api-keys"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
          >
            {t("createApiKeyLink")}
          </Link>
        </div>
      </div>
    );
  }

  if (!hasModels || !slimConfig) {
    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-300 bg-amber-500/10 p-4 text-sm rounded-r-xl">
          <p className="text-[var(--text-primary)] font-medium mb-1">{t("noProvidersTitle")}</p>
          <p className="text-[var(--text-muted)] text-xs">
            {t("noProvidersDesc")}{" "}
            <Link
              href="/dashboard/providers"
              className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] underline underline-offset-2 decoration-[var(--surface-border)]"
            >
              {t("noProvidersLink")}
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const agentAssignments: Array<{
    name: string;
    model: string;
    isOverride: boolean;
    isUnresolved?: boolean;
    config: SlimAgentConfig;
    tier: 1 | 2 | 3 | 4;
    label: string;
  }> = [];

  for (const [agent, role] of Object.entries(SLIM_AGENT_ROLES)) {
    const agentConfig = currentEditableAgents[agent] ?? {};
    const overrideModel = agentConfig.model;

    if (typeof overrideModel === "string" && availableModelIds.includes(overrideModel)) {
      agentAssignments.push({
        name: agent,
        model: overrideModel,
        isOverride: true,
        isUnresolved: false,
        config: agentConfig,
        tier: role.tier,
        label: role.label,
      });
      continue;
    }

    const model = pickBestModel(availableModelIds, role.tier);
    if (model) {
      agentAssignments.push({
        name: agent,
        model,
        isOverride: overrideModel !== undefined,
        isUnresolved: false,
        config: agentConfig,
        tier: role.tier,
        label: role.label,
      });
      continue;
    }

    agentAssignments.push({
      name: agent,
      model: typeof overrideModel === "string" ? overrideModel : `unresolved-tier-${role.tier}` ,
      isOverride: overrideModel !== undefined,
      isUnresolved: true,
      config: agentConfig,
      tier: role.tier,
      label: role.label,
    });
  }

  agentAssignments.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const handleDownload = () => {
    if (configJson) {
      downloadFile(configJson, "oh-my-opencode-slim.json");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        {t("description")}
        {saving && <span className="ml-2 text-amber-700/70 text-xs">{t("saving")}</span>}
      </p>

      <div className="space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{t("presetManagement")}</p>
          <button
            type="button"
            onClick={() => setShowPresetManager((value) => !value)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {showPresetManager ? t("hidePresetManager") : t("managePresets")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] min-w-[72px]">{t("activePreset")}</span>
          <select
            value={activePreset}
            onChange={(event) => switchPreset(event.target.value)}
            className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            {presetNames.map((name) => (
              <option key={name} value={name}>
                {name === DEFAULT_PRESET_NAME ? t("defaultPresetOption") : name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] min-w-[72px]">{t("editingMode")}</span>
          <div className="flex rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] text-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setEditingConfig("preset")}
              className={`px-3 py-1 transition-colors ${
                editingConfig === "preset"
                  ? "bg-[var(--surface-border)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t("editPreset")}
            </button>
            <button
              type="button"
              onClick={() => setEditingConfig("agents")}
              className={`px-3 py-1 transition-colors border-l border-[var(--surface-border)] ${
                editingConfig === "agents"
                  ? "bg-[var(--surface-border)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t("editGlobal")}
            </button>
          </div>
        </div>

        {showPresetManager && (
          <div className="border-t border-white/5 pt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(event) => setNewPresetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (createPreset(newPresetName)) setNewPresetName("");
                  }
                }}
                placeholder={t("newPresetPlaceholder")}
                className="flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (createPreset(newPresetName)) setNewPresetName("");
                }}
                className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {t("createPreset")}
              </button>
            </div>

            {presetNames.length > 1 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">{t("existingPresets")}</p>
                <div className="flex flex-wrap gap-1">
                  {presetNames.filter((name) => name !== DEFAULT_PRESET_NAME).map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => deletePreset(name)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        aria-label={t("deletePresetAria", { preset: name })}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SlimTierAssignments
        agentAssignments={agentAssignments}
        availableModelIds={availableModelIds}
        modelSourceMap={modelSourceMap}
        onAgentModelChange={handleAgentModelChange}
        onAgentFieldChange={handleAgentFieldChange}
        onAgentSkillsChange={handleAgentSkillsChange}
        editingConfig={editingConfig}
        activePreset={activePreset}
      />

      <div className="space-y-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{t("advancedAgentJsonLabel")}</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {editingConfig === "preset"
                ? t("advancedAgentJsonPresetDescription", { preset: activePreset })
                : t("advancedAgentJsonGlobalDescription")}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t("observerHint")}</p>
          </div>
          <button
            type="button"
            onClick={applyAgentJsonDraft}
            className="rounded border border-[var(--surface-border)] bg-[var(--surface-base)] px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {t("applyJsonButton")}
          </button>
        </div>
        <textarea
          value={agentJsonDraft}
          onChange={(event) => setAgentJsonDraft(event.target.value)}
          spellCheck={false}
          className="h-40 w-full rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 font-mono text-xs text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors resize-y"
          placeholder={t("agentJsonPlaceholder")}
        />
      </div>

      <SlimToggleSections
        overrides={overrides}
        onTmuxChange={handleTmuxChange}
        onBackgroundChange={handleBackgroundChange}
        onFallbackChange={handleFallbackChange}
        onCouncilChange={handleCouncilChange}
        onDisabledMcpAdd={handleDisabledMcpAdd}
        onDisabledMcpRemove={handleDisabledMcpRemove}
        onScalarChange={handleScalarChange}
        onMultiplexerChange={handleMultiplexerChange}
        onDisabledAgentAdd={handleDisabledAgentAdd}
        onDisabledAgentRemove={handleDisabledAgentRemove}
        onInterviewChange={handleInterviewChange}
        onTodoContinuationChange={handleTodoContinuationChange}
        onWebsearchChange={handleWebsearchChange}
        onManualPlanChange={handleManualPlanChange}
        onRawOverridesChange={handleRawOverridesChange}
      />

      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <svg
          width="12"
          height="12"
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
        {isExpanded ? t("hideConfig") : t("showConfig")}
      </button>

      {isExpanded && (
        <div className="space-y-4">
          <CopyBlock code={configJson} />
          <div className="flex gap-3">
            <Button onClick={handleDownload} variant="secondary" className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("downloadButton")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
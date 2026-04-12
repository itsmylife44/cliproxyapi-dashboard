"use client";

import type { SlimAgentConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { ModelBadge } from "@/components/oh-my-opencode/model-badge";
import { AgentSkillsSection } from "@/components/oh-my-opencode-slim/skills-section";
import { HelpTooltip } from "@/components/ui/tooltip";
import { useTranslations } from 'next-intl';

interface SlimTierAssignmentItem {
  name: string;
  model: string;
  isOverride: boolean;
  isUnresolved?: boolean;
  config: SlimAgentConfig;
  tier: 1 | 2 | 3 | 4;
  label: string;
}

interface SlimTierAssignmentsProps {
  agentAssignments: SlimTierAssignmentItem[];
  availableModelIds: string[];
  modelSourceMap?: Map<string, string>;
  onAgentModelChange: (agent: string, model: string | undefined) => void;
  onAgentFieldChange: (agent: string, field: string, value: string | number | string[] | undefined) => void;
  onAgentSkillsChange: (agent: string, skills: string[] | undefined) => void;
}

export function SlimTierAssignments({
  agentAssignments,
  availableModelIds,
  modelSourceMap,
  onAgentModelChange,
  onAgentFieldChange,
  onAgentSkillsChange,
}: SlimTierAssignmentsProps) {
  const t = useTranslations('ohMyOpenCode');
  const overrideCount = agentAssignments.filter((item) => item.isOverride).length;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{t("slimAgentAssignments")} <HelpTooltip content={t("slimAgentAssignmentsTooltip")} /></p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {overrideCount}/{agentAssignments.length} {t("custom")}
        </p>
      </div>
      {[1, 2, 3, 4].map((tier) => {
        const tierAssignments = agentAssignments.filter((item) => item.tier === tier);
        if (tierAssignments.length === 0) return null;
        const tierLabelKeys = { 1: "tier1Label", 2: "tier2Label", 3: "tier3Label", 4: "tier4Label" } as const;
        const tierHintKeys = { 1: "tier1Hint", 2: "tier2Hint", 3: "tier3Hint", 4: "tier4Hint" } as const;
        const tierKey = tier as 1 | 2 | 3 | 4;

        return (
          <div key={`slim-tier-${tier}`} className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {t(tierLabelKeys[tierKey])}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{t(tierHintKeys[tierKey])}</p>
            </div>
            <div className="space-y-2">
              {tierAssignments.map(({ name, model, isOverride, isUnresolved, config, label }) => (
                <div
                  key={name}
                  className="rounded-lg border border-[var(--surface-border)] bg-black/15 p-3 space-y-2.5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{name}</p>
                        {isUnresolved && (
                          <span className="text-amber-500 text-xs" title={t("modelNotAvailableTooltip")}>⚠️</span>
                        )}
                      </div>
                      <p className={`text-[11px] ${isUnresolved ? "text-amber-500" : "text-[var(--text-muted)]"}`}>
                        {isUnresolved ? t("modelUnavailable") : label}
                      </p>
                    </div>
                    <ModelBadge
                      name={name}
                      model={model}
                      isOverride={isOverride}
                      showName={false}
                      availableModels={availableModelIds}
                      modelSourceMap={modelSourceMap}
                      onSelect={(value) => onAgentModelChange(name, value)}
                      extraFields={{
                        variant: config.variant,
                        temperature: config.temperature,
                        thirdField: config.mcps?.join(", ") ?? "",
                        thirdFieldKey: "mcps",
                        thirdFieldPlaceholder: "mcps (comma-separated)",
                        fallback_models: undefined,
                      }}
                      onFieldChange={(field, value) => {
                        if (
                          value === undefined ||
                          typeof value === "string" ||
                          typeof value === "number" ||
                          Array.isArray(value)
                        ) {
                          onAgentFieldChange(name, field, value);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">{t("skillsLabel")} <HelpTooltip content={t("skillsLabelTooltip")} /></span>
                    <AgentSkillsSection
                      agentName={name}
                      config={config}
                      onSkillsChange={onAgentSkillsChange}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

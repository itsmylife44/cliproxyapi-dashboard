"use client";

import type { SlimAgentConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { ModelBadge, TIER_META } from "@/components/oh-my-opencode/model-badge";
import { AgentSkillsSection } from "@/components/oh-my-opencode-slim/skills-section";
import { HelpTooltip } from "@/components/ui/tooltip";

interface SlimTierAssignmentItem {
  name: string;
  model: string;
  isOverride: boolean;
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
  const overrideCount = agentAssignments.filter((item) => item.isOverride).length;

  return (
    <div className="space-y-3 rounded-lg border border-[#e5e5e5] bg-[#f5f5f5] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[#777169]">Slim Agent Assignments <HelpTooltip content="Each agent is auto-assigned the best model from your proxy based on its tier. Click the model to override. The orchestrator delegates tasks to other agents automatically." /></p>
        <p className="text-[11px] text-[#999]">
          {overrideCount}/{agentAssignments.length} custom
        </p>
      </div>
      {[1, 2, 3, 4].map((tier) => {
        const tierAssignments = agentAssignments.filter((item) => item.tier === tier);
        if (tierAssignments.length === 0) return null;
        const tierMeta = TIER_META[tier as 1 | 2 | 3 | 4];

        return (
          <div key={`slim-tier-${tier}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999]">
                {tierMeta.label}
              </p>
              <p className="text-[11px] text-[#aaa]">{tierMeta.hint}</p>
            </div>
            <div className="space-y-2">
              {tierAssignments.map(({ name, model, isOverride, config, label }) => (
                <div
                  key={name}
                  className="rounded-lg border border-[#e5e5e5] bg-black/15 p-3 space-y-2.5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-black font-mono">{name}</p>
                      <p className="text-[11px] text-[#999]">{label}</p>
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
                    <span className="text-[10px] text-[#999]">Skills <HelpTooltip content="Toggle which skills this agent can use. 'All' enables everything. With 'All' active, click a skill to exclude it. Install skills first via the setup command above." /></span>
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

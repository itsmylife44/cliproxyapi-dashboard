"use client";

import type { AgentConfigEntry, CategoryConfigEntry } from "@/lib/config-generators/oh-my-opencode-types";

import { ModelBadge, TIER_META } from "@/components/oh-my-opencode/model-badge";

interface TierAssignmentItem<TConfig> {
  name: string;
  model: string;
  isOverride: boolean;
  config: TConfig;
  tier: 1 | 2 | 3 | 4;
  label: string;
}

interface TierAssignmentsProps {
  agentAssignments: TierAssignmentItem<AgentConfigEntry>[];
  categoryAssignments: TierAssignmentItem<CategoryConfigEntry>[];
  availableModelIds: string[];
  modelSourceMap?: Map<string, string>;
  onAgentModelChange: (agent: string, model: string | undefined) => void;
  onAgentFieldChange: (agent: string, field: string, value: string | number | undefined) => void;
  onCategoryModelChange: (category: string, model: string | undefined) => void;
  onCategoryFieldChange: (category: string, field: string, value: string | number | undefined) => void;
}

export function TierAssignments({
  agentAssignments,
  categoryAssignments,
  availableModelIds,
  modelSourceMap,
  onAgentModelChange,
  onAgentFieldChange,
  onCategoryModelChange,
  onCategoryFieldChange,
}: TierAssignmentsProps) {
  const agentOverrideCount = agentAssignments.filter((item) => item.isOverride).length;
  const categoryOverrideCount = categoryAssignments.filter((item) => item.isOverride).length;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {agentAssignments.length > 0 && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Agent Assignments</p>
            <p className="text-[11px] text-white/40">
              {agentOverrideCount}/{agentAssignments.length} custom
            </p>
          </div>
          {[1, 2, 3, 4].map((tier) => {
            const tierAssignments = agentAssignments.filter((item) => item.tier === tier);
            if (tierAssignments.length === 0) {
              return null;
            }
            const tierMeta = TIER_META[tier as 1 | 2 | 3 | 4];

            return (
              <div key={`agent-tier-${tier}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                    {tierMeta.label}
                  </p>
                  <p className="text-[11px] text-white/35">{tierMeta.hint}</p>
                </div>
                <div className="space-y-1.5">
                  {tierAssignments.map(({ name, model, isOverride, config, label }) => (
                    <div
                      key={name}
                      className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/15 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white/90 font-mono">{name}</p>
                        <p className="truncate text-[11px] text-white/45">{label}</p>
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
                          thirdField: config.prompt_append,
                          thirdFieldKey: "prompt_append",
                          thirdFieldPlaceholder: "prompt append",
                        }}
                        onFieldChange={(field, value) => onAgentFieldChange(name, field, value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {categoryAssignments.length > 0 && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Category Assignments</p>
            <p className="text-[11px] text-white/40">
              {categoryOverrideCount}/{categoryAssignments.length} custom
            </p>
          </div>
          {[1, 2, 3, 4].map((tier) => {
            const tierAssignments = categoryAssignments.filter((item) => item.tier === tier);
            if (tierAssignments.length === 0) {
              return null;
            }
            const tierMeta = TIER_META[tier as 1 | 2 | 3 | 4];

            return (
              <div key={`category-tier-${tier}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                    {tierMeta.label}
                  </p>
                  <p className="text-[11px] text-white/35">{tierMeta.hint}</p>
                </div>
                <div className="space-y-1.5">
                  {tierAssignments.map(({ name, model, isOverride, config, label }) => (
                    <div
                      key={name}
                      className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/15 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white/90 font-mono">{name}</p>
                        <p className="truncate text-[11px] text-white/45">{label}</p>
                      </div>
                      <ModelBadge
                        name={name}
                        model={model}
                        isOverride={isOverride}
                        showName={false}
                        availableModels={availableModelIds}
                        modelSourceMap={modelSourceMap}
                        onSelect={(value) => onCategoryModelChange(name, value)}
                        extraFields={{
                          variant: config.variant,
                          temperature: config.temperature,
                          thirdField: config.description,
                          thirdFieldKey: "description",
                          thirdFieldPlaceholder: "description",
                        }}
                        onFieldChange={(field, value) => onCategoryFieldChange(name, field, value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

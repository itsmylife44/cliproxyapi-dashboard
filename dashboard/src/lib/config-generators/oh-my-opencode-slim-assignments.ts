import { SLIM_AGENT_ROLES, pickBestModel } from "./oh-my-opencode-slim";
import type { SlimAgentConfig } from "./oh-my-opencode-slim-types";

export interface SlimTierAssignmentItem {
  name: string;
  model: string;
  isOverride: boolean;
  isUnresolved?: boolean;
  inheritedFrom?: string;
  inheritsModelFrom?: NonNullable<SlimAgentConfig["inheritModelFrom"]>;
  config: SlimAgentConfig;
  tier: 1 | 2 | 3 | 4;
  label: string;
}

interface BuildSlimAgentAssignmentsInput {
  agents: Record<string, SlimAgentConfig>;
  availableModelIds: string[];
  /** Parent preset name when editing a preset that `extends` another. */
  inheritedFrom?: string;
  /** The model slim resolves for `agent` from the parent preset chain. */
  resolveParentModel: (agent: string) => string | undefined;
  /** Shown in the badge when the model comes from elsewhere and is not known here. */
  inheritedModelLabel: string;
}

/** One card per slim agent, showing the model slim will actually use for it. */
export function buildSlimAgentAssignments({
  agents,
  availableModelIds,
  inheritedFrom,
  resolveParentModel,
  inheritedModelLabel,
}: BuildSlimAgentAssignmentsInput): SlimTierAssignmentItem[] {
  const assignments: SlimTierAssignmentItem[] = [];

  for (const [agent, role] of Object.entries(SLIM_AGENT_ROLES)) {
    const config = agents[agent] ?? {};
    const overrideModel = config.model;
    const base = { name: agent, config, tier: role.tier, label: role.label };

    // Only a scalar model beats inheritance; slim uses an array as the fallback after the session or orchestrator model.
    if (config.inheritModelFrom !== undefined && typeof overrideModel !== "string") {
      assignments.push({ ...base, model: inheritedModelLabel, isOverride: false, inheritsModelFrom: config.inheritModelFrom });
      continue;
    }

    // The generator emits a configured model as-is (external or array too), so show its primary entry.
    const primary = overrideModel === undefined ? undefined : [overrideModel].flat()[0];
    const configuredModel = typeof primary === "string" ? primary : primary?.id;
    if (configuredModel !== undefined) {
      assignments.push({ ...base, model: configuredModel, isOverride: true, isUnresolved: false });
      continue;
    }

    // Slim takes this agent's model from the parent preset, so show that instead of an auto-pick.
    if (inheritedFrom !== undefined) {
      assignments.push({
        ...base,
        model: resolveParentModel(agent)?.replace(/^cliproxyapi\//, "") ?? inheritedModelLabel,
        isOverride: false,
        inheritedFrom,
      });
      continue;
    }

    const model = pickBestModel(availableModelIds, role.tier);
    if (model) {
      assignments.push({ ...base, model, isOverride: false, isUnresolved: false });
      continue;
    }

    assignments.push({ ...base, model: `unresolved-tier-${role.tier}`, isOverride: false, isUnresolved: true });
  }

  return assignments.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

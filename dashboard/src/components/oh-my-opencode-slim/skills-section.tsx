"use client";

import type { SlimAgentConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";

/**
 * Known skills available for oh-my-opencode-slim agents.
 * These are installed via `bunx oh-my-opencode-slim@latest install --skills=yes`
 */
const KNOWN_SKILLS = [
  { id: "*", label: "All skills", description: "Enable every available skill" },
  { id: "simplify", label: "Simplify", description: "YAGNI code simplification" },
  { id: "cartography", label: "Cartography", description: "Repository codemap generation" },
  { id: "agent-browser", label: "Agent Browser", description: "Browser automation for designer" },
] as const;

interface AgentSkillsSectionProps {
  agentName: string;
  config: SlimAgentConfig;
  onSkillsChange: (agent: string, skills: string[] | undefined) => void;
}

export function AgentSkillsSection({ agentName, config, onSkillsChange }: AgentSkillsSectionProps) {
  const currentSkills = config.skills ?? [];
  const hasWildcard = currentSkills.includes("*");

  const isEnabled = (skillId: string) => {
    if (skillId === "*") return hasWildcard;
    if (hasWildcard) {
      // With wildcard active, check if explicitly excluded
      return !currentSkills.includes(`!${skillId}`);
    }
    return currentSkills.includes(skillId);
  };

  const toggleSkill = (skillId: string) => {
    if (skillId === "*") {
      // Toggle wildcard
      if (hasWildcard) {
        onSkillsChange(agentName, undefined);
      } else {
        onSkillsChange(agentName, ["*"]);
      }
      return;
    }

    if (hasWildcard) {
      // With wildcard: toggle exclusion
      const exclusion = `!${skillId}`;
      if (currentSkills.includes(exclusion)) {
        const newSkills = currentSkills.filter((s) => s !== exclusion);
        onSkillsChange(agentName, newSkills);
      } else {
        onSkillsChange(agentName, [...currentSkills, exclusion]);
      }
    } else {
      // Without wildcard: toggle inclusion
      if (currentSkills.includes(skillId)) {
        const newSkills = currentSkills.filter((s) => s !== skillId);
        onSkillsChange(agentName, newSkills.length > 0 ? newSkills : undefined);
      } else {
        onSkillsChange(agentName, [...currentSkills, skillId]);
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {KNOWN_SKILLS.map((skill) => {
        const enabled = isEnabled(skill.id);
        const excluded = hasWildcard && skill.id !== "*" && currentSkills.includes(`!${skill.id}`);
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => toggleSkill(skill.id)}
            title={`${skill.description}${excluded ? " (excluded)" : ""}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              enabled
                ? "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-primary)]"
                : excluded
                  ? "border-red-500/20 bg-red-500/10 text-red-600/70 line-through"
                  : "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-muted)] hover:border-[var(--surface-border)]"
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-500/100" : excluded ? "bg-red-400" : "bg-[var(--surface-border)]"}`} />
            {skill.label}
          </button>
        );
      })}
    </div>
  );
}

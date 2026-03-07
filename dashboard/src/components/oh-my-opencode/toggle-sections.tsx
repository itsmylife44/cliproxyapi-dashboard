"use client";

import { useState } from "react";

import type {
  BackgroundTaskConfig,
  GitMasterConfig,
  HookGroupName,
  OhMyOpenCodeFullConfig,
  SisyphusAgentConfig,
  TmuxConfig,
} from "@/lib/config-generators/oh-my-opencode-types";
import {
  AVAILABLE_AGENTS,
  AVAILABLE_COMMANDS,
  AVAILABLE_SKILLS,
  BROWSER_PROVIDERS,
  HOOK_GROUPS,
  TMUX_LAYOUTS,
} from "@/lib/config-generators/oh-my-opencode-types";

import { ChevronIcon, CollapsibleSection, DisabledCountBadge, ToggleList, ToggleSwitch } from "./_components/toggle-ui";
import { LspSection } from "./_components/lsp-section";

interface ToggleSectionsProps {
  overrides: OhMyOpenCodeFullConfig;
  providerConcurrencyRows: Array<{ key: string; value: number }>;
  modelConcurrencyRows: Array<{ key: string; value: number }>;
  onDisabledAgentToggle: (agent: string) => void;
  onDisabledSkillToggle: (skill: string) => void;
  onDisabledCommandToggle: (command: string) => void;
  onDisabledHookToggle: (hook: string) => void;
  onTmuxEnabledToggle: () => void;
  onTmuxLayoutChange: (layout: string) => void;
  onTmuxNumberChange: (field: keyof TmuxConfig, value: number) => void;
  onBgTaskNumberChange: (field: keyof BackgroundTaskConfig, value: number) => void;
  onProviderConcurrencyChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onProviderConcurrencyAdd: () => void;
  onProviderConcurrencyRemove: (index: number) => void;
  onModelConcurrencyChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onModelConcurrencyAdd: () => void;
  onModelConcurrencyRemove: (index: number) => void;
  onSisyphusToggle: (field: keyof SisyphusAgentConfig) => void;
  onGitMasterToggle: (field: keyof GitMasterConfig) => void;
  onBrowserProviderChange: (provider: string) => void;
  onMcpAdd: (mcp: string) => boolean;
  onMcpRemove: (mcp: string) => void;
  onLspAdd: (language: string, command: string, extensions: string) => boolean;
  onLspRemove: (language: string) => void;
}

export function ToggleSections({
  overrides,
  providerConcurrencyRows,
  modelConcurrencyRows,
  onDisabledAgentToggle,
  onDisabledSkillToggle,
  onDisabledCommandToggle,
  onDisabledHookToggle,
  onTmuxEnabledToggle,
  onTmuxLayoutChange,
  onTmuxNumberChange,
  onBgTaskNumberChange,
  onProviderConcurrencyChange,
  onProviderConcurrencyAdd,
  onProviderConcurrencyRemove,
  onModelConcurrencyChange,
  onModelConcurrencyAdd,
  onModelConcurrencyRemove,
  onSisyphusToggle,
  onGitMasterToggle,
  onBrowserProviderChange,
  onMcpAdd,
  onMcpRemove,
  onLspAdd,
  onLspRemove,
}: ToggleSectionsProps) {
  const [showAgents, setShowAgents] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showHooks, setShowHooks] = useState(false);
  const [expandedHookGroups, setExpandedHookGroups] = useState<Set<HookGroupName>>(new Set());
  const [showTmux, setShowTmux] = useState(false);
  const [showBgTask, setShowBgTask] = useState(false);
  const [showSisyphus, setShowSisyphus] = useState(false);
  const [showGitMaster, setShowGitMaster] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showMcps, setShowMcps] = useState(false);
  const [mcpInput, setMcpInput] = useState("");

  const toggleHookGroup = (group: HookGroupName) => {
    const newExpanded = new Set(expandedHookGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedHookGroups(newExpanded);
  };

  const handleMcpAdd = () => {
    const shouldClear = onMcpAdd(mcpInput);
    if (shouldClear) {
      setMcpInput("");
    }
  };

  return (
    <>
      <LspSection overrides={overrides} onLspAdd={onLspAdd} onLspRemove={onLspRemove} />

      <div className="border-t border-white/5 pt-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 space-y-3">
            {/* Agents */}
            <CollapsibleSection
              label="Agents"
              expanded={showAgents}
              onToggle={() => setShowAgents(!showAgents)}
              badge={<DisabledCountBadge count={(overrides.disabled_agents ?? []).length} />}
            >
              <ToggleList items={AVAILABLE_AGENTS} disabledItems={overrides.disabled_agents ?? []} onToggle={onDisabledAgentToggle} />
            </CollapsibleSection>

            {/* Commands */}
            <CollapsibleSection
              label="Commands"
              expanded={showCommands}
              onToggle={() => setShowCommands(!showCommands)}
              badge={<DisabledCountBadge count={(overrides.disabled_commands ?? []).length} />}
            >
              <ToggleList items={AVAILABLE_COMMANDS} disabledItems={overrides.disabled_commands ?? []} onToggle={onDisabledCommandToggle} />
            </CollapsibleSection>

            {/* Tmux */}
            <CollapsibleSection
              label="Tmux"
              expanded={showTmux}
              onToggle={() => setShowTmux(!showTmux)}
              badge={overrides.tmux?.enabled ? (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 text-[10px] font-mono">enabled</span>
              ) : undefined}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                  <span className="text-xs text-white/70 font-mono">Enabled</span>
                  <ToggleSwitch enabled={!!overrides.tmux?.enabled} onToggle={onTmuxEnabledToggle} />
                </div>
                {overrides.tmux?.enabled && (
                  <>
                    <div className="space-y-1">
                      <span className="text-xs text-white/50">Layout</span>
                      <select
                        value={overrides.tmux.layout ?? "main-vertical"}
                        onChange={(e) => onTmuxLayoutChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                      >
                        {TMUX_LAYOUTS.map((layout) => (
                          <option key={layout} value={layout}>{layout}</option>
                        ))}
                      </select>
                    </div>
                    <NumberField label="Main Pane Size (20-80)" min={20} max={80} defaultValue={overrides.tmux.main_pane_size ?? 60} onChange={(v) => onTmuxNumberChange("main_pane_size", v)} />
                    <NumberField label="Main Pane Min Width" min={0} defaultValue={overrides.tmux.main_pane_min_width ?? 120} onChange={(v) => onTmuxNumberChange("main_pane_min_width", v)} />
                    <NumberField label="Agent Pane Min Width" min={0} defaultValue={overrides.tmux.agent_pane_min_width ?? 40} onChange={(v) => onTmuxNumberChange("agent_pane_min_width", v)} />
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* Sisyphus Agent */}
            <CollapsibleSection label="Sisyphus Agent" expanded={showSisyphus} onToggle={() => setShowSisyphus(!showSisyphus)}>
              <div className="space-y-1">
                {([
                  { field: "disabled" as const, label: "Disabled", defaultValue: false },
                  { field: "default_builder_enabled" as const, label: "Default Builder Enabled", defaultValue: false },
                  { field: "planner_enabled" as const, label: "Planner Enabled", defaultValue: true },
                  { field: "replace_plan" as const, label: "Replace Plan", defaultValue: true },
                ] as const).map(({ field, label, defaultValue }) => (
                  <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                    <span className="text-xs text-white/70 font-mono">{label}</span>
                    <ToggleSwitch enabled={overrides.sisyphus_agent?.[field] ?? defaultValue} onToggle={() => onSisyphusToggle(field)} />
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Browser Automation */}
            <CollapsibleSection label="Browser Automation" expanded={showBrowser} onToggle={() => setShowBrowser(!showBrowser)}>
              <div className="space-y-1">
                <span className="text-xs text-white/50">Provider</span>
                <select
                  value={overrides.browser_automation_engine?.provider ?? "playwright"}
                  onChange={(e) => onBrowserProviderChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                >
                  {BROWSER_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
            </CollapsibleSection>
          </div>

          <div className="flex-1 space-y-3">
            {/* Skills */}
            <CollapsibleSection
              label="Skills"
              expanded={showSkills}
              onToggle={() => setShowSkills(!showSkills)}
              badge={<DisabledCountBadge count={(overrides.disabled_skills ?? []).length} />}
            >
              <ToggleList items={AVAILABLE_SKILLS} disabledItems={overrides.disabled_skills ?? []} onToggle={onDisabledSkillToggle} />
            </CollapsibleSection>

            {/* Hooks */}
            <CollapsibleSection
              label="Hooks"
              expanded={showHooks}
              onToggle={() => setShowHooks(!showHooks)}
              badge={<DisabledCountBadge count={(overrides.disabled_hooks ?? []).length} />}
            >
              <div className="space-y-2">
                {(Object.entries(HOOK_GROUPS) as [HookGroupName, readonly string[]][]).map(([groupName, hooks]) => {
                  const disabledCount = hooks.filter((h) => (overrides.disabled_hooks ?? []).includes(h)).length;
                  const isGroupExpanded = expandedHookGroups.has(groupName);
                  return (
                    <div key={groupName}>
                      <button
                        type="button"
                        onClick={() => toggleHookGroup(groupName)}
                        className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
                      >
                        <ChevronIcon expanded={isGroupExpanded} />
                        {groupName} ({disabledCount}/{hooks.length} disabled)
                      </button>
                      {isGroupExpanded && (
                        <div className="space-y-1 pl-4 mt-1">
                          <ToggleList items={hooks} disabledItems={overrides.disabled_hooks ?? []} onToggle={onDisabledHookToggle} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            {/* Background Tasks */}
            <CollapsibleSection label="Background Tasks" expanded={showBgTask} onToggle={() => setShowBgTask(!showBgTask)}>
              <div className="space-y-2">
                <NumberField label="Default Concurrency" min={1} defaultValue={overrides.background_task?.defaultConcurrency ?? 5} onChange={(v) => onBgTaskNumberChange("defaultConcurrency", v)} />
                <NumberField label="Stale Timeout (ms)" min={60000} defaultValue={overrides.background_task?.staleTimeoutMs ?? 180000} onChange={(v) => onBgTaskNumberChange("staleTimeoutMs", v)} />
                <ConcurrencyRows
                  label="Provider Concurrency"
                  rows={providerConcurrencyRows}
                  placeholder="Provider"
                  onAdd={onProviderConcurrencyAdd}
                  onChange={onProviderConcurrencyChange}
                  onRemove={onProviderConcurrencyRemove}
                />
                <ConcurrencyRows
                  label="Model Concurrency"
                  rows={modelConcurrencyRows}
                  placeholder="Model"
                  onAdd={onModelConcurrencyAdd}
                  onChange={onModelConcurrencyChange}
                  onRemove={onModelConcurrencyRemove}
                />
              </div>
            </CollapsibleSection>

            {/* Git Master */}
            <CollapsibleSection label="Git Master" expanded={showGitMaster} onToggle={() => setShowGitMaster(!showGitMaster)}>
              <div className="space-y-1">
                {([
                  { field: "commit_footer" as const, label: "Commit Footer", defaultValue: false },
                  { field: "include_co_authored_by" as const, label: "Include Co-Authored-By", defaultValue: false },
                ] as const).map(({ field, label, defaultValue }) => (
                  <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                    <span className="text-xs text-white/70 font-mono">{label}</span>
                    <ToggleSwitch enabled={overrides.git_master?.[field] ?? defaultValue} onToggle={() => onGitMasterToggle(field)} />
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Disabled MCPs */}
            <CollapsibleSection
              label="Disabled MCPs"
              expanded={showMcps}
              onToggle={() => setShowMcps(!showMcps)}
              badge={<span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">{(overrides.disabled_mcps ?? []).length}</span>}
            >
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="MCP name"
                    value={mcpInput}
                    onChange={(e) => setMcpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleMcpAdd();
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/40"
                  />
                  <button type="button" onClick={handleMcpAdd} className="px-3 py-1.5 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(overrides.disabled_mcps ?? []).map((mcp) => (
                    <div key={mcp} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-red-500/10 border border-red-400/20 text-red-300">
                      <span className="font-mono">{mcp}</span>
                      <button type="button" onClick={() => onMcpRemove(mcp)} className="text-red-400 hover:text-red-200">&times;</button>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </>
  );
}

function NumberField({ label, min, max, defaultValue, onChange }: { label: string; min: number; max?: number; defaultValue: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-white/50">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
      />
    </div>
  );
}

interface ConcurrencyRowsProps {
  label: string;
  rows: Array<{ key: string; value: number }>;
  placeholder: string;
  onAdd: () => void;
  onChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onRemove: (index: number) => void;
}

function ConcurrencyRows({ label, rows, placeholder, onAdd, onChange, onRemove }: ConcurrencyRowsProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{label}</span>
        <button type="button" onClick={onAdd} className="text-xs text-violet-400 hover:text-violet-300">+ Add</button>
      </div>
      {rows.map((row, idx) => (
        <div key={`${row.key}-${idx}`} className="flex gap-2">
          <input
            type="text"
            placeholder={placeholder}
            value={row.key}
            onChange={(e) => onChange(idx, "key", e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
          />
          <input
            type="number"
            min={1}
            value={row.value}
            onChange={(e) => onChange(idx, "value", Number(e.target.value))}
            className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
          />
          <button type="button" onClick={() => onRemove(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
        </div>
      ))}
    </div>
  );
}

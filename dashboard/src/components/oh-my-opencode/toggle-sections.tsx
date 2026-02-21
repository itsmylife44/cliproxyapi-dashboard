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
  const [lspLanguage, setLspLanguage] = useState("");
  const [lspCommand, setLspCommand] = useState("");
  const [lspExtensions, setLspExtensions] = useState("");

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

  const handleLspAdd = () => {
    const shouldClear = onLspAdd(lspLanguage, lspCommand, lspExtensions);
    if (shouldClear) {
      setLspLanguage("");
      setLspCommand("");
      setLspExtensions("");
    }
  };

  return (
    <>
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
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
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              LSP Servers
            </h3>
            <p className="text-xs text-white/50 mt-1">Configure Language Server Protocol for code intelligence</p>
            <code className="text-[10px] text-emerald-300/60 font-mono block mt-1.5 bg-black/20 px-2 py-1 rounded">
              {`"lsp": { "typescript": { "command": ["typescript-language-server", "--stdio"] } }`}
            </code>
          </div>
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-mono shrink-0">
            {Object.keys(overrides.lsp ?? {}).length} configured
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              setLspLanguage("typescript");
              setLspCommand("typescript-language-server --stdio");
              setLspExtensions(".ts,.tsx");
            }}
            className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 hover:border-emerald-400/40 transition-all"
          >
            TypeScript
          </button>
          <button
            type="button"
            onClick={() => {
              setLspLanguage("tailwindcss");
              setLspCommand("tailwindcss-language-server --stdio");
              setLspExtensions("");
            }}
            className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-medium hover:bg-cyan-500/20 hover:border-cyan-400/40 transition-all"
          >
            Tailwind
          </button>
          <button
            type="button"
            onClick={() => {
              setLspLanguage("prisma");
              setLspCommand("npx -y @prisma/language-server --stdio");
              setLspExtensions(".prisma");
            }}
            className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-400/20 text-teal-300 text-xs font-medium hover:bg-teal-500/20 hover:border-teal-400/40 transition-all"
          >
            Prisma
          </button>
          <button
            type="button"
            onClick={() => {
              setLspLanguage("markdown");
              setLspCommand("npx -y remark-language-server --stdio");
              setLspExtensions(".md");
            }}
            className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium hover:bg-blue-500/20 hover:border-blue-400/40 transition-all"
          >
            Markdown
          </button>
        </div>

        <div className="grid grid-cols-[1fr,2fr,1.5fr,auto] gap-2">
          <input
            type="text"
            placeholder="language"
            value={lspLanguage}
            onChange={(e) => setLspLanguage(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
          />
          <input
            type="text"
            placeholder="command"
            value={lspCommand}
            onChange={(e) => setLspCommand(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
          />
          <input
            type="text"
            placeholder=".ts,.tsx (optional)"
            value={lspExtensions}
            onChange={(e) => setLspExtensions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLspAdd();
              }
            }}
            className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
          />
          <button
            type="button"
            onClick={handleLspAdd}
            className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30"
          >
            Add
          </button>
        </div>

        {Object.keys(overrides.lsp ?? {}).length > 0 && (
          <div className="space-y-1.5">
            {Object.entries(overrides.lsp ?? {}).map(([language, entry]) => (
              <div
                key={language}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20"
              >
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-300">{language}</span>
                  <span className="text-white/30">→</span>
                  <span className="text-white/60">{entry.command.join(" ")}</span>
                  {entry.extensions && entry.extensions.length > 0 && (
                    <>
                      <span className="text-white/30">|</span>
                      <span className="text-white/50">{entry.extensions.join(", ")}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onLspRemove(language)}
                  className="text-white/40 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 pt-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowAgents(!showAgents)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showAgents ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Agents</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                  {(overrides.disabled_agents ?? []).length} disabled
                </span>
              </button>
              {showAgents && (
                <div className="px-3 pb-3 space-y-1">
                  {AVAILABLE_AGENTS.map((agent) => {
                    const isEnabled = !(overrides.disabled_agents ?? []).includes(agent);
                    return (
                      <div key={agent} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                        <span className="text-xs text-white/70 font-mono">{agent}</span>
                        <button
                          type="button"
                          onClick={() => onDisabledAgentToggle(agent)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                              isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowCommands(!showCommands)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showCommands ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Commands</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                  {(overrides.disabled_commands ?? []).length} disabled
                </span>
              </button>
              {showCommands && (
                <div className="px-3 pb-3 space-y-1">
                  {AVAILABLE_COMMANDS.map((command) => {
                    const isEnabled = !(overrides.disabled_commands ?? []).includes(command);
                    return (
                      <div key={command} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                        <span className="text-xs text-white/70 font-mono">{command}</span>
                        <button
                          type="button"
                          onClick={() => onDisabledCommandToggle(command)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                              isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowTmux(!showTmux)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showTmux ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Tmux</span>
                {overrides.tmux?.enabled && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 text-[10px] font-mono">
                    enabled
                  </span>
                )}
              </button>
              {showTmux && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                    <span className="text-xs text-white/70 font-mono">Enabled</span>
                    <button
                      type="button"
                      onClick={onTmuxEnabledToggle}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        overrides.tmux?.enabled ? "bg-emerald-500/60" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                          overrides.tmux?.enabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                        }`}
                      />
                    </button>
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
                            <option key={layout} value={layout}>
                              {layout}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-white/50">Main Pane Size (20-80)</span>
                        <input
                          type="number"
                          min={20}
                          max={80}
                          defaultValue={overrides.tmux.main_pane_size ?? 60}
                          onChange={(e) => onTmuxNumberChange("main_pane_size", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-white/50">Main Pane Min Width</span>
                        <input
                          type="number"
                          min={0}
                          defaultValue={overrides.tmux.main_pane_min_width ?? 120}
                          onChange={(e) => onTmuxNumberChange("main_pane_min_width", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-white/50">Agent Pane Min Width</span>
                        <input
                          type="number"
                          min={0}
                          defaultValue={overrides.tmux.agent_pane_min_width ?? 40}
                          onChange={(e) => onTmuxNumberChange("agent_pane_min_width", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowSisyphus(!showSisyphus)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showSisyphus ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Sisyphus Agent</span>
              </button>
              {showSisyphus && (
                <div className="px-3 pb-3 space-y-1">
                  {[
                    { field: "disabled" as const, label: "Disabled", defaultValue: false },
                    { field: "default_builder_enabled" as const, label: "Default Builder Enabled", defaultValue: false },
                    { field: "planner_enabled" as const, label: "Planner Enabled", defaultValue: true },
                    { field: "replace_plan" as const, label: "Replace Plan", defaultValue: true },
                  ].map(({ field, label, defaultValue }) => {
                    const isEnabled = overrides.sisyphus_agent?.[field] ?? defaultValue;
                    return (
                      <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                        <span className="text-xs text-white/70 font-mono">{label}</span>
                        <button
                          type="button"
                          onClick={() => onSisyphusToggle(field)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                              isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowBrowser(!showBrowser)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showBrowser ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Browser Automation</span>
              </button>
              {showBrowser && (
                <div className="px-3 pb-3 space-y-1">
                  <span className="text-xs text-white/50">Provider</span>
                  <select
                    value={overrides.browser_automation_engine?.provider ?? "playwright"}
                    onChange={(e) => onBrowserProviderChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                  >
                    {BROWSER_PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowSkills(!showSkills)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showSkills ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Skills</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                  {(overrides.disabled_skills ?? []).length} disabled
                </span>
              </button>
              {showSkills && (
                <div className="px-3 pb-3 space-y-1">
                  {AVAILABLE_SKILLS.map((skill) => {
                    const isEnabled = !(overrides.disabled_skills ?? []).includes(skill);
                    return (
                      <div key={skill} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                        <span className="text-xs text-white/70 font-mono">{skill}</span>
                        <button
                          type="button"
                          onClick={() => onDisabledSkillToggle(skill)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                              isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowHooks(!showHooks)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showHooks ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Hooks</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                  {(overrides.disabled_hooks ?? []).length} disabled
                </span>
              </button>
              {showHooks && (
                <div className="px-3 pb-3 space-y-2">
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
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform duration-200 ${isGroupExpanded ? "rotate-90" : ""}`}
                            aria-hidden="true"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          {groupName} ({disabledCount}/{hooks.length} disabled)
                        </button>
                        {isGroupExpanded && (
                          <div className="space-y-1 pl-4 mt-1">
                            {hooks.map((hook) => {
                              const isEnabled = !(overrides.disabled_hooks ?? []).includes(hook);
                              return (
                                <div key={hook} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                                  <span className="text-xs text-white/70 font-mono">{hook}</span>
                                  <button
                                    type="button"
                                    onClick={() => onDisabledHookToggle(hook)}
                                    className={`w-9 h-5 rounded-full transition-colors relative ${
                                      isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                                    }`}
                                  >
                                    <span
                                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                                        isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowBgTask(!showBgTask)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showBgTask ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Background Tasks</span>
              </button>
              {showBgTask && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs text-white/50">Default Concurrency</span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={overrides.background_task?.defaultConcurrency ?? 5}
                      onChange={(e) => onBgTaskNumberChange("defaultConcurrency", Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-white/50">Stale Timeout (ms)</span>
                    <input
                      type="number"
                      min={60000}
                      defaultValue={overrides.background_task?.staleTimeoutMs ?? 180000}
                      onChange={(e) => onBgTaskNumberChange("staleTimeoutMs", Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Provider Concurrency</span>
                      <button
                        type="button"
                        onClick={onProviderConcurrencyAdd}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        + Add
                      </button>
                    </div>
                    {providerConcurrencyRows.map((row, idx) => (
                      <div key={`${row.key}-${idx}`} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Provider"
                          value={row.key}
                          onChange={(e) => onProviderConcurrencyChange(idx, "key", e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                        <input
                          type="number"
                          min={1}
                          value={row.value}
                          onChange={(e) => onProviderConcurrencyChange(idx, "value", Number(e.target.value))}
                          className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                        <button
                          type="button"
                          onClick={() => onProviderConcurrencyRemove(idx)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Model Concurrency</span>
                      <button
                        type="button"
                        onClick={onModelConcurrencyAdd}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        + Add
                      </button>
                    </div>
                    {modelConcurrencyRows.map((row, idx) => (
                      <div key={`${row.key}-${idx}`} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Model"
                          value={row.key}
                          onChange={(e) => onModelConcurrencyChange(idx, "key", e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                        <input
                          type="number"
                          min={1}
                          value={row.value}
                          onChange={(e) => onModelConcurrencyChange(idx, "value", Number(e.target.value))}
                          className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                        />
                        <button
                          type="button"
                          onClick={() => onModelConcurrencyRemove(idx)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowGitMaster(!showGitMaster)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showGitMaster ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Git Master</span>
              </button>
              {showGitMaster && (
                <div className="px-3 pb-3 space-y-1">
                  {[
                    { field: "commit_footer" as const, label: "Commit Footer", defaultValue: false },
                    { field: "include_co_authored_by" as const, label: "Include Co-Authored-By", defaultValue: false },
                  ].map(({ field, label, defaultValue }) => {
                    const isEnabled = overrides.git_master?.[field] ?? defaultValue;
                    return (
                      <div key={field} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                        <span className="text-xs text-white/70 font-mono">{label}</span>
                        <button
                          type="button"
                          onClick={() => onGitMasterToggle(field)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            isEnabled ? "bg-emerald-500/60" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                              isEnabled ? "translate-x-4 bg-emerald-200" : "bg-white/40"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
              <button
                type="button"
                onClick={() => setShowMcps(!showMcps)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showMcps ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex-1 text-left">Disabled MCPs</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-mono">
                  {(overrides.disabled_mcps ?? []).length}
                </span>
              </button>
              {showMcps && (
                <div className="px-3 pb-3 space-y-2">
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
                    <button
                      type="button"
                      onClick={handleMcpAdd}
                      className="px-3 py-1.5 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(overrides.disabled_mcps ?? []).map((mcp) => (
                      <div
                        key={mcp}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-red-500/10 border border-red-400/20 text-red-300"
                      >
                        <span className="font-mono">{mcp}</span>
                        <button
                          type="button"
                          onClick={() => onMcpRemove(mcp)}
                          className="text-red-400 hover:text-red-200"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

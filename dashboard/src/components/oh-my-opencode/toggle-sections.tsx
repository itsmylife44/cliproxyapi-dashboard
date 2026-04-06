"use client";

import { useState } from "react";

import type {
  BackgroundTaskConfig,
  GitMasterConfig,
  HookGroupName,
  ExperimentalConfig,
  OhMyOpenCodeFullConfig,
  SisyphusAgentConfig,
  TmuxConfig,
} from "@/lib/config-generators/oh-my-opencode-types";
import {
  AVAILABLE_AGENTS,
  AVAILABLE_COMMANDS,
  AVAILABLE_SKILLS,
} from "@/lib/config-generators/oh-my-opencode-types";

import {
  BackgroundTasksSection,
  BrowserSection,
  DisabledMcpsSection,
  GitMasterSection,
  HooksSection,
  LspServersSection,
  SisyphusSection,
  AdvancedOptionsSection,
  TmuxSection,
  ToggleListSection,
} from "./sections";

interface ToggleSectionsProps {
  overrides: OhMyOpenCodeFullConfig;
  providerConcurrencyRows: Array<{ _id: string; key: string; value: number }>;
  modelConcurrencyRows: Array<{ _id: string; key: string; value: number }>;
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
  onHashlineEditToggle: () => void;
  onExperimentalToggle: (field: keyof ExperimentalConfig) => void;
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
  onHashlineEditToggle,
  onExperimentalToggle,
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
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
      <LspServersSection
        overrides={overrides}
        lspLanguage={lspLanguage}
        lspCommand={lspCommand}
        lspExtensions={lspExtensions}
        onLspLanguageChange={setLspLanguage}
        onLspCommandChange={setLspCommand}
        onLspExtensionsChange={setLspExtensions}
        onLspAdd={handleLspAdd}
        onLspRemove={onLspRemove}
      />

      <div className="border-t border-white/5 pt-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 space-y-3">
            <ToggleListSection
              label="Agents"
              isExpanded={showAgents}
              onToggleExpand={() => setShowAgents(!showAgents)}
              items={AVAILABLE_AGENTS}
              disabledItems={overrides.disabled_agents ?? []}
              onItemToggle={onDisabledAgentToggle}
            />

            <ToggleListSection
              label="Commands"
              isExpanded={showCommands}
              onToggleExpand={() => setShowCommands(!showCommands)}
              items={AVAILABLE_COMMANDS}
              disabledItems={overrides.disabled_commands ?? []}
              onItemToggle={onDisabledCommandToggle}
            />

            <TmuxSection
              isExpanded={showTmux}
              onToggleExpand={() => setShowTmux(!showTmux)}
              overrides={overrides}
              onTmuxEnabledToggle={onTmuxEnabledToggle}
              onTmuxLayoutChange={onTmuxLayoutChange}
              onTmuxNumberChange={onTmuxNumberChange}
            />

            <SisyphusSection
              isExpanded={showSisyphus}
              onToggleExpand={() => setShowSisyphus(!showSisyphus)}
              overrides={overrides}
              onSisyphusToggle={onSisyphusToggle}
            />

            <BrowserSection
              isExpanded={showBrowser}
              onToggleExpand={() => setShowBrowser(!showBrowser)}
              overrides={overrides}
              onBrowserProviderChange={onBrowserProviderChange}
            />
          </div>

          <div className="flex-1 space-y-3">
            <ToggleListSection
              label="Skills"
              isExpanded={showSkills}
              onToggleExpand={() => setShowSkills(!showSkills)}
              items={AVAILABLE_SKILLS}
              disabledItems={overrides.disabled_skills ?? []}
              onItemToggle={onDisabledSkillToggle}
            />

            <HooksSection
              isExpanded={showHooks}
              onToggleExpand={() => setShowHooks(!showHooks)}
              disabledHooks={overrides.disabled_hooks ?? []}
              expandedHookGroups={expandedHookGroups}
              onHookToggle={onDisabledHookToggle}
              onHookGroupToggle={toggleHookGroup}
            />

            <BackgroundTasksSection
              isExpanded={showBgTask}
              onToggleExpand={() => setShowBgTask(!showBgTask)}
              overrides={overrides}
              providerConcurrencyRows={providerConcurrencyRows}
              modelConcurrencyRows={modelConcurrencyRows}
              onBgTaskNumberChange={onBgTaskNumberChange}
              onProviderConcurrencyChange={onProviderConcurrencyChange}
              onProviderConcurrencyAdd={onProviderConcurrencyAdd}
              onProviderConcurrencyRemove={onProviderConcurrencyRemove}
              onModelConcurrencyChange={onModelConcurrencyChange}
              onModelConcurrencyAdd={onModelConcurrencyAdd}
              onModelConcurrencyRemove={onModelConcurrencyRemove}
            />

            <GitMasterSection
              isExpanded={showGitMaster}
              onToggleExpand={() => setShowGitMaster(!showGitMaster)}
              overrides={overrides}
              onGitMasterToggle={onGitMasterToggle}
            />

            <AdvancedOptionsSection
              isExpanded={showAdvancedOptions}
              onToggleExpand={() => setShowAdvancedOptions(!showAdvancedOptions)}
              overrides={overrides}
              onHashlineEditToggle={onHashlineEditToggle}
              onExperimentalToggle={onExperimentalToggle}
            />

            <DisabledMcpsSection
              isExpanded={showMcps}
              onToggleExpand={() => setShowMcps(!showMcps)}
              disabledMcps={overrides.disabled_mcps ?? []}
              mcpInput={mcpInput}
              onMcpInputChange={setMcpInput}
              onMcpAdd={handleMcpAdd}
              onMcpRemove={onMcpRemove}
            />
          </div>
        </div>
      </div>
    </>
  );
}

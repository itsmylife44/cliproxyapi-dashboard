/**
 * Oh-My-OpenCode Configuration Types
 * 
 * This module provides TypeScript interfaces and constants for all
 * oh-my-opencode optional configuration sections.
 */

import type { McpEntry } from "./opencode";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TmuxConfig {
  enabled?: boolean;
  layout?: string;
  main_pane_size?: number;
  main_pane_min_width?: number;
  agent_pane_min_width?: number;
}

export interface BackgroundTaskConfig {
  defaultConcurrency?: number;
  staleTimeoutMs?: number;
  providerConcurrency?: Record<string, number>;
  modelConcurrency?: Record<string, number>;
}

export interface BrowserAutomationConfig {
  provider?: string;
}

export interface SisyphusAgentConfig {
  disabled?: boolean;
  default_builder_enabled?: boolean;
  planner_enabled?: boolean;
  replace_plan?: boolean;
}

export interface GitMasterConfig {
  commit_footer?: boolean;
  include_co_authored_by?: boolean;
}

export interface LspEntry {
  command: string[];
  extensions?: string[];
}

export interface AgentConfigEntry {
  model?: string;
  variant?: string;
  temperature?: number;
  prompt_append?: string;
}

export interface CategoryConfigEntry {
  model?: string;
  variant?: string;
  temperature?: number;
  description?: string;
}

export interface OhMyOpenCodeFullConfig {
  agents?: Record<string, AgentConfigEntry>;
  categories?: Record<string, CategoryConfigEntry>;
  disabled_agents?: string[];
  disabled_skills?: string[];
  disabled_hooks?: string[];
  disabled_commands?: string[];
  disabled_mcps?: string[];
  tmux?: TmuxConfig;
  background_task?: BackgroundTaskConfig;
  browser_automation_engine?: BrowserAutomationConfig;
  sisyphus_agent?: SisyphusAgentConfig;
  git_master?: GitMasterConfig;
  lsp?: Record<string, LspEntry>;
  mcpServers?: McpEntry[];
  customPlugins?: string[];
  configSchemaVersion?: number;
}

// ============================================================================
// CONSTANTS - Available Values
// ============================================================================

export const AVAILABLE_AGENTS = [
  "sisyphus",
  "prometheus",
  "oracle",
  "librarian",
  "explore",
  "multimodal-looker",
  "metis",
  "momus",
  "atlas",
] as const;

export const AVAILABLE_SKILLS = [
  "playwright",
  "agent-browser",
  "frontend-ui-ux",
  "git-master",
] as const;

export const AVAILABLE_COMMANDS = [
  "init-deep",
  "start-work",
] as const;

export const TMUX_LAYOUTS = [
  "main-vertical",
  "main-horizontal",
  "tiled",
  "even-horizontal",
  "even-vertical",
] as const;

export const BROWSER_PROVIDERS = [
  "playwright",
  "agent-browser",
] as const;

// ============================================================================
// HOOK_GROUPS - Hooks grouped by functionality
// ============================================================================

export const HOOK_GROUPS = {
  context: [
    "context-window-monitor",
    "compaction-context-injector",
    "preemptive-compaction",
  ],
  recovery: [
    "session-recovery",
    "anthropic-context-window-limit-recovery",
    "edit-error-recovery",
    "delegate-task-retry",
  ],
  notification: [
    "session-notification",
    "background-notification",
    "startup-toast",
    "auto-update-checker",
  ],
  validation: [
    "comment-checker",
    "thinking-block-validator",
    "empty-task-response-detector",
  ],
  output: [
    "grep-output-truncator",
    "tool-output-truncator",
  ],
  injection: [
    "directory-agents-injector",
    "directory-readme-injector",
    "rules-injector",
  ],
  automation: [
    "todo-continuation-enforcer",
    "keyword-detector",
    "agent-usage-reminder",
    "auto-slash-command",
    "ralph-loop",
    "start-work",
  ],
  environment: [
    "non-interactive-env",
    "interactive-bash-session",
    "think-mode",
    "claude-code-hooks",
  ],
  planning: [
    "prometheus-md-only",
    "sisyphus-junior-notepad",
    "atlas",
  ],
} as const;

export type HookGroupName = keyof typeof HOOK_GROUPS;

export const ALL_HOOK_NAMES = Object.values(HOOK_GROUPS).flat();

// ============================================================================
// VALIDATION FUNCTION
// ============================================================================

export function validateFullConfig(raw: unknown): OhMyOpenCodeFullConfig {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const result: OhMyOpenCodeFullConfig = {};

  // Validate agents override mapping
  if (obj.agents && typeof obj.agents === "object" && !Array.isArray(obj.agents)) {
    const agentsObj = obj.agents as Record<string, unknown>;
    const validatedAgents: Record<string, AgentConfigEntry> = {};
    for (const [key, value] of Object.entries(agentsObj)) {
      if (typeof value === "string") {
        // Backward compatibility: string value → { model: value }
        validatedAgents[key] = { model: value };
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const entryObj = value as Record<string, unknown>;
        const entry: AgentConfigEntry = {};
        if (typeof entryObj.model === "string") entry.model = entryObj.model;
        if (typeof entryObj.variant === "string") entry.variant = entryObj.variant;
        if (typeof entryObj.temperature === "number" && entryObj.temperature >= 0 && entryObj.temperature <= 2) {
          entry.temperature = entryObj.temperature;
        }
        if (typeof entryObj.prompt_append === "string") entry.prompt_append = entryObj.prompt_append;
        validatedAgents[key] = entry;
      }
    }
    if (Object.keys(validatedAgents).length > 0) {
      result.agents = validatedAgents;
    }
  }

  // Validate categories override mapping
  if (
    obj.categories &&
    typeof obj.categories === "object" &&
    !Array.isArray(obj.categories)
  ) {
    const categoriesObj = obj.categories as Record<string, unknown>;
    const validatedCategories: Record<string, CategoryConfigEntry> = {};
    for (const [key, value] of Object.entries(categoriesObj)) {
      if (typeof value === "string") {
        // Backward compatibility: string value → { model: value }
        validatedCategories[key] = { model: value };
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const entryObj = value as Record<string, unknown>;
        const entry: CategoryConfigEntry = {};
        if (typeof entryObj.model === "string") entry.model = entryObj.model;
        if (typeof entryObj.variant === "string") entry.variant = entryObj.variant;
        if (typeof entryObj.temperature === "number" && entryObj.temperature >= 0 && entryObj.temperature <= 2) {
          entry.temperature = entryObj.temperature;
        }
        if (typeof entryObj.description === "string") entry.description = entryObj.description;
        validatedCategories[key] = entry;
      }
    }
    if (Object.keys(validatedCategories).length > 0) {
      result.categories = validatedCategories;
    }
  }

  // Validate disabled_agents array
  if (Array.isArray(obj.disabled_agents)) {
    result.disabled_agents = obj.disabled_agents.filter(
      (v): v is string => typeof v === "string"
    );
  }

  // Validate disabled_skills array
  if (Array.isArray(obj.disabled_skills)) {
    result.disabled_skills = obj.disabled_skills.filter(
      (v): v is string => typeof v === "string"
    );
  }

  // Validate disabled_hooks array
  if (Array.isArray(obj.disabled_hooks)) {
    result.disabled_hooks = obj.disabled_hooks.filter(
      (v): v is string => typeof v === "string"
    );
  }

  // Validate disabled_commands array
  if (Array.isArray(obj.disabled_commands)) {
    result.disabled_commands = obj.disabled_commands.filter(
      (v): v is string => typeof v === "string"
    );
  }

  // Validate disabled_mcps array
  if (Array.isArray(obj.disabled_mcps)) {
    result.disabled_mcps = obj.disabled_mcps.filter(
      (v): v is string => typeof v === "string"
    );
  }

  // Validate tmux config
  if (obj.tmux && typeof obj.tmux === "object" && !Array.isArray(obj.tmux)) {
    const tmuxObj = obj.tmux as Record<string, unknown>;
    const tmuxConfig: TmuxConfig = {};

    if (typeof tmuxObj.enabled === "boolean") {
      tmuxConfig.enabled = tmuxObj.enabled;
    }

    if (typeof tmuxObj.layout === "string") {
      tmuxConfig.layout = tmuxObj.layout;
    }

    if (typeof tmuxObj.main_pane_size === "number") {
      tmuxConfig.main_pane_size = tmuxObj.main_pane_size;
    }

    if (typeof tmuxObj.main_pane_min_width === "number") {
      tmuxConfig.main_pane_min_width = tmuxObj.main_pane_min_width;
    }

    if (typeof tmuxObj.agent_pane_min_width === "number") {
      tmuxConfig.agent_pane_min_width = tmuxObj.agent_pane_min_width;
    }

    if (Object.keys(tmuxConfig).length > 0) {
      result.tmux = tmuxConfig;
    }
  }

  // Validate background_task config
  if (
    obj.background_task &&
    typeof obj.background_task === "object" &&
    !Array.isArray(obj.background_task)
  ) {
    const bgObj = obj.background_task as Record<string, unknown>;
    const bgConfig: BackgroundTaskConfig = {};

    if (typeof bgObj.defaultConcurrency === "number") {
      bgConfig.defaultConcurrency = bgObj.defaultConcurrency;
    }

    if (typeof bgObj.staleTimeoutMs === "number") {
      bgConfig.staleTimeoutMs = bgObj.staleTimeoutMs;
    }

    // Validate providerConcurrency as Record<string, number>
    if (
      bgObj.providerConcurrency &&
      typeof bgObj.providerConcurrency === "object" &&
      !Array.isArray(bgObj.providerConcurrency)
    ) {
      const providerObj = bgObj.providerConcurrency as Record<string, unknown>;
      const validatedProvider: Record<string, number> = {};
      for (const [key, value] of Object.entries(providerObj)) {
        if (typeof value === "number") {
          validatedProvider[key] = value;
        }
      }
      if (Object.keys(validatedProvider).length > 0) {
        bgConfig.providerConcurrency = validatedProvider;
      }
    }

    // Validate modelConcurrency as Record<string, number>
    if (
      bgObj.modelConcurrency &&
      typeof bgObj.modelConcurrency === "object" &&
      !Array.isArray(bgObj.modelConcurrency)
    ) {
      const modelObj = bgObj.modelConcurrency as Record<string, unknown>;
      const validatedModel: Record<string, number> = {};
      for (const [key, value] of Object.entries(modelObj)) {
        if (typeof value === "number") {
          validatedModel[key] = value;
        }
      }
      if (Object.keys(validatedModel).length > 0) {
        bgConfig.modelConcurrency = validatedModel;
      }
    }

    if (Object.keys(bgConfig).length > 0) {
      result.background_task = bgConfig;
    }
  }

  // Validate browser_automation_engine config
  if (
    obj.browser_automation_engine &&
    typeof obj.browser_automation_engine === "object" &&
    !Array.isArray(obj.browser_automation_engine)
  ) {
    const browserObj = obj.browser_automation_engine as Record<string, unknown>;
    const browserConfig: BrowserAutomationConfig = {};

    if (typeof browserObj.provider === "string") {
      browserConfig.provider = browserObj.provider;
    }

    if (Object.keys(browserConfig).length > 0) {
      result.browser_automation_engine = browserConfig;
    }
  }

  // Validate sisyphus_agent config
  if (
    obj.sisyphus_agent &&
    typeof obj.sisyphus_agent === "object" &&
    !Array.isArray(obj.sisyphus_agent)
  ) {
    const sisyphusObj = obj.sisyphus_agent as Record<string, unknown>;
    const sisyphusConfig: SisyphusAgentConfig = {};

    if (typeof sisyphusObj.disabled === "boolean") {
      sisyphusConfig.disabled = sisyphusObj.disabled;
    }

    if (typeof sisyphusObj.default_builder_enabled === "boolean") {
      sisyphusConfig.default_builder_enabled = sisyphusObj.default_builder_enabled;
    }

    if (typeof sisyphusObj.planner_enabled === "boolean") {
      sisyphusConfig.planner_enabled = sisyphusObj.planner_enabled;
    }

    if (typeof sisyphusObj.replace_plan === "boolean") {
      sisyphusConfig.replace_plan = sisyphusObj.replace_plan;
    }

    if (Object.keys(sisyphusConfig).length > 0) {
      result.sisyphus_agent = sisyphusConfig;
    }
  }

  // Validate git_master config
  if (
    obj.git_master &&
    typeof obj.git_master === "object" &&
    !Array.isArray(obj.git_master)
  ) {
    const gitObj = obj.git_master as Record<string, unknown>;
    const gitConfig: GitMasterConfig = {};

    if (typeof gitObj.commit_footer === "boolean") {
      gitConfig.commit_footer = gitObj.commit_footer;
    }

    if (typeof gitObj.include_co_authored_by === "boolean") {
      gitConfig.include_co_authored_by = gitObj.include_co_authored_by;
    }

    if (Object.keys(gitConfig).length > 0) {
      result.git_master = gitConfig;
    }
  }

   // Validate lsp config
   if (
     obj.lsp &&
     typeof obj.lsp === "object" &&
     !Array.isArray(obj.lsp)
   ) {
     const lspObj = obj.lsp as Record<string, unknown>;
     const lspConfig: Record<string, LspEntry> = {};

     for (const [key, value] of Object.entries(lspObj)) {
       if (!value || typeof value !== "object" || Array.isArray(value)) continue;
       const entryObj = value as Record<string, unknown>;

       // Validate required command field
       if (!Array.isArray(entryObj.command)) continue;
       const command = entryObj.command.filter((c): c is string => typeof c === "string");
       if (command.length === 0) continue;

       const entry: LspEntry = { command };

       // Validate optional extensions field
       if (Array.isArray(entryObj.extensions)) {
         const extensions = entryObj.extensions.filter((e): e is string => typeof e === "string");
         if (extensions.length > 0) {
           entry.extensions = extensions;
         }
       }

       lspConfig[key] = entry;
     }

     if (Object.keys(lspConfig).length > 0) {
       result.lsp = lspConfig;
     }
   }

   if (Array.isArray(obj.mcpServers)) {
     const mcpServers: McpEntry[] = [];
     for (const entry of obj.mcpServers) {
       if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
       const mcpObj = entry as Record<string, unknown>;

       if (typeof mcpObj.name !== "string" || !mcpObj.name) continue;
       const mcpType = mcpObj.type;

       if (mcpType === "local") {
         if (Array.isArray(mcpObj.command)) {
           const command = mcpObj.command.filter((c): c is string => typeof c === "string");
           if (command.length > 0) {
             mcpServers.push({
               name: mcpObj.name,
               type: "local",
               command,
             });
           }
         }
       } else if (mcpType === "remote") {
         if (typeof mcpObj.url === "string" && mcpObj.url) {
           mcpServers.push({
             name: mcpObj.name,
             type: "remote",
             url: mcpObj.url,
           });
         }
       }
     }
     if (mcpServers.length > 0) {
       result.mcpServers = mcpServers;
     }
   }

   // Validate customPlugins array
   if (Array.isArray(obj.customPlugins)) {
     const customPlugins: string[] = obj.customPlugins.filter(
       (v): v is string => typeof v === "string" && v.length > 0
     );
     if (customPlugins.length > 0) {
       result.customPlugins = customPlugins;
     }
   }

   // Validate configSchemaVersion number
   if (typeof obj.configSchemaVersion === "number" && obj.configSchemaVersion > 0) {
     result.configSchemaVersion = obj.configSchemaVersion;
   }

   return result;
 }

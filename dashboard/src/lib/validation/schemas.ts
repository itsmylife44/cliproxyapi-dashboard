import { z } from "zod";

// ============================================================================
// MODEL PREFERENCES
// ============================================================================

export const ModelPreferencesSchema = z.object({
  excludedModels: z
    .array(z.string().min(1).max(200))
    .max(500, "excludedModels array cannot exceed 500 items"),
});

export type ModelPreferencesInput = z.infer<typeof ModelPreferencesSchema>;

// ============================================================================
// CONTAINER ACTION
// ============================================================================

export const ContainerActionSchema = z.object({
  action: z.enum(["start", "stop", "restart"], {
    message: "Invalid action. Allowed: start, stop, restart",
  }),
  confirm: z.literal(true, {
    message: "Confirmation required: set confirm to true",
  }),
});

export type ContainerActionInput = z.infer<typeof ContainerActionSchema>;

// ============================================================================
// AGENT CONFIG
// ============================================================================

const AgentConfigEntrySchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  prompt_append: z.string().optional(),
});

const CategoryConfigEntrySchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  description: z.string().optional(),
});

const TmuxConfigSchema = z.object({
  enabled: z.boolean().optional(),
  layout: z.string().optional(),
  main_pane_size: z.number().optional(),
  main_pane_min_width: z.number().optional(),
  agent_pane_min_width: z.number().optional(),
});

const BackgroundTaskConfigSchema = z.object({
  defaultConcurrency: z.number().optional(),
  staleTimeoutMs: z.number().optional(),
  providerConcurrency: z.record(z.string(), z.number()).optional(),
  modelConcurrency: z.record(z.string(), z.number()).optional(),
});

const BrowserAutomationConfigSchema = z.object({
  provider: z.string().optional(),
});

const SisyphusAgentConfigSchema = z.object({
  disabled: z.boolean().optional(),
  default_builder_enabled: z.boolean().optional(),
  planner_enabled: z.boolean().optional(),
  replace_plan: z.boolean().optional(),
});

const GitMasterConfigSchema = z.object({
  commit_footer: z.boolean().optional(),
  include_co_authored_by: z.boolean().optional(),
});

const LspEntrySchema = z.object({
  command: z.array(z.string()).min(1),
  extensions: z.array(z.string()).optional(),
});

const LocalMcpEntrySchema = z.object({
  name: z.string().min(1),
  type: z.literal("local"),
  command: z.array(z.string()).min(1),
});

const RemoteMcpEntrySchema = z.object({
  name: z.string().min(1),
  type: z.literal("remote"),
  url: z.string().min(1),
});

const McpEntrySchema = z.union([LocalMcpEntrySchema, RemoteMcpEntrySchema]);

export const AgentConfigOverridesSchema = z.object({
  agents: z.record(z.string(), z.union([z.string(), AgentConfigEntrySchema])).optional(),
  categories: z.record(z.string(), z.union([z.string(), CategoryConfigEntrySchema])).optional(),
  disabled_agents: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),
  disabled_hooks: z.array(z.string()).optional(),
  disabled_commands: z.array(z.string()).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  tmux: TmuxConfigSchema.optional(),
  background_task: BackgroundTaskConfigSchema.optional(),
  browser_automation_engine: BrowserAutomationConfigSchema.optional(),
  sisyphus_agent: SisyphusAgentConfigSchema.optional(),
  git_master: GitMasterConfigSchema.optional(),
  lsp: z.record(z.string(), LspEntrySchema).optional(),
  mcpServers: z.array(McpEntrySchema).optional(),
  customPlugins: z.array(z.string()).optional(),
  configSchemaVersion: z.number().positive().optional(),
});

export const AgentConfigSchema = z.object({
  overrides: AgentConfigOverridesSchema,
});

export type AgentConfigInput = z.infer<typeof AgentConfigSchema>;

// ============================================================================
// ERROR RESPONSE HELPER
// ============================================================================

export function formatZodError(error: z.ZodError): { error: z.core.$ZodIssue[] } {
  return { error: error.issues };
}

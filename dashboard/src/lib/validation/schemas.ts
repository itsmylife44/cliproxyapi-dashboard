import { z } from "zod";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/auth/validation";

// ============================================================================
// MODEL PREFERENCES
// ============================================================================

export const ModelPreferencesSchema = z.object({
  excludedModels: z
    .array(z.string().min(1).max(200))
    .max(500, "excludedModels array cannot exceed 500 items"),
});

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

// ============================================================================
// AGENT CONFIG
// ============================================================================

const AgentConfigEntrySchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  prompt_append: z.string().optional(),
  fallback_models: z.array(z.string()).optional(),
  ultrawork: z.object({
    model: z.string().optional(),
    variant: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
});

const CategoryConfigEntrySchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  description: z.string().optional(),
  fallback_models: z.array(z.string()).optional(),
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

const ExperimentalConfigSchema = z.object({
  aggressive_truncation: z.boolean().optional(),
  task_system: z.boolean().optional(),
});

const LspEntrySchema = z.object({
  command: z.array(z.string()).min(1),
  extensions: z.array(z.string()).optional(),
});

const LocalMcpEntrySchema = z.object({
  name: z.string().min(1),
  type: z.literal("local"),
  command: z.array(z.string()).min(1),
  enabled: z.boolean().optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

const RemoteMcpEntrySchema = z.object({
  name: z.string().min(1),
  type: z.literal("remote"),
  url: z.string().min(1),
  enabled: z.boolean().optional(),
  environment: z.record(z.string(), z.string()).optional(),
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
  hashline_edit: z.boolean().optional(),
  experimental: ExperimentalConfigSchema.optional(),
});

export const AgentConfigSchema = z.object({
  overrides: AgentConfigOverridesSchema,
});

// ============================================================================
// SLIM AGENT CONFIG
// ============================================================================

const SlimAgentEntrySchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  variant: z.string().optional(),
  skills: z.array(z.string()).optional(),
  mcps: z.array(z.string()).optional(),
});

const SlimManualPlanEntrySchema = z.object({
  primary: z.string(),
  fallback1: z.string(),
  fallback2: z.string(),
  fallback3: z.string(),
});

const SlimFallbackSchema = z.object({
  enabled: z.boolean().optional(),
  timeoutMs: z.number().min(0).optional(),
  retryDelayMs: z.number().min(0).optional(),
  chains: z.record(z.string(), z.array(z.string()).min(1)).optional(),
});

const SlimTmuxSchema = z.object({
  enabled: z.boolean().optional(),
  layout: z.enum(["main-horizontal", "main-vertical", "tiled", "even-horizontal", "even-vertical"]).optional(),
  main_pane_size: z.number().min(20).max(80).optional(),
});

const SlimBackgroundSchema = z.object({
  maxConcurrentStarts: z.number().min(1).max(50).optional(),
});

const SlimConfigOverridesSchema = z.object({
  preset: z.string().optional(),
  setDefaultAgent: z.boolean().optional(),
  scoringEngineVersion: z.enum(["v1", "v2-shadow", "v2"]).optional(),
  balanceProviderUsage: z.boolean().optional(),
  manualPlan: z.record(z.string(), SlimManualPlanEntrySchema).optional(),
  agents: z.record(z.string(), SlimAgentEntrySchema).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  tmux: SlimTmuxSchema.optional(),
  background: SlimBackgroundSchema.optional(),
  fallback: SlimFallbackSchema.optional(),
});

export const SlimAgentConfigSchema = z.object({
  overrides: SlimConfigOverridesSchema,
});

// ============================================================================
// CUSTOM PROVIDERS
// ============================================================================

export const FetchModelsSchema = z.object({
  baseUrl: z.string().url("Base URL must be a valid URL (http:// or https://)"),
  apiKey: z.string().min(1)
});

export const CreateCustomProviderSchema = z.object({
  name: z.string().min(1).max(100),
  providerId: z.string().regex(/^[a-z0-9-]+$/, "Provider ID must be lowercase alphanumeric with hyphens"),
  baseUrl: z.string().url("Base URL must be a valid URL (http:// or https://)"),
  apiKey: z.string().min(1),
  prefix: z.string().optional(),
  proxyUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(z.object({
    upstreamName: z.string().min(1),
    alias: z.string().min(1)
  })).min(1, "At least one model mapping is required"),
  excludedModels: z.array(z.string()).optional()
});

// ============================================================================
// AUTH
// ============================================================================

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

// ============================================================================
// ADMIN SETTINGS
// ============================================================================

// Authoritative gate: only these keys can be written via PUT /api/admin/settings.
// Update this set when adding new systemSetting keys to the application.
const SETTINGS_ALLOWLIST = new Set([
  "max_provider_keys_per_user",
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_alerts_enabled",
  "telegram_alert_providers",
]);

export const AdminSettingSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(255)
    .refine((k) => SETTINGS_ALLOWLIST.has(k), {
      message: "Setting key is not allowed",
    }),
  value: z.string().min(1).max(1000),
});

export { SETTINGS_ALLOWLIST };

// ============================================================================
// RESTART / UPDATE
// ============================================================================

export const ConfirmActionSchema = z.object({
  confirm: z.literal(true, {
    message: "Confirmation required: set confirm to true",
  }),
});

const DOCKER_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

export const UpdateProxySchema = z.object({
  version: z
    .string()
    .default("latest")
    .refine((v) => v === "latest" || DOCKER_TAG_PATTERN.test(v), {
      message: "Invalid version format",
    }),
  confirm: z.literal(true, {
    message: "Confirmation required: set confirm to true",
  }),
});

// ============================================================================
// DEPLOY
// ============================================================================

export const DeploySchema = z.object({
  noCache: z.boolean().optional(),
});

// ============================================================================
// PROVIDER GROUPS
// ============================================================================

export const CreateProviderGroupSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const UpdateProviderGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const ReorderProviderGroupsSchema = z.object({
  groupIds: z.array(z.string()).min(1),
});

export const ReorderCustomProvidersSchema = z.object({
  providerIds: z.array(z.string()).min(1),
});

export const AssignProviderGroupSchema = z.object({
  groupId: z.string().nullable(),
});

export type AssignProviderGroupInput = z.infer<typeof AssignProviderGroupSchema>;

// ============================================================================
// OAUTH CREDENTIAL IMPORT
// ============================================================================

export const ImportOAuthCredentialSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  fileName: z.string().min(1, "File name is required").max(500),
  fileContent: z.string().min(2, "File content is required").max(1024 * 1024, "File content too large (max 1MB)"),
});

export type ImportOAuthCredentialInput = z.infer<typeof ImportOAuthCredentialSchema>;

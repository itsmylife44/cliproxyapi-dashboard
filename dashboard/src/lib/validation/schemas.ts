import { z } from "zod";

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
});

export const AgentConfigSchema = z.object({
  overrides: AgentConfigOverridesSchema,
});

// ============================================================================
// CUSTOM PROVIDERS
// ============================================================================

export const FetchModelsSchema = z.object({
  baseUrl: z.string().startsWith("https://", "Base URL must start with https://"),
  apiKey: z.string().min(1)
});

export const CreateCustomProviderSchema = z.object({
  name: z.string().min(1).max(100),
  providerId: z.string().regex(/^[a-z0-9-]+$/, "Provider ID must be lowercase alphanumeric with hyphens"),
  baseUrl: z.url().startsWith("https://", "Base URL must start with https://"),
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
  password: z.string().min(1)
});

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`).max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
});

// ============================================================================
// ERROR RESPONSE HELPER
// ============================================================================

export function formatZodError(error: z.ZodError): { error: z.core.$ZodIssue[] } {
  return { error: error.issues };
}

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

// ============================================================================
// ADMIN SETTINGS
// ============================================================================

const ALLOWED_SETTING_KEYS = [
  "max_provider_keys_per_user",
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_quota_threshold",
  "telegram_alerts_enabled",
  "telegram_last_alert_time",
  "telegram_alert_providers",
  "telegram_check_interval",
  "telegram_cooldown",
] as const;

export const UpdateSystemSettingSchema = z.object({
  key: z.enum(ALLOWED_SETTING_KEYS, { message: "Unknown setting key" }),
  value: z.string().min(1).max(1000),
});

// ============================================================================
// ADMIN DEPLOY
// ============================================================================

export const DeploySchema = z.object({
  noCache: z.boolean().optional(),
});

// ============================================================================
// ADMIN TELEGRAM
// ============================================================================

export const UpdateTelegramSettingsSchema = z.object({
  botToken: z.string().optional(),
  chatId: z.string().optional(),
  threshold: z.union([z.number().int().min(1).max(100), z.string()]).optional(),
  enabled: z.boolean().optional(),
  providers: z.array(z.string()).optional(),
  checkInterval: z.number().int().min(1).max(1440).optional(),
  cooldown: z.number().int().min(1).max(1440).optional(),
});

// ============================================================================
// CONFIG SYNC TOKEN UPDATE
// ============================================================================

export const UpdateSyncTokenSchema = z.object({
  syncApiKey: z.string().optional().nullable(),
});

// ============================================================================
// RESTART / CONFIRM ACTIONS
// ============================================================================

export const ConfirmActionSchema = z.object({
  confirm: z.literal(true, {
    message: "Confirmation required: set confirm to true",
  }),
});

// ============================================================================
// UPDATE PROXY
// ============================================================================

export const UpdateProxySchema = z.object({
  version: z.string().default("latest"),
  confirm: z.literal(true, {
    message: "Confirmation required: set confirm to true",
  }),
});

// ============================================================================
// UPDATE DASHBOARD
// ============================================================================

export const UpdateDashboardSchema = z.object({
  confirm: z.literal(true, {
    message: "Confirmation required: set confirm to true",
  }),
});

// ============================================================================
// USER API KEYS
// ============================================================================

export const CreateApiKeySchema = z.object({
  name: z.string().optional(),
});

// ============================================================================
// PROVIDER KEYS
// ============================================================================

export const ContributeKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
});

// ============================================================================
// OAUTH ACCOUNTS
// ============================================================================

export const ContributeOAuthSchema = z.object({
  provider: z.string().min(1),
  accountName: z.string().min(1),
  accountEmail: z.string().optional(),
});

export const ToggleOAuthSchema = z.object({
  disabled: z.boolean(),
});

// ============================================================================
// PERPLEXITY COOKIE
// ============================================================================

export const CreatePerplexityCookieSchema = z.object({
  cookieData: z.string().min(1),
  label: z.string().optional(),
});

export const DeletePerplexityCookieSchema = z.object({
  id: z.string().min(1),
});

// ============================================================================
// CONFIG SHARING - PUBLISH
// ============================================================================

export const CreatePublishSchema = z.object({
  name: z.string().optional(),
});

export const UpdatePublishSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// CONFIG SHARING - SUBSCRIBE
// ============================================================================

export const SubscribeSchema = z.object({
  shareCode: z.string().min(1),
});

export const UpdateSubscriptionSchema = z.object({
  isActive: z.boolean(),
});

// ============================================================================
// OAUTH CALLBACK
// ============================================================================

export const OAuthCallbackSchema = z.object({
  provider: z.string().min(1),
  callbackUrl: z.string().optional(),
  state: z.string().optional(),
});

// ============================================================================
// ADMIN USERS
// ============================================================================

export const CreateUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  isAdmin: z.boolean().optional(),
});

// ============================================================================
// USER CONFIG
// ============================================================================

const UserConfigMcpLocalSchema = z.object({
  name: z.string().min(1),
  type: z.literal("local"),
  command: z.array(z.string()).min(1),
  enabled: z.boolean().optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

const UserConfigMcpRemoteSchema = z.object({
  name: z.string().min(1),
  type: z.literal("remote"),
  url: z.string().min(1),
  enabled: z.boolean().optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

export const UserConfigSchema = z.object({
  mcpServers: z.array(z.union([UserConfigMcpLocalSchema, UserConfigMcpRemoteSchema])).optional(),
  customPlugins: z.array(z.string().min(1)).optional(),
});

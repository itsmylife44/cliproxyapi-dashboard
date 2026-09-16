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
  permission: z.object({
    edit: z.enum(["allow", "deny", "prompt"]).optional(),
    bash: z.union([
      z.enum(["allow", "deny", "prompt"]),
      z.object({
        git: z.enum(["allow", "deny", "prompt"]).optional(),
        test: z.enum(["allow", "deny", "prompt"]).optional(),
      }),
    ]).optional(),
  }).optional(),
  thinking: z.object({
    type: z.enum(["enabled", "disabled"]),
    budgetTokens: z.number().min(0).optional(),
  }).optional(),
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
   defaultModel: z.string().min(1).max(200).optional(),
   experimental: ExperimentalConfigSchema.optional(),
});

export const AgentConfigSchema = z.object({
  overrides: AgentConfigOverridesSchema,
});

// ============================================================================
// SLIM AGENT CONFIG
// ============================================================================

/**
 * Slim request validation.
 *
 * This is the API boundary only: it accepts both the CURRENT upstream schema
 * and the legacy shapes that older dashboard versions stored, then
 * `validateSlimConfig` migrates and normalises. Containers are `.passthrough()`
 * so fields the dashboard does not model survive the boundary instead of being
 * silently stripped.
 */
const SlimModelEntrySchema = z.object({
  id: z.string(),
  variant: z.string().optional(),
});

const SlimModelSchema = z.union([
  z.string(),
  z.array(z.union([z.string(), SlimModelEntrySchema])),
]);

const SlimPermissionValueSchema = z.enum(["ask", "allow", "deny"]);

const SlimPermissionSchema = z.union([
  SlimPermissionValueSchema,
  z.record(
    z.string(),
    z.union([
      SlimPermissionValueSchema,
      z.record(z.string(), SlimPermissionValueSchema),
    ]),
  ),
]);

const SlimAgentEntrySchema = z
  .object({
    model: SlimModelSchema.optional(),
    inheritModelFrom: z.enum(["session", "orchestrator"]).optional(),
    temperature: z.number().min(0).max(2).optional(),
    variant: z.string().optional(),
    skills: z.array(z.string()).optional(),
    skills_add: z.array(z.string()).optional(),
    skills_remove: z.array(z.string()).optional(),
    mcps: z.array(z.string()).optional(),
    prompt: z.string().optional(),
    orchestratorPrompt: z.string().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    displayName: z.string().optional(),
    color: z.string().optional(),
    description: z.string().optional(),
    permission: SlimPermissionSchema.optional(),
  })
  .passthrough();

const SlimFallbackSchema = z
  .object({
    enabled: z.boolean().optional(),
    maxRetries: z.number().int().min(0).optional(),
    initialRetryDelayMs: z.number().int().min(0).optional(),
    retryDelayMs: z.number().int().min(0).optional(),
    // Legacy keys stay accepted so stored configs can be re-submitted and
    // migrated rather than rejected.
    timeoutMs: z.number().min(0).optional(),
    retry_on_empty: z.boolean().optional(),
    runtimeOverride: z.boolean().optional(),
    chains: z.record(z.string(), z.array(z.string())).optional(),
  })
  .passthrough();

const SlimMultiplexerSchema = z
  .object({
    type: z
      .enum(["auto", "tmux", "zellij", "herdr", "kitty", "cmux", "none"])
      .optional(),
    layout: z
      .enum([
        "main-horizontal",
        "main-vertical",
        "tiled",
        "even-horizontal",
        "even-vertical",
      ])
      .optional(),
    main_pane_size: z.number().min(20).max(80).optional(),
    zellij_pane_mode: z.enum(["agent-tab", "current-tab"]).optional(),
  })
  .passthrough();

const SlimBackgroundJobsSchema = z
  .object({
    strategy: z.enum(["latest", "checkpoint-compatible"]).optional(),
    maxSessionsPerAgent: z.number().int().min(1).max(10).optional(),
    maxContextLines: z.number().int().min(0).optional(),
    readContextMinLines: z.number().int().min(0).optional(),
    readContextMaxFiles: z.number().int().min(0).optional(),
    maxRetainedSnapshots: z.number().int().min(1).max(100).optional(),
    wallClockTimeoutMs: z.number().min(0).optional(),
    abortGraceMs: z.number().int().min(1000).max(60000).optional(),
    waitForUserGuard: z.boolean().optional(),
    orchestratorWake: z
      .object({
        enabled: z.boolean().optional(),
        intervalMs: z.number().int().min(60000).optional(),
        mode: z.enum(["auto", "todo", "children"]).optional(),
      })
      .passthrough()
      .optional(),
    concurrency: z
      .object({
        defaultConcurrency: z.number().int().min(0).optional(),
        providerConcurrency: z.record(z.string(), z.number()).optional(),
        modelConcurrency: z.record(z.string(), z.number()).optional(),
      })
      .passthrough()
      .optional(),
    sameProviderPolicy: z.record(z.string(), z.literal("foreground")).optional(),
  })
  .passthrough();

const SlimCouncilSchema = z
  .object({
    // Current shape: presets.<preset>.<flatCouncillorName> = agent config.
    presets: z.record(z.string(), z.record(z.string(), SlimAgentEntrySchema)).optional(),
    default_preset: z.string().optional(),
  })
  .passthrough();

const SlimInterviewSchema = z
  .object({
    maxQuestions: z.number().min(1).max(10).optional(),
    outputFolder: z.string().optional(),
    autoOpenBrowser: z.boolean().optional(),
    port: z.number().min(0).max(65535).optional(),
    dashboard: z.boolean().optional(),
  })
  .passthrough();

const SlimCompanionSchema = z
  .object({
    enabled: z.boolean().optional(),
    binaryPath: z.string().optional(),
    position: z
      .enum(["bottom-right", "bottom-left", "top-right", "top-left"])
      .optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    gifPack: z.string().optional(),
    loopStyle: z.enum(["classic", "smooth"]).optional(),
    speed: z.number().min(0.25).max(4).optional(),
    debug: z.boolean().optional(),
  })
  .passthrough();

const SlimWebfetchSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: SlimModelSchema.optional(),
  })
  .passthrough();

const SlimAcpAgentSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    description: z.string().optional(),
    prompt: z.string().optional(),
    orchestratorPrompt: z.string().optional(),
    wrapperModel: z.string().optional(),
    timeoutMs: z.number().int().min(0).optional(),
    permissionMode: z.enum(["ask", "allow", "reject"]).optional(),
  })
  .passthrough();

const SlimConfigOverridesSchema = z
  .object({
    preset: z.string().optional(),
    presets: z.record(z.string(), z.record(z.string(), SlimAgentEntrySchema)).optional(),
    agents: z.record(z.string(), SlimAgentEntrySchema).optional(),

    setDefaultAgent: z.boolean().optional(),
    compactSidebar: z.boolean().optional(),
    stripOrchestratorModel: z.boolean().optional(),
    autoUpdate: z.boolean().optional(),
    image_routing: z.enum(["auto", "direct"]).optional(),

    disabled_agents: z.array(z.string()).optional(),
    disabled_mcps: z.array(z.string()).optional(),
    disabled_tools: z.array(z.string()).optional(),
    disabled_skills: z.array(z.string()).optional(),

    multiplexer: SlimMultiplexerSchema.optional(),
    backgroundJobs: SlimBackgroundJobsSchema.optional(),
    fallback: SlimFallbackSchema.optional(),
    council: SlimCouncilSchema.optional(),
    companion: SlimCompanionSchema.optional(),
    webfetch: SlimWebfetchSchema.optional(),
    acpAgents: z.record(z.string(), SlimAcpAgentSchema).optional(),
    interview: SlimInterviewSchema.optional(),
  })
  .passthrough();

export const SlimAgentConfigSchema = z.object({
  overrides: SlimConfigOverridesSchema,
});

// ============================================================================
// CUSTOM PROVIDERS
// ============================================================================

export const FetchModelsSchema = z.object({
  baseUrl: z.string().url("Base URL must be a valid URL (http:// or https://)"),
  apiKey: z.string().optional()
});

export const CreateCustomProviderSchema = z.object({
  name: z.string().min(1).max(100),
  providerId: z.string().regex(/^[a-z0-9-]+$/, "Provider ID must be lowercase alphanumeric with hyphens"),
  baseUrl: z.string().url("Base URL must be a valid URL (http:// or https://)"),
  apiKey: z.string().optional(),
  prefix: z.string().optional(),
  proxyUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(z.object({
    upstreamName: z.string().min(1),
    alias: z.string().min(1)
  })).min(1, "At least one model mapping is required"),
  excludedModels: z.array(z.string()).optional(),
  isShared: z.boolean().optional()
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

// ============================================================================
// BACKUP & RESTORE
// ============================================================================

// Note: Backup system uses dedicated types in lib/backup/types.ts
// and its own API routes at /api/admin/backup/schedule - not the general settings API.
// BackupScheduleSchema below is only used for basic input validation in the schedule API.

export const BackupScheduleSchema = z.object({
  enabled: z.boolean(),
  cronExpr: z.string().min(9).max(100).optional(),
  retention: z.number().min(1).max(365).optional(),
});

export type BackupScheduleInput = z.infer<typeof BackupScheduleSchema>;

import { z } from "zod";

// Slim objects that mirror the vendored upstream schema (config-generators/upstream/oh-my-opencode-slim.schema.json).
// `.passthrough()` where upstream allows extra keys, `.strict()` where it does not.
// Kept apart from ./schemas, which imports server-only code: oh-my-opencode-slim-types reaches the client bundle.

const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);
const MAX_INT32 = 2147483647;
const concurrencyCaps = z.record(z.string().min(1), boundedInt(0, 1000));

export const SlimModelEntrySchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    variant: z.string().optional(),
  }).passthrough()
]);

export const SlimBackgroundJobsSchema = z.object({
  strategy: z.enum(["latest", "checkpoint-compatible"]).optional(),
  maxSessionsPerAgent: boundedInt(1, 10).optional(),
  maxContextLines: boundedInt(0, 500000).optional(),
  readContextMinLines: boundedInt(0, 1000).optional(),
  readContextMaxFiles: boundedInt(0, 50).optional(),
  maxRetainedSnapshots: boundedInt(1, 100).optional(),
  orchestratorWake: z.object({
    enabled: z.boolean().optional(),
    intervalMs: boundedInt(60000, MAX_INT32).optional(),
    mode: z.enum(["auto", "todo", "children"]).optional(),
    periodicWakeEnabled: z.boolean().optional(),
    wakeOnTerminalPublication: z.boolean().optional(),
    publicationWakeMinIntervalMs: boundedInt(1000, MAX_INT32).optional(),
  }).passthrough().optional(),
  wallClockTimeoutMs: z.union([z.literal(0), boundedInt(60000, MAX_INT32)]).optional(),
  abortGraceMs: boundedInt(1000, 60000).optional(),
  stopConfirmationMs: boundedInt(1000, 60000).optional(),
  concurrency: z.object({
    defaultConcurrency: boundedInt(0, 1000).optional(),
    providerConcurrency: concurrencyCaps.optional(),
    modelConcurrency: concurrencyCaps.optional(),
  }).strict().optional(),
  sameProviderPolicy: z.record(z.string().min(1), z.literal("foreground")).optional(),
  waitForUserGuard: z.boolean().optional(),
  boardInjection: z.boolean().optional(),
  childInputWake: z.boolean().optional(),
  pruneEvictedSessions: z.boolean().optional(),
}).passthrough();

export const SlimCompanionSchema = z.object({
  enabled: z.boolean().optional(),
  binaryPath: z.string().min(1).optional(),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
  gifPack: z.enum(["default"]).optional(),
  loopStyle: z.enum(["classic", "smooth"]).optional(),
  speed: z.number().min(0.25).max(4).optional(),
  debug: z.boolean().optional(),
}).passthrough();

export const SlimWebfetchSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.union([z.string(), z.array(SlimModelEntrySchema).min(1)]).optional(),
}).strict();

export const SlimAcpAgentsSchema = z.record(z.string(), z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  orchestratorPrompt: z.string().min(1).optional(),
  wrapperModel: z.string().regex(/^[^/\s]+\/.+$/, "must be provider/model").optional(),
  timeoutMs: boundedInt(0, MAX_INT32).optional(),
  permissionMode: z.enum(["ask", "allow", "reject"]).optional(),
}).strict());

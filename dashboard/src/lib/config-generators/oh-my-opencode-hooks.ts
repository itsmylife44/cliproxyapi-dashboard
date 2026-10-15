/**
 * Oh-My-OpenCode hook names, grouped for the dashboard's hooks toggle UI.
 * Upstream source: packages/omo-opencode/src/config/schema/hooks.ts at OMO 5.1.33.
 */

/** All 56 OMO 5.1.33 hooks (`HookNameSchema`), grouped for the UI. */
export const HOOK_GROUPS = {
  context: [
    "compaction-context-injector",
    "compaction-todo-preserver",
    "preemptive-compaction",
  ],
  recovery: [
    "anthropic-context-window-limit-recovery",
    "edit-error-recovery",
    "json-error-recovery",
    "delegate-task-retry",
    "model-fallback",
    "runtime-fallback",
    "task-resume-info",
  ],
  notification: [
    "session-notification",
    "background-notification",
    "startup-toast",
    "auto-update-checker",
    "legacy-plugin-toast",
    "native-edition-nudge",
    "fsync-skip-warning",
  ],
  validation: [
    "comment-checker",
    "empty-task-response-detector",
    "tool-pair-validator",
    "plan-format-validator",
  ],
  guards: [
    "write-existing-file-guard",
    "notepad-write-guard",
    "bash-file-read-guard",
    "webfetch-redirect-guard",
    "stop-continuation-guard",
    "team-tool-gating",
    "no-sisyphus-gpt",
    "no-hephaestus-non-gpt",
  ],
  output: [
    "tool-output-truncator",
    "question-label-truncator",
    "hashline-read-enhancer",
    "read-image-resizer",
    "todo-description-override",
  ],
  injection: [
    "directory-agents-injector",
    "directory-readme-injector",
    "rules-injector",
    "hephaestus-agents-md-injector",
    "monitor-status-injector",
    "category-skill-reminder",
  ],
  automation: [
    "todo-continuation-enforcer",
    "keyword-detector",
    "agent-usage-reminder",
    "auto-slash-command",
    "goal",
    "ulw-execute",
    "unstable-agent-babysitter",
    "tasks-todowrite-disabler",
  ],
  environment: [
    "non-interactive-env",
    "interactive-bash-session",
    "think-mode",
    "claude-code-hooks",
    "ast-grep-sg-provision",
  ],
  planning: [
    "prometheus-md-only",
    "sisyphus-junior-notepad",
    "atlas",
  ],
} as const;

export type HookGroupName = keyof typeof HOOK_GROUPS;

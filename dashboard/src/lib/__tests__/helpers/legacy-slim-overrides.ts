/** Stored slim overrides from before slim 3.x: every key here is removed or ignored upstream. */
export const LEGACY_SLIM_OVERRIDES = {
  scoringEngineVersion: "v2",
  balanceProviderUsage: true,
  manualPlan: {
    orchestrator: { primary: "model-a", fallback1: "model-b", fallback2: "model-a", fallback3: "model-b" },
  },
  tmux: { enabled: true, layout: "main-horizontal", main_pane_size: 55 },
  background: { maxConcurrentStarts: 5 },
  todoContinuation: { maxContinuations: 10, autoEnable: true },
  websearch: { provider: "tavily" },
  fallback: { enabled: true, timeoutMs: 15000, retryDelayMs: 500, retry_on_empty: true },
  council: {
    master: { model: "model-a", variant: "high" },
    presets: {
      default: {
        councillors: { alpha: { model: "model-b" } },
        master: { variant: "balanced" },
      },
      "master-only": { councillors: {}, master: { model: "model-a" } },
    },
    default_preset: "default",
    master_timeout: 30000,
    councillors_timeout: 60000,
    master_fallback: ["model-b"],
    councillor_execution_mode: "serial",
    councillor_retries: 2,
  },
};

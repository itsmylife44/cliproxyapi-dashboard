import { describe, expect, it, vi } from "vitest";

import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { SlimAgentConfigSchema } from "../validation/schemas";
import { buildSlimConfigChecked } from "./helpers/slim-schema-guard";

vi.mock("server-only", () => ({}));

const available = ["model-a", "model-b"];

/** The 14 top-level keys slim added after 0.9.14. */
const NEW_TOP_LEVEL = {
  compactSidebar: false,
  stripOrchestratorModel: true,
  routingBlock: false,
  autoUpdate: false,
  image_routing: "direct",
  deepworkGuardMode: "enforce",
  disabled_tools: ["webfetch"],
  disabled_skills: ["reflect"],
  disabled_hooks: ["phase-reminder", "cache-monitor"],
  disabled_commands: ["loop"],
  backgroundJobs: { maxSessionsPerAgent: 2, waitForUserGuard: false },
  companion: { enabled: false, position: "top-left" },
  webfetch: { enabled: false },
  acpAgents: { gemini: { command: "gemini", args: ["--experimental-acp"] } },
};

/** The 10 per-agent fields slim added after 0.9.14. */
const NEW_AGENT_FIELDS = {
  inheritModelFrom: "session",
  skills_add: ["codemap"],
  skills_remove: ["simplify"],
  skills_include_local: true,
  prompt: "Be terse.",
  orchestratorPrompt: "Delegate reviews here.",
  displayName: "Advisor",
  color: "#ff8800",
  description: "Strategic advisor",
  permission: { edit: "ask", bash: { "git *": "allow", "*": "deny" } },
};

/** What the dashboard does with a PUT body: zod at the route, then the stored-config validator. */
function store(overrides: unknown) {
  return validateSlimConfig(JSON.parse(JSON.stringify(SlimAgentConfigSchema.parse({ overrides }).overrides)));
}

describe("slim 3.x fields survive the dashboard", () => {
  it("round-trips new top-level keys, per-agent fields and fallback.maxRetries", () => {
    const stored = store({
      ...NEW_TOP_LEVEL,
      fallback: { enabled: true, maxRetries: 5 },
      presets: { cliproxyapi: { oracle: { model: "model-a", ...NEW_AGENT_FIELDS } } },
      agents: { "code-reviewer": { model: "model-b", ...NEW_AGENT_FIELDS } },
    });

    const config = buildSlimConfigChecked(available, stored);

    expect(config).toMatchObject({
      ...NEW_TOP_LEVEL,
      fallback: { enabled: true, maxRetries: 5 },
      presets: { cliproxyapi: { oracle: { model: "cliproxyapi/model-a", ...NEW_AGENT_FIELDS } } },
      agents: { "code-reviewer": { model: "cliproxyapi/model-b", ...NEW_AGENT_FIELDS } },
    });
  });

  it("rejects an invalid agent inside an `agents` wrapper instead of silently emptying the preset", () => {
    expect(() => store({ presets: { review: { extends: "base", agents: { oracle: { model: "m", temperature: 5 } } } } }))
      .toThrow();
  });

  it("keeps fallback.maxRetries above the UI's usual range", () => {
    expect(buildSlimConfigChecked(available, store({ fallback: { maxRetries: 200 } }))?.fallback).toMatchObject({ maxRetries: 200 });
  });

  it("drops hook and command names slim does not know", () => {
    const config = buildSlimConfigChecked(available, store({
      disabled_hooks: ["phase-reminder", "ralph-loop"],
      disabled_commands: ["init-deep", "loop"],
    }));

    expect(config?.disabled_hooks).toEqual(["phase-reminder"]);
    expect(config?.disabled_commands).toEqual(["loop"]);
  });

  it("round-trips fully populated backgroundJobs, companion, webfetch and acpAgents unchanged", () => {
    const full = {
      backgroundJobs: {
        strategy: "checkpoint-compatible",
        maxSessionsPerAgent: 10,
        maxContextLines: 0,
        readContextMinLines: 10,
        readContextMaxFiles: 50,
        maxRetainedSnapshots: 100,
        orchestratorWake: {
          enabled: true,
          intervalMs: 60000,
          mode: "children",
          periodicWakeEnabled: false,
          wakeOnTerminalPublication: true,
          publicationWakeMinIntervalMs: 1000,
        },
        wallClockTimeoutMs: 0,
        abortGraceMs: 60000,
        stopConfirmationMs: 1000,
        concurrency: { defaultConcurrency: 4, providerConcurrency: { anthropic: 2 }, modelConcurrency: { "openai/gpt-5": 0 } },
        sameProviderPolicy: { anthropic: "foreground" },
        waitForUserGuard: false,
        boardInjection: false,
        childInputWake: false,
        pruneEvictedSessions: true,
      },
      companion: {
        enabled: true,
        binaryPath: "/usr/local/bin/companion",
        position: "bottom-left",
        size: "large",
        gifPack: "default",
        loopStyle: "smooth",
        speed: 0.25,
        debug: true,
      },
      webfetch: { enabled: true, model: ["model-a", { id: "model-b", variant: "high" }] },
      acpAgents: {
        gemini: {
          command: "gemini",
          args: ["--experimental-acp"],
          env: { GEMINI_API_KEY: "x" },
          cwd: "/work",
          description: "Gemini CLI",
          prompt: "Be terse.",
          orchestratorPrompt: "Use for research.",
          wrapperModel: "cliproxyapi/model-a",
          timeoutMs: 120000,
          permissionMode: "reject",
        },
      },
    };

    const config = buildSlimConfigChecked(available, store(full));

    expect({
      backgroundJobs: config?.backgroundJobs,
      companion: config?.companion,
      webfetch: config?.webfetch,
      acpAgents: config?.acpAgents,
    }).toEqual(full);
  });

  it("drops a stored object that no longer fits the upstream shape", () => {
    const config = buildSlimConfigChecked(available, validateSlimConfig({ companion: { speed: 9 }, webfetch: { enabled: false } }));

    expect(config?.companion).toBeUndefined();
    expect(config?.webfetch).toEqual({ enabled: false });
  });

  it.each([
    ["backgroundJobs", { strategy: "newest" }],
    ["backgroundJobs", { maxSessionsPerAgent: 11 }],
    ["backgroundJobs", { wallClockTimeoutMs: 1000 }],
    ["backgroundJobs", { concurrency: { defaultConcurrency: 1, perAgent: 2 } }],
    ["companion", { speed: 5 }],
    ["companion", { position: "center" }],
    ["companion", { enabled: "yes" }],
    ["webfetch", { model: [] }],
    ["webfetch", { model: [{ variant: "high" }] }],
    ["webfetch", { enabled: true, timeoutMs: 5000 }],
    ["acpAgents", { gemini: { args: ["--experimental-acp"] } }],
    ["acpAgents", { gemini: { command: "gemini", wrapperModel: "no-provider" } }],
    ["acpAgents", { gemini: { command: "gemini", shell: true } }],
    ["acpAgents", { gemini: "gemini" }],
  ])("rejects an invalid %s", (key, value) => {
    expect(() => store({ [key]: value })).toThrow();
  });

  it("parses an `agents`-wrapper preset as a preset of agents and keeps `extends`", () => {
    const stored = store({
      presets: {
        review: { extends: "cliproxyapi", agents: { oracle: { model: "model-b" }, "code-reviewer": { model: "model-a" } } },
        inline: { extends: "review", fixer: { temperature: 0.2 } },
      },
    });

    expect(stored.presets?.review).toEqual({
      extends: "cliproxyapi",
      agents: { oracle: { model: "model-b" }, "code-reviewer": { model: "model-a" } },
    });
    expect(stored.presets?.inline).toEqual({ extends: "review", agents: { fixer: { temperature: 0.2 } } });

    const config = buildSlimConfigChecked(available, stored) as { presets: Record<string, unknown> };

    // An extending preset only carries what it changes; the rest is inherited upstream.
    expect(config.presets.review).toEqual({
      extends: "cliproxyapi",
      oracle: { model: "cliproxyapi/model-b" },
      "code-reviewer": { model: "cliproxyapi/model-a" },
    });
    expect(config.presets.inline).toEqual({ extends: "review", fixer: { temperature: 0.2 } });
  });
});

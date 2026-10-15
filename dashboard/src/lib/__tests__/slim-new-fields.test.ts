import { describe, expect, it, vi } from "vitest";

import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { SlimAgentConfigSchema } from "../validation/schemas";
import { buildSlimConfig } from "./helpers/slim-schema-guard";

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

    const config = buildSlimConfig(available, stored);

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
    expect(buildSlimConfig(available, store({ fallback: { maxRetries: 200 } }))?.fallback).toMatchObject({ maxRetries: 200 });
  });

  it("drops hook and command names slim does not know", () => {
    const config = buildSlimConfig(available, store({
      disabled_hooks: ["phase-reminder", "ralph-loop"],
      disabled_commands: ["init-deep", "loop"],
    }));

    expect(config?.disabled_hooks).toEqual(["phase-reminder"]);
    expect(config?.disabled_commands).toEqual(["loop"]);
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
      oracle: { model: "model-b" },
      "code-reviewer": { model: "model-a" },
    });

    const config = buildSlimConfig(available, stored) as { presets: Record<string, unknown> };

    // An extending preset only carries what it changes; the rest is inherited upstream.
    expect(config.presets.review).toEqual({
      extends: "cliproxyapi",
      oracle: { model: "cliproxyapi/model-b" },
      "code-reviewer": { model: "cliproxyapi/model-a" },
    });
    expect(config.presets.inline).toEqual({ extends: "review", fixer: { temperature: 0.2 } });
  });
});

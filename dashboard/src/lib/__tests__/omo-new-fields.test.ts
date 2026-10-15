import { describe, expect, it, vi } from "vitest";

import { validateFullConfig } from "../config-generators/oh-my-opencode-types";
import { AgentConfigOverridesSchema } from "../validation/schemas";
import { buildOhMyOpenCodeConfig } from "./helpers/omo-schema-guard";

vi.mock("server-only", () => ({}));

const available = ["kimi-k3", "glm-5.2"];

/** The 12 top-level keys OMO added after 3.15.3. */
const NEW_TOP_LEVEL = {
  agent_order: ["oracle", "sisyphus"],
  agent_definitions: ["./agents/reviewer.md"],
  disabled_providers: ["openai"],
  telemetry: false,
  goal: { enabled: true, default_max_iterations: 20 },
  i18n: { locale: "de" },
  monitor: { enabled: true, allowed_commands: ["npm test"] },
  team_mode: { enabled: true, max_members: 4 },
  keyword_detector: { disabled_keywords: ["team"] },
  tui: { sidebar: { enabled: false } },
  ulw_execute: { auto_commit: false },
  default_mode: { ultrawork: true },
};

/** New fields inside sections the dashboard already had. */
const NEW_NESTED = {
  tmux: { isolation: "window" },
  browser_automation_engine: { provider: "playwright", playwright_mcp_args: ["--headless"] },
  sisyphus_agent: { tdd: false },
  background_task: { maxLiveDescendantsPerRoot: 3, taskCleanupDelayMs: 120000 },
  experimental: { disable_live_parent_wake_routing: true },
};

/** What the dashboard does with a PUT body: zod at the route, then the stored-config validator. */
function store(overrides: unknown) {
  return validateFullConfig(JSON.parse(JSON.stringify(AgentConfigOverridesSchema.parse(overrides))));
}

describe("OMO 5.x fields survive the dashboard", () => {
  it("round-trips the new top-level keys and the new fields of existing sections", () => {
    const config = buildOhMyOpenCodeConfig(available, store({ ...NEW_TOP_LEVEL, ...NEW_NESTED }));

    expect(config).toMatchObject({ ...NEW_TOP_LEVEL, ...NEW_NESTED });
  });

  it("round-trips the new agent and category entry fields", () => {
    const config = buildOhMyOpenCodeConfig(available, store({
      agents: { oracle: { displayName: "Advisor", permission: { webfetch: "deny", task: "ask", doom_loop: "deny", external_directory: "prompt" } } },
      categories: { quick: { max_tokens: 4096, provider_options: { store: false }, warn_unavailable: false } },
    }));

    expect(config?.agents).toMatchObject({
      oracle: { displayName: "Advisor", permission: { webfetch: "deny", task: "ask", doom_loop: "deny", external_directory: "ask" } },
    });
    expect(config?.categories).toMatchObject({
      quick: { max_tokens: 4096, provider_options: { store: false }, warn_unavailable: false },
    });
  });

  it("emits custom agents next to the built-in ones", () => {
    const config = buildOhMyOpenCodeConfig(available, store({
      agents: {
        reviewer: { model: "kimi-k3", fallback_models: ["glm-5.2"], displayName: "Reviewer", prompt_append: "Be strict." },
        writer: { model: "not-served", reasoning: "low" },
      },
    }));

    expect(config?.agents).toMatchObject({
      reviewer: { models: ["cliproxyapi/kimi-k3", "cliproxyapi/glm-5.2"], displayName: "Reviewer", prompt_append: "Be strict." },
      writer: { reasoning: "low" },
    });
    expect(config?.agents).not.toHaveProperty("writer.model");
    expect(config?.agents).toHaveProperty("sisyphus");
  });
});

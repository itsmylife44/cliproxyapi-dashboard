import { describe, expect, it } from "vitest";
import {
  SLIM_AGENTS,
  type OhMyOpenCodeSlimFullConfig,
  type SlimAgentConfig,
} from "../config-generators/oh-my-opencode-slim-types";
import { buildSlimConfigChecked } from "./helpers/slim-schema-guard";

type Agents = Record<string, SlimAgentConfig>;

function presetAgents(available: string[], overrides: OhMyOpenCodeSlimFullConfig): Agents {
  const config = buildSlimConfigChecked(available, overrides);
  expect(config).not.toBeNull();
  return (config as { presets: { cliproxyapi: Agents } }).presets.cliproxyapi;
}

// Upstream slim: a scalar `model` beats `inheritModelFrom`, so an inheriting agent must not get an auto-pick.
describe("buildSlimConfig – inheritModelFrom", () => {
  const available = ["model-a"];

  it.each(["session", "orchestrator"] as const)("emits no model for an agent inheriting from %s", (from) => {
    const { fixer } = presetAgents(available, { presets: { cliproxyapi: { fixer: { inheritModelFrom: from } } } });
    expect(fixer).toEqual({ inheritModelFrom: from });
  });

  it("keeps a user-set variant but drops the role's default variant", () => {
    const { orchestrator, oracle } = presetAgents(available, {
      presets: {
        cliproxyapi: {
          orchestrator: { inheritModelFrom: "session", variant: "max" },
          oracle: { inheritModelFrom: "orchestrator" },
        },
      },
    });
    expect(orchestrator).toEqual({ inheritModelFrom: "session", variant: "max" });
    expect(oracle).toEqual({ inheritModelFrom: "orchestrator" });
  });

  it("emits the fallback chain alone as the model, prefixed and deduped", () => {
    const { fixer } = presetAgents(available, {
      presets: { cliproxyapi: { fixer: { inheritModelFrom: "session" } } },
      fallback: { chains: { fixer: ["model-a", "external/x", "model-a"] } },
    });
    expect(fixer).toEqual({ inheritModelFrom: "session", model: ["cliproxyapi/model-a", "external/x"] });
  });

  it.each([
    ["disabled", { enabled: false, chains: { fixer: ["model-a"] } }],
    ["empty", { chains: { fixer: [] } }],
  ])("emits no model when the fallback chain is %s", (_, fallback) => {
    const { fixer } = presetAgents(available, {
      presets: { cliproxyapi: { fixer: { inheritModelFrom: "session" } } },
      fallback,
    });
    expect(fixer).toEqual({ inheritModelFrom: "session" });
  });

  it("keeps an explicit user model next to inheritModelFrom", () => {
    const { fixer } = presetAgents(available, {
      presets: { cliproxyapi: { fixer: { inheritModelFrom: "session", model: "model-a" } } },
    });
    expect(fixer).toEqual({ inheritModelFrom: "session", model: "cliproxyapi/model-a", variant: "low" });
  });

  it("builds a config with no available models when every primary agent inherits", () => {
    const inherit = { inheritModelFrom: "session" } as const;
    const agents = Object.fromEntries(SLIM_AGENTS.map((agent) => [agent, inherit]));
    expect(presetAgents([], { presets: { cliproxyapi: agents } }).oracle).toEqual(inherit);
    // The root-agents fallback merge used when no models are available
    expect(presetAgents([], { agents }).oracle).toEqual(inherit);
  });

  it("applies to the legacy agents output", () => {
    const inherit = { inheritModelFrom: "orchestrator" } as const;
    const config = buildSlimConfigChecked(
      [],
      {
        agents: Object.fromEntries(SLIM_AGENTS.map((agent) => [agent, inherit])),
        fallback: { chains: { fixer: ["model-a"] } },
      },
      { usePresets: false },
    );
    expect(config).not.toBeNull();
    const { fixer, oracle } = (config as { agents: Agents }).agents;
    expect(fixer).toEqual({ inheritModelFrom: "orchestrator", model: ["model-a"] });
    expect(oracle).toEqual({ inheritModelFrom: "orchestrator" });
  });
});

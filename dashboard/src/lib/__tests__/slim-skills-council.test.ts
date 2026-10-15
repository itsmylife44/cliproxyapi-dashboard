import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "./helpers/slim-schema-guard";
import { validateSlimConfig, type OhMyOpenCodeSlimFullConfig } from "../config-generators/oh-my-opencode-slim-types";
import { upstreamSchemaErrors } from "./helpers/upstream-schema";

const available = ["claude-opus-4-6", "gpt-5-mini"];

function generate(overrides?: OhMyOpenCodeSlimFullConfig): OhMyOpenCodeSlimFullConfig {
  const config = buildSlimConfig(available, overrides);
  expect(config).not.toBeNull();
  expect(upstreamSchemaErrors("slim", config)).toEqual([]);
  return config as OhMyOpenCodeSlimFullConfig;
}

describe("buildSlimConfig – skills and MCPs", () => {
  it("leaves skills and mcps to upstream defaults when the user set none", () => {
    const config = generate();
    const agents = Object.values(config.presets?.cliproxyapi ?? {});

    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) {
      expect(agent).not.toHaveProperty("skills");
      expect(agent).not.toHaveProperty("mcps");
    }
  });

  it("keeps skills and mcps the user set, translating names renamed upstream", () => {
    const config = generate({
      presets: {
        cliproxyapi: {
          orchestrator: { skills: ["*", "!cartography"], mcps: ["*", "!grep_app"] },
          librarian: { mcps: ["context7", "grep_app", "gh_grep"] },
          oracle: { skills: [] },
        },
      },
      agents: { designer: { skills: ["cartography", "simplify"] } },
    });

    const preset = config.presets?.cliproxyapi;
    expect(preset?.orchestrator?.skills).toEqual(["*", "!codemap"]);
    expect(preset?.orchestrator?.mcps).toEqual(["*", "!gh_grep"]);
    expect(preset?.librarian?.mcps).toEqual(["context7", "gh_grep"]);
    expect(preset?.oracle?.skills).toEqual([]);
    expect(config.agents?.designer?.skills).toEqual(["codemap", "simplify"]);
  });
});

describe("buildSlimConfig – council", () => {
  it("emits council presets without requiring a master", () => {
    const config = generate({
      council: {
        presets: { default: { councillors: { alpha: { model: "gpt-5-mini", variant: "high" } } } },
        default_preset: "default",
      },
    });

    expect(config.council).toEqual({
      presets: { default: { alpha: { model: "cliproxyapi/gpt-5-mini", variant: "high" } } },
      default_preset: "default",
    });
  });

  it("drops the council fields upstream removed", () => {
    const config = generate(validateSlimConfig({
      council: {
        master: { model: "claude-opus-4-6" },
        presets: {
          default: {
            councillors: { alpha: { model: "gpt-5-mini" } },
            master: { variant: "high" },
          },
        },
        master_timeout: 1000,
        councillors_timeout: 1000,
        master_fallback: ["gpt-5-mini"],
        councillor_execution_mode: "serial",
        councillor_retries: 2,
      },
    }));

    expect(config.council).toEqual({
      presets: { default: { alpha: { model: "cliproxyapi/gpt-5-mini" } } },
    });
  });

  it("drops the removed council-master agent from presets and root agents", () => {
    const config = generate({
      presets: { cliproxyapi: { "council-master": { model: "claude-opus-4-6" }, observer: { model: "gpt-5-mini" } } },
      agents: { "council-master": { model: "claude-opus-4-6" } },
    });

    expect(config.presets?.cliproxyapi).not.toHaveProperty("council-master");
    expect(config.presets?.cliproxyapi?.observer?.model).toBe("cliproxyapi/gpt-5-mini");
    expect(config).not.toHaveProperty("agents");
  });

  it("omits council when no preset has councillors", () => {
    const config = generate(validateSlimConfig({ council: { master: { model: "claude-opus-4-6" }, default_preset: "default" } }));

    expect(config).not.toHaveProperty("council");
  });
});

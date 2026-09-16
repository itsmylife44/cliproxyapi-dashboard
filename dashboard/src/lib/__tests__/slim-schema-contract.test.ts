import { describe, expect, it } from "vitest";

import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import {
  SLIM_AGENTS,
  SLIM_ALL_AGENT_NAMES,
  SLIM_BUNDLED_SKILLS,
  SLIM_DEFAULT_MCPS,
  SLIM_DEFAULT_SKILLS,
  SLIM_INTERNAL_AGENTS,
  SLIM_KNOWN_AGENT_KEYS,
  SLIM_KNOWN_TOP_LEVEL_KEYS,
  SLIM_MCP_NAMES,
  SLIM_OPTIONAL_AGENTS,
  SLIM_UPSTREAM,
  validateSlimConfig,
} from "../config-generators/oh-my-opencode-slim-types";
import contract from "../config-generators/__fixtures__/slim-stable-contract.json";

const AVAILABLE = ["model-a", "model-b", "model-c"];

function build(overrides?: Parameters<typeof buildSlimConfig>[1]) {
  const config = buildSlimConfig(AVAILABLE, overrides, { presetName: "cliproxyapi" });
  expect(config).not.toBeNull();
  return config as Record<string, unknown>;
}

describe("slim contract – provenance", () => {
  it("pins the same upstream version as the checked-in fixture", () => {
    expect(SLIM_UPSTREAM.stableVersion).toBe(contract.upstream.version);
    expect(SLIM_UPSTREAM.stableTag).toBe(contract.upstream.tag);
    expect(SLIM_UPSTREAM.stableCommit).toBe(contract.upstream.commit);
    expect(SLIM_UPSTREAM.verifiedAt).toBe(contract.upstream.derivedAt);
  });

  it("keeps the modelled top-level key set equal to the upstream schema", () => {
    expect([...SLIM_KNOWN_TOP_LEVEL_KEYS].sort()).toEqual(contract.topLevelKeys);
  });

  it("keeps the modelled agent key set equal to the upstream schema", () => {
    expect([...SLIM_KNOWN_AGENT_KEYS].sort()).toEqual(contract.agentKeys);
  });
});

describe("slim contract – generated configuration", () => {
  it("emits no top-level key that the upstream schema does not define", () => {
    const config = build();
    const allowed = new Set([...contract.topLevelKeys, "$schema"]);

    for (const key of Object.keys(config)) {
      expect(allowed.has(key), `unexpected top-level key: ${key}`).toBe(true);
    }
  });

  it("never emits a removed top-level key", () => {
    const config = build({
      scoringEngineVersion: "v2",
      balanceProviderUsage: true,
      manualPlan: { orchestrator: { primary: "a", fallback1: "b", fallback2: "c", fallback3: "d" } },
      todoContinuation: { maxContinuations: 5 },
      websearch: { provider: "exa" },
      background: { maxConcurrentStarts: 10 },
      tmux: { enabled: true },
    } as never);

    for (const key of contract.removedTopLevelKeys) {
      expect(config).not.toHaveProperty(key);
    }
  });

  it("emits only the supported fallback fields", () => {
    const config = build({ fallback: { enabled: true, maxRetries: 2 } });
    const fallback = config.fallback as Record<string, unknown>;

    for (const key of Object.keys(fallback)) {
      expect(contract.fallbackKeys).toContain(key);
    }
    for (const legacy of contract.legacyFallbackKeys) {
      expect(fallback).not.toHaveProperty(legacy);
    }
  });

  it("emits council with the required presets key and no removed sub-structure", () => {
    const config = build({
      council: { presets: { default: { alpha: { model: "model-a" } } } },
    });
    const council = config.council as Record<string, unknown>;

    for (const required of contract.councilRequired) {
      expect(council).toHaveProperty(required);
    }
    for (const key of Object.keys(council)) {
      expect(contract.councilKeys).toContain(key);
    }
    const defaultPreset = (council.presets as Record<string, Record<string, unknown>>).default;
    expect(defaultPreset).not.toHaveProperty("councillors");
    expect(defaultPreset).not.toHaveProperty("master");
  });

  it("emits agent configs using only upstream agent keys", () => {
    const config = build();
    const presets = config.presets as Record<string, Record<string, Record<string, unknown>>>;
    const allowed = new Set<string>(contract.agentKeys);

    for (const preset of Object.values(presets)) {
      for (const [agentName, agentConfig] of Object.entries(preset)) {
        for (const key of Object.keys(agentConfig)) {
          expect(allowed.has(key), `agent ${agentName} emitted unknown key ${key}`).toBe(true);
        }
      }
    }
  });

  it("uses only upstream multiplexer type values", () => {
    for (const type of contract.enums.multiplexerType) {
      const config = build({ multiplexer: { type: type as never } });
      const multiplexer = config.multiplexer as Record<string, unknown>;
      expect(contract.enums.multiplexerType).toContain(multiplexer.type);
    }
  });

  it("points $schema at the upstream schema document", () => {
    expect(build().$schema).toBe(SLIM_UPSTREAM.schemaUrl);
  });
});

describe("slim contract – agents, skills and MCPs", () => {
  it("auto-assigns exactly the seven grid agents", () => {
    const config = build();
    const presets = config.presets as Record<string, Record<string, unknown>>;

    expect(SLIM_AGENTS).toHaveLength(7);
    expect(Object.keys(presets.cliproxyapi!).sort()).toEqual([...SLIM_AGENTS].sort());
  });

  it("models observer as optional and councillor as internal", () => {
    expect(SLIM_OPTIONAL_AGENTS).toEqual(["observer"]);
    expect(SLIM_INTERNAL_AGENTS).toEqual(["councillor"]);
    expect(SLIM_ALL_AGENT_NAMES).toHaveLength(9);
  });

  it("never mentions council-master, agent-browser or cartography", () => {
    const serialized = JSON.stringify(build());
    expect(serialized).not.toContain("council-master");
    expect(serialized).not.toContain("agent-browser");
    expect(serialized).not.toContain("cartography");
  });

  it("exposes exactly the eight bundled upstream skills", () => {
    expect(SLIM_BUNDLED_SKILLS).toHaveLength(8);
    expect([...SLIM_BUNDLED_SKILLS].sort()).toEqual(
      [
        "clonedeps",
        "codemap",
        "deepwork",
        "oh-my-opencode-slim",
        "reflect",
        "simplify",
        "verification-planning",
        "worktrees",
      ].sort(),
    );
  });

  it("grants simplify to oracle and the orchestration skills to orchestrator", () => {
    // Mirrors upstream `getDefaultGrantedSkillNames`, which walks CUSTOM_SKILLS
    // then PERMISSION_ONLY_SKILLS and keeps entries whose `allowedAgents`
    // contains the agent.
    expect(SLIM_DEFAULT_SKILLS.oracle).toEqual(["simplify", "requesting-code-review"]);
    expect(SLIM_DEFAULT_SKILLS.orchestrator).toEqual([
      "codemap",
      "clonedeps",
      "deepwork",
      "verification-planning",
      "reflect",
      "oh-my-opencode-slim",
      "worktrees",
    ]);
    expect(SLIM_DEFAULT_SKILLS.designer).toEqual([]);
  });

  it("does not emit unknown agent-level keys, which the schema forbids", () => {
    // Upstream declares the per-agent object as additionalProperties: false.
    const config = build({
      agents: {
        observer: { model: "external/observer", futureAgentKey: "nope" } as never,
      },
      council: {
        presets: { default: { alpha: { model: "model-a", strayKey: 1 } as never } },
      },
    });

    const allowed = new Set<string>(contract.agentKeys);
    const presets = config.presets as Record<string, Record<string, Record<string, unknown>>>;
    const defaultCouncil = (config.council as Record<string, unknown>).presets as Record<
      string,
      Record<string, Record<string, unknown>>
    >;

    const agentConfigs = [
      ...Object.values(presets).flatMap((preset) => Object.values(preset)),
      ...Object.values(defaultCouncil.default!),
    ];

    for (const agentConfig of agentConfigs) {
      for (const key of Object.keys(agentConfig)) {
        expect(allowed.has(key), `emitted unknown agent key ${key}`).toBe(true);
      }
    }
  });

  it("uses the current upstream MCP ids and default assignments", () => {
    expect(SLIM_MCP_NAMES).toEqual(["context7", "gh_grep"]);
    expect(SLIM_DEFAULT_MCPS.orchestrator).toEqual(["*", "!context7"]);
    expect(SLIM_DEFAULT_MCPS.librarian).toEqual(["context7", "gh_grep"]);
  });
});

describe("slim contract – round-trip stability", () => {
  it("is stable when a generated config is re-validated and rebuilt", () => {
    const first = build({ council: { presets: { default: { alpha: { model: "model-a" } } } } });
    const revalidated = validateSlimConfig(first);
    const second = buildSlimConfig(AVAILABLE, revalidated, { presetName: "cliproxyapi" });

    expect(second).toEqual(first);
  });

  it("preserves unknown fields across a validate/generate round-trip", () => {
    const validated = validateSlimConfig({ futureKey: { deep: [1, 2] } });
    const rebuilt = buildSlimConfig(AVAILABLE, validated, { presetName: "cliproxyapi" });

    expect((rebuilt as Record<string, unknown>).futureKey).toEqual({ deep: [1, 2] });
  });
});

import { describe, expect, it, vi } from "vitest";

import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { SlimAgentConfigSchema } from "../validation/schemas";
import { buildSlimConfig } from "./helpers/slim-schema-guard";

vi.mock("server-only", () => ({}));

const available = ["model-a", "model-b"];

/** What the dashboard does with a PUT body: zod at the route, then the stored-config validator. */
function store(overrides: unknown) {
  return validateSlimConfig(JSON.parse(JSON.stringify(SlimAgentConfigSchema.parse({ overrides }).overrides)));
}

function rejectedByApi(overrides: unknown) {
  return !SlimAgentConfigSchema.safeParse({ overrides }).success;
}

describe("slim fallback retry options (#312)", () => {
  it("emits initialRetryDelayMs and continuationPolicy unchanged", () => {
    const config = buildSlimConfig(available, store({
      fallback: { enabled: true, initialRetryDelayMs: 1500, continuationPolicy: "stick-to-fallback" },
    }));

    expect(config?.fallback).toMatchObject({ initialRetryDelayMs: 1500, continuationPolicy: "stick-to-fallback" });
  });

  it("does not emit them when unset", () => {
    const fallback = buildSlimConfig(available, store({ fallback: { enabled: true } }))?.fallback;

    expect(fallback).not.toHaveProperty("initialRetryDelayMs");
    expect(fallback).not.toHaveProperty("continuationPolicy");
  });

  it("rejects a negative or fractional delay and an unknown policy at the API", () => {
    expect(rejectedByApi({ fallback: { initialRetryDelayMs: -1 } })).toBe(true);
    expect(rejectedByApi({ fallback: { initialRetryDelayMs: 1.5 } })).toBe(true);
    expect(rejectedByApi({ fallback: { continuationPolicy: "sometimes" } })).toBe(true);
  });

  it("drops out-of-schema stored values when parsing", () => {
    const stored = validateSlimConfig({
      fallback: { enabled: true, initialRetryDelayMs: -5, continuationPolicy: "sometimes" },
    });

    expect(stored.fallback).toEqual({ enabled: true });
  });
});

describe("slim multiplexer options (#312)", () => {
  it.each(["herdr", "kitty", "cmux-tui"])("accepts multiplexer type %s", (type) => {
    expect(buildSlimConfig(available, store({ multiplexer: { type } }))?.multiplexer).toMatchObject({ type });
  });

  it("emits cmux_tui_binary and viewer unchanged", () => {
    const config = buildSlimConfig(available, store({
      multiplexer: { type: "cmux-tui", cmux_tui_binary: "/opt/bin/cmux-tui", viewer: "mini" },
    }));

    expect(config?.multiplexer).toMatchObject({ type: "cmux-tui", cmux_tui_binary: "/opt/bin/cmux-tui", viewer: "mini" });
  });

  it("accepts a cmux_tui_binary longer than 1024 characters, as the upstream schema has no max length", () => {
    const binary = `/${"a".repeat(1100)}`;

    expect(buildSlimConfig(available, store({ multiplexer: { type: "cmux-tui", cmux_tui_binary: binary } }))?.multiplexer)
      .toMatchObject({ cmux_tui_binary: binary });
  });

  it("does not emit cmux_tui_binary or viewer when unset", () => {
    const multiplexer = buildSlimConfig(available, store({ multiplexer: { type: "tmux" } }))?.multiplexer;

    expect(multiplexer).not.toHaveProperty("cmux_tui_binary");
    expect(multiplexer).not.toHaveProperty("viewer");
  });

  it("rejects an unknown type, an empty binary and an unknown viewer at the API", () => {
    expect(rejectedByApi({ multiplexer: { type: "screen" } })).toBe(true);
    expect(rejectedByApi({ multiplexer: { cmux_tui_binary: "" } })).toBe(true);
    expect(rejectedByApi({ multiplexer: { viewer: "web" } })).toBe(true);
  });

  it("drops out-of-schema stored values when parsing", () => {
    const stored = validateSlimConfig({ multiplexer: { type: "kitty", cmux_tui_binary: "", viewer: "web" } });

    expect(stored.multiplexer).toEqual({ type: "kitty" });
  });
});

describe("slim interview.printState (#312)", () => {
  it("emits printState unchanged", () => {
    expect(buildSlimConfig(available, store({ interview: { printState: true } }))?.interview)
      .toMatchObject({ printState: true });
  });

  it("does not emit printState when unset", () => {
    expect(buildSlimConfig(available, store({ interview: { port: 0 } }))?.interview).not.toHaveProperty("printState");
  });

  it("rejects a non-boolean at the API and drops it when parsing", () => {
    expect(rejectedByApi({ interview: { printState: "yes" } })).toBe(true);
    expect(validateSlimConfig({ interview: { printState: "yes", port: 1 } }).interview).toEqual({ port: 1 });
  });
});

describe("slim preset marketplace (#312)", () => {
  const marketplace = {
    agents: ["acme/reviewer"],
    agents_add: ["acme/tester", "org.x/agent_1"],
    agents_remove: ["acme/legacy"],
  };

  it("emits marketplace in a flat dashboard-managed preset, not as an agent", () => {
    const stored = store({ presets: { cliproxyapi: { marketplace, oracle: { model: "model-a" } } } });
    const presets = buildSlimConfig(available, stored)?.presets as Record<string, Record<string, unknown>>;

    expect(presets.cliproxyapi?.marketplace).toEqual(marketplace);
    expect(presets.cliproxyapi?.oracle).toMatchObject({ model: "cliproxyapi/model-a" });
  });

  it("emits marketplace in an extending preset, from either the flat or the `agents` wrapper form", () => {
    const stored = store({
      presets: {
        flat: { extends: "cliproxyapi", marketplace: { agents_add: ["acme/tester"] } },
        wrapped: { extends: "cliproxyapi", marketplace: { agents_remove: ["acme/legacy"] }, agents: { fixer: { temperature: 0.1 } } },
      },
    });
    const presets = buildSlimConfig(available, stored)?.presets as Record<string, unknown>;

    expect(presets.flat).toEqual({ extends: "cliproxyapi", marketplace: { agents_add: ["acme/tester"] } });
    expect(presets.wrapped).toEqual({
      extends: "cliproxyapi",
      marketplace: { agents_remove: ["acme/legacy"] },
      fixer: { temperature: 0.1 },
    });
  });

  it("does not emit marketplace when unset", () => {
    const presets = buildSlimConfig(available, store({ presets: { cliproxyapi: { oracle: { model: "model-a" } } } }))
      ?.presets as Record<string, Record<string, unknown>>;

    expect(presets.cliproxyapi).not.toHaveProperty("marketplace");
  });

  it("rejects a bad package id at the API", () => {
    expect(rejectedByApi({ presets: { p: { marketplace: { agents: ["NoSlash"] } } } })).toBe(true);
    expect(rejectedByApi({ presets: { p: { marketplace: { agents_add: ["Acme/Upper"] } } } })).toBe(true);
    expect(rejectedByApi({ presets: { p: { extends: "x", agents: {}, marketplace: { agents_remove: ["a/b/c"] } } } })).toBe(true);
  });

  it("drops bad package ids when parsing a stored preset", () => {
    const stored = validateSlimConfig({
      presets: { p: { marketplace: { agents: ["acme/ok", "bad id"], agents_add: ["/x"], bogus: ["a/b"] } } },
    });

    expect(stored.presets?.p).toEqual({ marketplace: { agents: ["acme/ok"] } });
  });
});

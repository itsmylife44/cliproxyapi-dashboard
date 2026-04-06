import { describe, expect, it } from "vitest";

import { buildOhMyOpenCodeConfig } from "../config-generators/oh-my-opencode";
import { validateFullConfig } from "../config-generators/oh-my-opencode-types";

describe("oh-my-opencode config", () => {
  it("preserves ultrawork overrides when validating saved config", () => {
    const validated = validateFullConfig({
      agents: {
        sisyphus: {
          model: "k2p5",
          ultrawork: {
            model: "claude-opus-4.6",
            variant: "max",
            temperature: 0.7,
          },
        },
      },
    });

    expect(validated.agents?.sisyphus?.ultrawork).toEqual({
      model: "claude-opus-4.6",
      variant: "max",
      temperature: 0.7,
    });
  });

  it("preserves permission and thinking overrides when validating saved config", () => {
    const validated = validateFullConfig({
      agents: {
        hephaestus: {
          model: "gpt-5.4",
          permission: { edit: "allow", bash: { git: "allow", test: "allow" } },
        },
        oracle: {
          model: "gpt-5.4",
          thinking: { type: "enabled", budgetTokens: 120000 },
        },
      },
    });

    expect(validated.agents?.hephaestus?.permission).toEqual({
      edit: "allow",
      bash: { git: "allow", test: "allow" },
    });
    expect(validated.agents?.oracle?.thinking).toEqual({
      type: "enabled",
      budgetTokens: 120000,
    });
  });

  it("preserves advanced option overrides when validating saved config", () => {
    const validated = validateFullConfig({
      hashline_edit: true,
      experimental: {
        aggressive_truncation: true,
        task_system: true,
      },
    });

    expect(validated.hashline_edit).toBe(true);
    expect(validated.experimental).toEqual({
      aggressive_truncation: true,
      task_system: true,
    });
  });

  it("preserves explicit false advanced options and drops empty ultrawork", () => {
    const validated = validateFullConfig({
      agents: {
        sisyphus: {
          model: "k2p5",
          ultrawork: {},
        },
      },
      hashline_edit: false,
      experimental: {
        aggressive_truncation: false,
        task_system: false,
      },
    });

    expect(validated.agents?.sisyphus?.ultrawork).toBeUndefined();
    expect(validated.hashline_edit).toBe(false);
    expect(validated.experimental).toEqual({
      aggressive_truncation: false,
      task_system: false,
    });
  });

  it("emits ultrawork with cliproxyapi prefix and advanced options in generated config", () => {
    const config = buildOhMyOpenCodeConfig(["k2p5", "claude-opus-4.6"], {
      agents: {
        sisyphus: {
          model: "k2p5",
          ultrawork: {
            model: "claude-opus-4.6",
            variant: "max",
          },
        },
      },
      hashline_edit: true,
      experimental: {
        aggressive_truncation: true,
        task_system: true,
      },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { ultrawork?: { model?: string; variant?: string } }>;

    expect(agents.sisyphus.ultrawork).toEqual({
      model: "cliproxyapi/claude-opus-4.6",
      variant: "max",
    });
    expect(typedConfig.hashline_edit).toBe(true);
    expect(typedConfig.experimental).toEqual({
      aggressive_truncation: true,
      task_system: true,
    });
  });

  it("resolves models from fallback chains", () => {
    const config = buildOhMyOpenCodeConfig(["gpt-5-nano", "claude-haiku-4.5", "gemini-3-flash", "k2p5"]);
    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;
    const categories = typedConfig.categories as Record<string, { model: string; fallback_models?: string[] }>;

    // explore chain: grok-code-fast-1 → minimax-m2.7-highspeed → minimax-m2.7 → claude-haiku-4.5 → gpt-5-nano
    expect(agents.explore.model).toBe("cliproxyapi/claude-haiku-4.5");
    expect(agents.explore.fallback_models).toContain("cliproxyapi/gpt-5-nano");

    // librarian chain: minimax-m2.7 → minimax-m2.7-highspeed → claude-haiku-4.5 → gpt-5-nano
    expect(agents.librarian.model).toBe("cliproxyapi/claude-haiku-4.5");

    // quick category: gpt-5.4-mini → claude-haiku-4.5 → gemini-3-flash → minimax-m2.7 → gpt-5-nano
    expect(categories.quick.model).toBe("cliproxyapi/claude-haiku-4.5");
    expect(categories.quick.fallback_models).toContain("cliproxyapi/gemini-3-flash");

    // writing category: gemini-3-flash → kimi-k2.5 → claude-sonnet-4.6 → minimax-m2.7
    expect(categories.writing.model).toBe("cliproxyapi/gemini-3-flash");
  });

  it("auto-generates fallback_models from chain when no override", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6", "gpt-5.4", "glm-5", "k2p5"]);
    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;

    // sisyphus chain: claude-opus-4.6 → kimi-k2.5 → k2p5 → gpt-5.4 → glm-5 → big-pickle
    expect(agents.sisyphus.model).toBe("cliproxyapi/claude-opus-4.6");
    expect(agents.sisyphus.fallback_models).toContain("cliproxyapi/k2p5");
    expect(agents.sisyphus.fallback_models).toContain("cliproxyapi/gpt-5.4");
    expect(agents.sisyphus.fallback_models).toContain("cliproxyapi/glm-5");
  });

  it("returns null when no models available", () => {
    const config = buildOhMyOpenCodeConfig([]);
    expect(config).toBeNull();
  });
});

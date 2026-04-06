import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPreset, buildOhMyOpenCodeConfig } from "../config-generators/oh-my-opencode";
import type { OhMyOpenCodePreset } from "../config-generators/oh-my-opencode-types";
import { validateFullConfig } from "../config-generators/oh-my-opencode-types";

describe("oh-my-opencode config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("computes override fallback from override position, not chain start", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6", "k2p5", "gpt-5.4", "glm-5"], {
      agents: { sisyphus: { model: "k2p5" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;

    expect(agents.sisyphus.model).toBe("cliproxyapi/k2p5");
    expect(agents.sisyphus.fallback_models).toContain("cliproxyapi/gpt-5.4");
    expect(agents.sisyphus.fallback_models).toContain("cliproxyapi/glm-5");
    expect(agents.sisyphus.fallback_models).not.toContain("cliproxyapi/claude-opus-4.6");
    expect(agents.sisyphus.fallback_models).not.toContain("cliproxyapi/k2p5");
  });

  it("computes category override fallback from override position", () => {
    const config = buildOhMyOpenCodeConfig(["gemini-3.1-pro", "glm-5", "claude-opus-4.6", "k2p5"], {
      categories: { "visual-engineering": { model: "glm-5" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const categories = typedConfig.categories as Record<string, { model: string; fallback_models?: string[] }>;

    expect(categories["visual-engineering"].model).toBe("cliproxyapi/glm-5");
    expect(categories["visual-engineering"].fallback_models).toContain("cliproxyapi/claude-opus-4.6");
    expect(categories["visual-engineering"].fallback_models).toContain("cliproxyapi/k2p5");
    expect(categories["visual-engineering"].fallback_models).not.toContain("cliproxyapi/gemini-3.1-pro");
  });

  it("uses no fallbacks when override model is not in chain", () => {
    const config = buildOhMyOpenCodeConfig(["big-pickle", "gpt-5.4"], {
      agents: { sisyphus: { model: "big-pickle" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;

    expect(agents.sisyphus.model).toBe("cliproxyapi/big-pickle");
    expect(agents.sisyphus.fallback_models).toBeUndefined();
  });

  it("drops ultrawork.model when ultrawork model is not available", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6"], {
      agents: {
        sisyphus: {
          model: "claude-opus-4.6",
          ultrawork: { model: "gpt-5.4", variant: "max" },
        },
      },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { ultrawork?: { model?: string; variant?: string } }>;

    expect(agents.sisyphus.ultrawork).toBeDefined();
    expect(agents.sisyphus.ultrawork?.model).toBeUndefined();
    expect(agents.sisyphus.ultrawork?.variant).toBe("max");
  });

  it("prefixes ultrawork.model when ultrawork model is available", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6", "gpt-5.4"], {
      agents: {
        sisyphus: {
          model: "claude-opus-4.6",
          ultrawork: { model: "gpt-5.4", variant: "max" },
        },
      },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { ultrawork?: { model?: string; variant?: string } }>;

    expect(agents.sisyphus.ultrawork?.model).toBe("cliproxyapi/gpt-5.4");
    expect(agents.sisyphus.ultrawork?.variant).toBe("max");
  });

  it("applyPreset does not create empty concurrency objects", () => {
    const preset: OhMyOpenCodePreset = {
      name: "simple",
      description: "Simple preset",
      config: { agents: { sisyphus: { model: "claude-opus-4.6" } } },
    };

    const result = applyPreset(preset, undefined);

    expect(result.background_task?.providerConcurrency).toBeUndefined();
    expect(result.background_task?.modelConcurrency).toBeUndefined();
  });

  it("applyPreset merges concurrency from existing and preset config", () => {
    const preset: OhMyOpenCodePreset = {
      name: "concurrent",
      description: "Concurrent preset",
      config: {
        background_task: {
          providerConcurrency: { anthropic: 3 },
        },
      },
    };

    const result = applyPreset(preset, {
      background_task: { providerConcurrency: { openai: 2 } },
    });

    expect(result.background_task?.providerConcurrency?.anthropic).toBe(3);
    expect(result.background_task?.providerConcurrency?.openai).toBe(2);
  });

  it("uses schema URL from main branch", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6"]);

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    expect(typedConfig.$schema).toEqual(expect.stringContaining("/main/"));
    expect(typedConfig.$schema).not.toEqual(expect.stringContaining("/dev/"));
  });
});

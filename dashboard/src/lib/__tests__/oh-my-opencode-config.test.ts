import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPreset, buildOhMyOpenCodeConfig, getMissingPresetModels } from "../config-generators/oh-my-opencode";
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
    const sisyphus = agents.sisyphus;

    expect(sisyphus).toBeDefined();
    expect(sisyphus!.ultrawork).toEqual({
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
    const explore = agents.explore;
    expect(explore).toBeDefined();
    expect(explore!.model).toBe("cliproxyapi/claude-haiku-4.5");
    expect(explore!.fallback_models).toContain("cliproxyapi/gpt-5-nano");

    // librarian chain: minimax-m2.7 → minimax-m2.7-highspeed → claude-haiku-4.5 → gpt-5-nano
    const librarian = agents.librarian;
    expect(librarian).toBeDefined();
    expect(librarian!.model).toBe("cliproxyapi/claude-haiku-4.5");

    // quick category: gpt-5.4-mini → claude-haiku-4.5 → gemini-3-flash → minimax-m2.7 → gpt-5-nano
    const quick = categories.quick;
    expect(quick).toBeDefined();
    expect(quick!.model).toBe("cliproxyapi/claude-haiku-4.5");
    expect(quick!.fallback_models).toContain("cliproxyapi/gemini-3-flash");

    // writing category: gemini-3-flash → kimi-k2.5 → claude-sonnet-4.6 → minimax-m2.7
    const writing = categories.writing;
    expect(writing).toBeDefined();
    expect(writing!.model).toBe("cliproxyapi/gemini-3-flash");
  });

  it("auto-generates fallback_models from chain when no override", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6", "gpt-5.4", "glm-5", "k2p5"]);
    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;
    const sisyphus = agents.sisyphus;

    // sisyphus chain: claude-opus-4.6 → kimi-k2.5 → k2p5 → gpt-5.4 → glm-5 → big-pickle
    expect(sisyphus).toBeDefined();
    expect(sisyphus!.model).toBe("cliproxyapi/claude-opus-4.6");
    expect(sisyphus!.fallback_models).toContain("cliproxyapi/k2p5");
    expect(sisyphus!.fallback_models).toContain("cliproxyapi/gpt-5.4");
    expect(sisyphus!.fallback_models).toContain("cliproxyapi/glm-5");

  });

  it("returns null when no models available", () => {
    const config = buildOhMyOpenCodeConfig([]);
    expect(config).not.toBeNull(); // After fix: always returns config with agents using chain[0] as placeholder
  });

  it("computes override fallback from override position, not chain start", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6", "k2p5", "gpt-5.4", "glm-5"], {
      agents: { sisyphus: { model: "k2p5" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;
    const sisyphus = agents.sisyphus;

    expect(sisyphus).toBeDefined();
    expect(sisyphus!.model).toBe("cliproxyapi/k2p5");
    expect(sisyphus!.fallback_models).toContain("cliproxyapi/gpt-5.4");
    expect(sisyphus!.fallback_models).toContain("cliproxyapi/glm-5");
    expect(sisyphus!.fallback_models).not.toContain("cliproxyapi/claude-opus-4.6");
    expect(sisyphus!.fallback_models).not.toContain("cliproxyapi/k2p5");
  });

  it("computes category override fallback from override position", () => {
    const config = buildOhMyOpenCodeConfig(["gemini-3.1-pro", "glm-5", "claude-opus-4.6", "k2p5"], {
      categories: { "visual-engineering": { model: "glm-5" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const categories = typedConfig.categories as Record<string, { model: string; fallback_models?: string[] }>;
    const visualEngineering = categories["visual-engineering"];

    expect(visualEngineering).toBeDefined();
    expect(visualEngineering!.model).toBe("cliproxyapi/glm-5");
    expect(visualEngineering!.fallback_models).toContain("cliproxyapi/claude-opus-4.6");
    expect(visualEngineering!.fallback_models).toContain("cliproxyapi/k2p5");
    expect(visualEngineering!.fallback_models).not.toContain("cliproxyapi/gemini-3.1-pro");
  });

  it("uses no fallbacks when override model is not in chain", () => {
    const config = buildOhMyOpenCodeConfig(["big-pickle", "gpt-5.4"], {
      agents: { sisyphus: { model: "big-pickle" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { model: string; fallback_models?: string[] }>;
    const sisyphus = agents.sisyphus;

    expect(sisyphus).toBeDefined();
    expect(sisyphus!.model).toBe("cliproxyapi/big-pickle");
    expect(sisyphus!.fallback_models).toBeUndefined();
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
    const sisyphus = agents.sisyphus;
    const ultrawork = sisyphus?.ultrawork;

    expect(sisyphus).toBeDefined();
    expect(ultrawork).toBeDefined();
    expect(ultrawork!.model).toBeUndefined();
    expect(ultrawork!.variant).toBe("max");
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
    const sisyphus = agents.sisyphus;
    const ultrawork = sisyphus?.ultrawork;

    expect(sisyphus).toBeDefined();
    expect(ultrawork).toBeDefined();
    expect(ultrawork!.model).toBe("cliproxyapi/gpt-5.4");
    expect(ultrawork!.variant).toBe("max");
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

  describe("agent/category skipping when models unavailable", () => {
    it("includes agent even when no chain model is available", () => {
      const config = buildOhMyOpenCodeConfig(["some-unknown-model-xyz"], {
        agents: { sisyphus: { model: "gpt-5.4" } },
      });

      // The override model (gpt-5.4) is not in availableModels
      // The chain for sisyphus: ["claude-opus-4.6", "kimi-k2.5", "k2p5", "gpt-5.4", "glm-5", "big-pickle"]
      // None of these are in ["some-unknown-model-xyz"], so resolveChain() returns null
      // Currently: agents.sisyphus is skipped (continue executed)
      // After fix: agents.sisyphus should be present
      expect(config).not.toBeNull();
      const typedConfig = config as Record<string, unknown>;
      const agents = typedConfig.agents as Record<string, unknown>;
      expect(agents.sisyphus).toBeDefined();
    });

    it("includes all agents even when all override models have no chain match", () => {
      const config = buildOhMyOpenCodeConfig(["some-unknown-model-xyz"], {});

      // No models from any chain are available
      // Currently: returns null (0 agents resolved)
      // After fix: result should NOT be null — all agents from UPSTREAM_AGENT_CHAINS should be present
      expect(config).not.toBeNull();
      const typedConfig = config as Record<string, unknown>;
      const agents = typedConfig.agents as Record<string, unknown>;
      expect(Object.keys(agents).length).toBeGreaterThan(0);
    });

    it("includes category even when no chain model is available", () => {
      const config = buildOhMyOpenCodeConfig(["some-unknown-model-xyz"], {
        categories: { "visual-engineering": { model: "gemini-3.1-pro" } },
      });

      // The override model is not in available models; chain has no match
      // Currently: category omitted
      // After fix: categories["visual-engineering"] exists
      expect(config).not.toBeNull();
      const typedConfig = config as Record<string, unknown>;
      const categories = typedConfig.categories as Record<string, unknown>;
      expect(categories["visual-engineering"]).toBeDefined();
    });

    it("uses chain-resolved model when override is unavailable but chain has match", () => {
      const config = buildOhMyOpenCodeConfig(["k2p5"], {
        agents: { sisyphus: { model: "gpt-5.4" } },
      });

      // Override (gpt-5.4) not in available; but k2p5 IS in sisyphus chain
      // Expected: agents.sisyphus.model equals "cliproxyapi/k2p5" (chain fallback used)
      // This tests EXISTING behavior — should PASS both before and after the fix
      expect(config).not.toBeNull();
      const typedConfig = config as Record<string, unknown>;
      const agents = typedConfig.agents as Record<string, { model: string }>;
      const sisyphus = agents.sisyphus;
      expect(sisyphus).toBeDefined();
      expect(sisyphus!.model).toBe("cliproxyapi/k2p5");
    });
  });

  describe("getMissingPresetModels", () => {
    it("returns empty array when all preset models available", () => {
      const preset: OhMyOpenCodePreset = {
        name: "test",
        description: "test",
        config: {
          agents: { sisyphus: { model: "claude-opus-4.6" }, oracle: { model: "gpt-5.4" } },
          categories: { "visual-engineering": { model: "gemini-3.1-pro" } },
        },
      };
      const result = getMissingPresetModels(preset, ["claude-opus-4.6", "gpt-5.4", "gemini-3.1-pro"]);
      expect(result).toEqual([]);
    });

    it("returns missing models for agents and categories", () => {
      const preset: OhMyOpenCodePreset = {
        name: "test",
        description: "test",
        config: {
          agents: { sisyphus: { model: "claude-opus-4.6" }, oracle: { model: "gpt-missing-1" } },
          categories: { "visual-engineering": { model: "gemini-missing-1" } },
        },
      };
      const result = getMissingPresetModels(preset, ["claude-opus-4.6"]);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.model)).toContain("gpt-missing-1");
      expect(result.map(r => r.model)).toContain("gemini-missing-1");
    });

    it("handles preset with no agent overrides", () => {
      const preset: OhMyOpenCodePreset = {
        name: "test",
        description: "test",
        config: {},
      };
      const result = getMissingPresetModels(preset, ["claude-opus-4.6"]);
      expect(result).toEqual([]);
    });

    it("handles empty available models list", () => {
      const preset: OhMyOpenCodePreset = {
        name: "test",
        description: "test",
        config: {
          agents: { sisyphus: { model: "claude-opus-4.6" } },
          categories: { quick: { model: "gpt-5-nano" } },
        },
      };
      const result = getMissingPresetModels(preset, []);
      expect(result).toHaveLength(2);
    });

    it("ignores agent entries without a model override", () => {
      const preset: OhMyOpenCodePreset = {
        name: "test",
        description: "test",
        config: {
          agents: { sisyphus: { model: "claude-opus-4.6" }, prometheus: {} }, // prometheus has no model
          categories: {},
        },
      };
      const result = getMissingPresetModels(preset, []);
      // Only sisyphus.model is "missing", prometheus has no model to check
      expect(result).toHaveLength(1);
      const [missingModel] = result;
      expect(missingModel).toBeDefined();
      expect(missingModel!.model).toBe("claude-opus-4.6");
    });
  });
});

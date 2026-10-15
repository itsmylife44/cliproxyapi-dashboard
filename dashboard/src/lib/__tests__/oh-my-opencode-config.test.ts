import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPreset, buildOhMyOpenCodeConfig, getMissingPresetModels } from "../config-generators/oh-my-opencode";
import type { OhMyOpenCodePreset } from "../config-generators/oh-my-opencode-types";
import { validateFullConfig } from "../config-generators/oh-my-opencode-types";
import { AgentConfigOverridesSchema } from "../validation/schemas";
import { deprecatedOmoKeys } from "./helpers/upstream-schema";

vi.mock("server-only", () => ({}));

describe("oh-my-opencode config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a stored ultrawork variant as reasoning and drops its temperature", () => {
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
      reasoning: "max",
    });
  });

  it("preserves permission overrides and moves stored thinking under providerOptions", () => {
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
    expect(validated.agents?.oracle?.providerOptions).toEqual({
      thinking: { type: "enabled", budgetTokens: 120000 },
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
            reasoning: "max",
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
    const agents = typedConfig.agents as Record<string, { ultrawork?: { model?: string; reasoning?: string } }>;
    const sisyphus = agents.sisyphus;

    expect(sisyphus).toBeDefined();
    expect(sisyphus!.ultrawork).toEqual({
      model: "cliproxyapi/claude-opus-4.6",
      reasoning: "max",
    });
    expect(typedConfig.hashline_edit).toBe(true);
    expect(typedConfig.experimental).toEqual({
      aggressive_truncation: true,
      task_system: true,
    });
  });

  it("resolves models from the 5.1.33 chains, skipping models the proxy doesn't serve", () => {
    const config = buildOhMyOpenCodeConfig(["claude-haiku-5-5", "deepseek-flash", "minimax-m2.7", "claude-opus-4-6"]);
    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, unknown>;
    const categories = typedConfig.categories as Record<string, unknown>;

    // explore/librarian: kimi-for-coding-highspeed → gpt-6-luna-fast → claude-haiku-5-5 → deepseek-flash → qwen3.7-plus → minimax-m2.7
    for (const agent of ["explore", "librarian"]) {
      expect(agents[agent]).toEqual({
        models: ["cliproxyapi/claude-haiku-5-5", "cliproxyapi/deepseek-flash", "cliproxyapi/minimax-m2.7"],
      });
    }

    // quick: gpt-6-luna-fast → claude-haiku-5-5 → deepseek-flash → qwen3.6-flash → minimax-m3 → minimax-m2.7 → …
    expect(categories.quick).toEqual({
      models: ["cliproxyapi/claude-haiku-5-5", "cliproxyapi/deepseek-flash", "cliproxyapi/minimax-m2.7"],
    });

    // writing is Claude-only: claude-opus-5-5 → claude-opus-4-6
    expect(categories.writing).toEqual({ model: "cliproxyapi/claude-opus-4-6" });
  });

  it("auto-generates the models chain when no override", () => {
    const config = buildOhMyOpenCodeConfig(["kimi-k3", "gpt-5.6-sol", "glm-5.2", "claude-opus-4.6"]);
    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, unknown>;

    // sisyphus: claude-opus-5-5 → kimi-k3 → gpt-5.6-sol → glm-5.2 → big-pickle
    expect(agents.sisyphus).toEqual({
      models: ["cliproxyapi/kimi-k3", "cliproxyapi/gpt-5.6-sol", "cliproxyapi/glm-5.2"],
    });
  });

  it("emits the deep-low and deep-high categories with their 5.1.33 chains, never deep", () => {
    const config = buildOhMyOpenCodeConfig(["gpt-6.1-sol-fast", "gpt-5.6-sol", "gpt-6-astra"]);
    const categories = (config as Record<string, unknown>).categories as Record<string, unknown>;

    // deep-low: gpt-6.1-sol → gpt-6.1-sol-fast → gpt-5.6-sol → gpt-5.6-sol-fast
    expect(categories["deep-low"]).toEqual({
      models: ["cliproxyapi/gpt-6.1-sol-fast", "cliproxyapi/gpt-5.6-sol"],
    });
    // deep-high: gpt-6-astra
    expect(categories["deep-high"]).toEqual({ model: "cliproxyapi/gpt-6-astra" });
    expect(categories).not.toHaveProperty("deep");
  });

  it("emits a stored deep category as deep-low", () => {
    const config = buildOhMyOpenCodeConfig(["gpt-6.1-sol", "gpt-5.6-sol"], {
      categories: { deep: { model: "gpt-5.6-sol", temperature: 0.3 } },
    });
    const categories = (config as Record<string, unknown>).categories as Record<string, unknown>;

    expect(categories["deep-low"]).toEqual({ model: "cliproxyapi/gpt-5.6-sol", temperature: 0.3 });
    expect(categories).not.toHaveProperty("deep");
  });

  it("prefers a stored deep-low over a stored legacy deep", () => {
    const config = buildOhMyOpenCodeConfig(["gpt-6.1-sol", "gpt-5.6-sol"], {
      categories: { deep: { model: "gpt-6.1-sol" }, "deep-low": { model: "gpt-5.6-sol" } },
    });
    const categories = (config as Record<string, unknown>).categories as Record<string, { model: string }>;

    expect(categories["deep-low"]?.model).toBe("cliproxyapi/gpt-5.6-sol");
  });

  it("maps a stored deep category to deep-low when validating saved config", () => {
    const validated = validateFullConfig({ categories: { deep: { model: "gpt-5.6-sol" }, quick: "gpt-6-luna-fast" } });

    expect(validated.categories).toEqual({
      "deep-low": { model: "gpt-5.6-sol" },
      quick: { model: "gpt-6-luna-fast" },
    });
  });

  it("drops values removed in OMO 5.x from saved config and keeps valid ones", () => {
    const validated = validateFullConfig({
      disabled_commands: ["init-deep", "start-work", "hyperplan"],
      disabled_skills: ["agent-browser", "frontend-ui-ux", "playwright"],
      disabled_hooks: ["context-window-monitor", "session-recovery", "thinking-block-validator",
        "grep-output-truncator", "ralph-loop", "start-work", "comment-checker"],
      browser_automation_engine: { provider: "agent-browser" },
      lsp: { typescript: { command: ["typescript-language-server", "--stdio"] } },
    });

    expect(validated).toEqual({
      disabled_commands: ["hyperplan"],
      disabled_skills: ["playwright"],
      disabled_hooks: ["comment-checker"],
    });
  });

  it("reads a stored prompt permission as ask", () => {
    const validated = validateFullConfig({
      agents: { oracle: { permission: { edit: "prompt", bash: { git: "prompt", test: "deny" } } } },
      categories: {},
    });

    expect(validated.agents?.oracle?.permission).toEqual({ edit: "ask", bash: { git: "ask", test: "deny" } });
    expect(validateFullConfig({ agents: { oracle: { permission: { bash: "prompt" } } } }).agents?.oracle?.permission)
      .toEqual({ bash: "ask" });
  });

  it("honours a deep-high model override", () => {
    const config = buildOhMyOpenCodeConfig(["gpt-6-astra", "gpt-5.6-sol"], {
      categories: { "deep-high": { model: "gpt-5.6-sol" } },
    });
    const categories = (config as Record<string, unknown>).categories as Record<string, { model: string }>;

    expect(categories["deep-high"]?.model).toBe("cliproxyapi/gpt-5.6-sol");
  });

  it("returns null when no models available", () => {
    const config = buildOhMyOpenCodeConfig([]);
    expect(config).not.toBeNull(); // After fix: always returns config with agents using chain[0] as placeholder
  });

  it("computes override fallback from override position, not chain start", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-5-5", "kimi-k3", "gpt-5.6-sol", "glm-5.2"], {
      agents: { sisyphus: { model: "kimi-k3" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, unknown>;

    expect(agents.sisyphus).toEqual({
      models: ["cliproxyapi/kimi-k3", "cliproxyapi/gpt-5.6-sol", "cliproxyapi/glm-5.2"],
    });
  });

  it("computes category override fallback from override position", () => {
    const config = buildOhMyOpenCodeConfig(["claude-fable-5-1", "claude-opus-5-5", "kimi-k3"], {
      categories: { "visual-engineering": { model: "claude-opus-5-5" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const categories = typedConfig.categories as Record<string, unknown>;

    expect(categories["visual-engineering"]).toEqual({
      models: ["cliproxyapi/claude-opus-5-5", "cliproxyapi/kimi-k3"],
    });
  });

  it("uses no fallbacks when override model is not in chain", () => {
    const config = buildOhMyOpenCodeConfig(["big-pickle", "gpt-5.4"], {
      agents: { sisyphus: { model: "big-pickle" } },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, unknown>;

    expect(agents.sisyphus).toEqual({ model: "cliproxyapi/big-pickle" });
  });

  it("drops ultrawork.model when ultrawork model is not available", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6"], {
      agents: {
        sisyphus: {
          model: "claude-opus-4.6",
          ultrawork: { model: "gpt-5.4", reasoning: "max" },
        },
      },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { ultrawork?: { model?: string; reasoning?: string } }>;
    const sisyphus = agents.sisyphus;
    const ultrawork = sisyphus?.ultrawork;

    expect(sisyphus).toBeDefined();
    expect(ultrawork).toBeDefined();
    expect(ultrawork!.model).toBeUndefined();
    expect(ultrawork!.reasoning).toBe("max");
  });

  it("prefixes ultrawork.model when ultrawork model is available", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6", "gpt-5.4"], {
      agents: {
        sisyphus: {
          model: "claude-opus-4.6",
          ultrawork: { model: "gpt-5.4", reasoning: "max" },
        },
      },
    });

    expect(config).not.toBeNull();
    const typedConfig = config as Record<string, unknown>;
    const agents = typedConfig.agents as Record<string, { ultrawork?: { model?: string; reasoning?: string } }>;
    const sisyphus = agents.sisyphus;
    const ultrawork = sisyphus?.ultrawork;

    expect(sisyphus).toBeDefined();
    expect(ultrawork).toBeDefined();
    expect(ultrawork!.model).toBe("cliproxyapi/gpt-5.4");
    expect(ultrawork!.reasoning).toBe("max");
  });

  describe("deprecated fields translated to reasoning/models/providerOptions", () => {
    const AVAILABLE = ["kimi-k3", "gpt-5.6-sol", "glm-5.2", "claude-opus-5-5", "gpt-6-astra"];

    it("reads a stored variant as reasoning, with an explicit reasoning winning", () => {
      const validated = validateFullConfig({
        agents: { sisyphus: { variant: "max" }, oracle: { variant: "max", reasoning: "low" } },
        categories: { quick: { variant: "high" } },
      });

      expect(validated.agents?.sisyphus).toEqual({ reasoning: "max" });
      expect(validated.agents?.oracle).toEqual({ reasoning: "low" });
      expect(validated.categories?.quick).toEqual({ reasoning: "high" });
    });

    it("keeps reasoning and providerOptions through the save schema", () => {
      const saved = {
        agents: {
          oracle: { reasoning: "high", providerOptions: { thinking: { type: "enabled" } }, ultrawork: { reasoning: "max" } },
        },
        categories: { quick: { reasoning: "low" } },
      };

      expect(validateFullConfig(AgentConfigOverridesSchema.parse(saved))).toEqual(saved);
    });

    it("reads a disabled stored thinking as reasoning off", () => {
      const validated = validateFullConfig({ agents: { oracle: { thinking: { type: "disabled" } } } });

      expect(validated.agents?.oracle).toEqual({ reasoning: "off" });
    });

    it("puts reasoning and temperature on the primary rung of the models chain", () => {
      const config = buildOhMyOpenCodeConfig(AVAILABLE, validateFullConfig({
        agents: { sisyphus: { model: "kimi-k3", variant: "max", temperature: 0.7 } },
      }));
      const agents = (config as Record<string, unknown>).agents as Record<string, unknown>;

      expect(agents.sisyphus).toEqual({
        models: [
          { model: "cliproxyapi/kimi-k3", reasoning: "max", temperature: 0.7 },
          "cliproxyapi/gpt-5.6-sol",
          "cliproxyapi/glm-5.2",
        ],
      });
    });

    it("emits reasoning next to model when there are no fallbacks", () => {
      const config = buildOhMyOpenCodeConfig(["big-pickle"], validateFullConfig({
        agents: { sisyphus: { model: "big-pickle", variant: "high" } },
      }));
      const agents = (config as Record<string, unknown>).agents as Record<string, unknown>;

      expect(agents.sisyphus).toEqual({ model: "cliproxyapi/big-pickle", reasoning: "high" });
    });

    it("turns stored fallback_models into the tail of the models chain", () => {
      const config = buildOhMyOpenCodeConfig(AVAILABLE, validateFullConfig({
        agents: { oracle: { model: "claude-opus-5-5", fallback_models: ["glm-5.2", "not-served"] } },
      }));
      const agents = (config as Record<string, unknown>).agents as Record<string, unknown>;

      expect(agents.oracle).toEqual({ models: ["cliproxyapi/claude-opus-5-5", "cliproxyapi/glm-5.2"] });
    });

    it("emits a stored enabled thinking as providerOptions.thinking", () => {
      const config = buildOhMyOpenCodeConfig(["big-pickle"], validateFullConfig({
        agents: { oracle: { model: "big-pickle", thinking: { type: "enabled", budgetTokens: 32000 } } },
      }));
      const agents = (config as Record<string, unknown>).agents as Record<string, unknown>;

      expect(agents.oracle).toEqual({
        model: "cliproxyapi/big-pickle",
        providerOptions: { thinking: { type: "enabled", budgetTokens: 32000 } },
      });
    });

    it("keeps a category temperature on the entry and its reasoning on the primary rung", () => {
      const config = buildOhMyOpenCodeConfig(AVAILABLE, validateFullConfig({
        categories: { "visual-engineering": { model: "claude-opus-5-5", variant: "high", temperature: 0.4 } },
      }));
      const categories = (config as Record<string, unknown>).categories as Record<string, unknown>;

      expect(categories["visual-engineering"]).toEqual({
        models: [{ model: "cliproxyapi/claude-opus-5-5", reasoning: "high" }, "cliproxyapi/kimi-k3"],
        temperature: 0.4,
      });
    });

    it("never emits variant, fallback_models or thinking", () => {
      const config = buildOhMyOpenCodeConfig(AVAILABLE, validateFullConfig({
        agents: {
          sisyphus: {
            model: "kimi-k3",
            variant: "max",
            fallback_models: ["glm-5.2"],
            thinking: { type: "enabled", budgetTokens: 1000 },
            ultrawork: { model: "gpt-6-astra", variant: "xhigh", temperature: 0.2 },
          },
        },
        categories: { quick: { model: "glm-5.2", variant: "low", fallback_models: ["kimi-k3"] } },
      }));

      expect(deprecatedOmoKeys(config)).toEqual([]);
    });
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

  it("uses the schema URL of the pinned upstream tag", () => {
    const config = buildOhMyOpenCodeConfig(["claude-opus-4.6"]);

    expect(config).not.toBeNull();
    expect(config?.$schema).toBe(
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/v5.1.33/assets/oh-my-opencode.schema.json",
    );
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
      const config = buildOhMyOpenCodeConfig(["kimi-k3"], {
        agents: { sisyphus: { model: "gpt-5.4" } },
      });

      // Override (gpt-5.4) not in available; but kimi-k3 IS in sisyphus chain
      // Expected: agents.sisyphus.model equals "cliproxyapi/kimi-k3" (chain fallback used)
      // This tests EXISTING behavior — should PASS both before and after the fix
      expect(config).not.toBeNull();
      const typedConfig = config as Record<string, unknown>;
      const agents = typedConfig.agents as Record<string, { model: string }>;
      const sisyphus = agents.sisyphus;
      expect(sisyphus).toBeDefined();
      expect(sisyphus!.model).toBe("cliproxyapi/kimi-k3");
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

import { describe, expect, it } from "vitest";

import { buildOhMyOpenCodeConfig } from "../config-generators/oh-my-opencode";
import { validateFullConfig } from "../config-generators/oh-my-opencode-types";

describe("oh-my-opencode config", () => {
  it("preserves ultrawork overrides when validating saved config", () => {
    const validated = validateFullConfig({
      agents: {
        sisyphus: {
          model: "kimi-for-coding/k2p5",
          ultrawork: {
            model: "anthropic/claude-opus-4-6",
            variant: "max",
            temperature: 0.7,
          },
        },
      },
    });

    expect(validated.agents?.sisyphus?.ultrawork).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
      temperature: 0.7,
    });
  });

  it("preserves permission and thinking overrides when validating saved config", () => {
    const validated = validateFullConfig({
      agents: {
        hephaestus: {
          model: "openai/gpt-5.4",
          permission: { edit: "allow", bash: { git: "allow", test: "allow" } },
        },
        oracle: {
          model: "openai/gpt-5.4",
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
          model: "kimi-for-coding/k2p5",
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

  it("emits ultrawork and advanced options in generated config", () => {
    const config = buildOhMyOpenCodeConfig(["kimi-for-coding/k2p5", "anthropic/claude-opus-4-6"], {
      agents: {
        sisyphus: {
          model: "kimi-for-coding/k2p5",
          ultrawork: {
            model: "anthropic/claude-opus-4-6",
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
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    });
    expect(typedConfig.hashline_edit).toBe(true);
    expect(typedConfig.experimental).toEqual({
      aggressive_truncation: true,
      task_system: true,
    });
  });
});

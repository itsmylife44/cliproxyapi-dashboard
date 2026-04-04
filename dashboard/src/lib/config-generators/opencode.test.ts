import { afterEach, describe, expect, it, vi } from "vitest";
import { generateConfigJson, getProxyUrl, type ModelDefinition } from "./opencode";

const models: Record<string, ModelDefinition> = {
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    context: 1000,
    output: 100,
    attachment: true,
    reasoning: true,
    modalities: { input: ["text"], output: ["text"] },
  },
  "claude-opus-4.1": {
    name: "Claude Opus 4.1",
    context: 1000,
    output: 100,
    attachment: true,
    reasoning: true,
    modalities: { input: ["text"], output: ["text"] },
  },
};

describe("generateConfigJson", () => {
  it("uses the manually provided model string as-is", () => {
    const configJson = generateConfigJson("sk-test", models, "https://proxy.example", {
      defaultModel: "cliproxyapi/claude-opus-4.1",
    });

    const parsed = JSON.parse(configJson) as { model: string };

    expect(parsed.model).toBe("cliproxyapi/claude-opus-4.1");
  });

  it("falls back to the first available cliproxyapi model when blank", () => {
    const configJson = generateConfigJson("sk-test", models, "https://proxy.example", {
      defaultModel: "   ",
    });

    const parsed = JSON.parse(configJson) as { model: string };

    expect(parsed.model).toBe("cliproxyapi/gemini-2.5-pro");
  });

  it("uses the fallback cliproxyapi prefix when no default model is provided", () => {
    const configJson = generateConfigJson("sk-test", models, "https://proxy.example");

    const parsed = JSON.parse(configJson) as { model: string };

    expect(parsed.model).toBe("cliproxyapi/gemini-2.5-pro");
  });
});

describe("getProxyUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses API_URL when provided", () => {
    vi.stubEnv("API_URL", "http://localhost:8317");
    vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "http://localhost:28317/v0/management");

    expect(getProxyUrl()).toBe("http://localhost:8317");
  });

  it("falls back to the management URL origin when API_URL is missing", () => {
    vi.stubEnv("API_URL", "");
    vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "http://localhost:8317/v0/management");

    expect(getProxyUrl()).toBe("http://localhost:8317");
  });
});

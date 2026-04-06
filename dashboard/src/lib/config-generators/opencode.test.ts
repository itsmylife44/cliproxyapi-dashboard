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

  it("includes permission configuration when provided", () => {
    const configJson = generateConfigJson("sk-test", models, "https://proxy.example", {
      permission: {
        edit: "allow",
        bash: {
          git: "allow",
          test: "allow",
        },
      },
    });

    const parsed = JSON.parse(configJson) as { permission: { edit: string; bash: { git: string; test: string } } };

    expect(parsed.permission).toEqual({
      edit: "allow",
      bash: {
        git: "allow",
        test: "allow",
      },
    });
  });

  it("excludes permission field when not provided", () => {
    const configJson = generateConfigJson("sk-test", models, "https://proxy.example");

    const parsed = JSON.parse(configJson) as Record<string, unknown>;

    expect(parsed.permission).toBeUndefined();
  });
});

describe("getProxyUrl", () => {
  const originalApiUrl = process.env.API_URL;
  const originalMgmtUrl = process.env.CLIPROXYAPI_MANAGEMENT_URL;

  afterEach(() => {
    // Restore env vars manually (Bun 1.3.7 does not support vi.stubEnv)
    if (originalApiUrl === undefined) {
      delete process.env.API_URL;
    } else {
      process.env.API_URL = originalApiUrl;
    }
    if (originalMgmtUrl === undefined) {
      delete process.env.CLIPROXYAPI_MANAGEMENT_URL;
    } else {
      process.env.CLIPROXYAPI_MANAGEMENT_URL = originalMgmtUrl;
    }
  });

  it("uses API_URL when provided", () => {
    process.env.API_URL = "http://localhost:8317";
    process.env.CLIPROXYAPI_MANAGEMENT_URL = "http://localhost:28317/v0/management";

    expect(getProxyUrl()).toBe("http://localhost:8317");
  });

  it("falls back to the management URL origin when API_URL is missing", () => {
    delete process.env.API_URL;
    process.env.CLIPROXYAPI_MANAGEMENT_URL = "http://localhost:8317/v0/management";

    expect(getProxyUrl()).toBe("http://localhost:8317");
  });
});

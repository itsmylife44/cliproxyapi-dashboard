import { describe, expect, it } from "vitest";
import { planConfigSave } from "@/lib/config-save-plan";

const original = {
  "proxy-url": "",
  debug: false,
  "request-retry": 3,
  "max-retry-credentials": 0,
  "quota-exceeded": { "switch-project": false, "switch-preview-model": false },
  routing: { strategy: "round-robin" },
  streaming: { "keepalive-seconds": 0, "bootstrap-retries": 0 },
  "oauth-model-alias": { codex: [{ name: "gpt-5", alias: "a" }] },
};

describe("planConfigSave", () => {
  it("plans nothing when nothing changed", () => {
    expect(planConfigSave(original, structuredClone(original))).toEqual([]);
  });

  it("sends a single changed endpoint field to its dedicated endpoint only", () => {
    expect(planConfigSave(original, { ...original, debug: true })).toEqual([
      { kind: "endpoint", endpoint: "/api/management/debug", body: { value: true } },
    ]);
  });

  it("sends a single changed nested field to its dedicated endpoint", () => {
    expect(planConfigSave(original, { ...original, routing: { strategy: "fill-first" } })).toEqual([
      { kind: "endpoint", endpoint: "/api/management/routing/strategy", body: { value: "fill-first" } },
    ]);
  });

  it("sends oauth-model-alias alone with the raw provider map as body", () => {
    const aliases = { codex: [{ name: "gpt-5", alias: "b" }] };
    expect(planConfigSave(original, { ...original, "oauth-model-alias": aliases })).toEqual([
      { kind: "endpoint", endpoint: "/api/management/oauth-model-alias", body: aliases },
    ]);
  });

  it("writes a single merge-only field through one config.yaml merge", () => {
    const streaming = { "keepalive-seconds": 15, "bootstrap-retries": 0 };
    expect(planConfigSave(original, { ...original, streaming })).toEqual([
      { kind: "yaml", changes: { streaming } },
    ]);
  });

  it("writes nonstream-keepalive-interval as a root key, not inside streaming", () => {
    expect(planConfigSave(original, { ...original, "nonstream-keepalive-interval": 30 })).toEqual([
      { kind: "yaml", changes: { "nonstream-keepalive-interval": 30 } },
    ]);
  });

  it("folds two endpoint fields into one config.yaml write instead of back-to-back PUTs", () => {
    expect(planConfigSave(original, { ...original, debug: true, "request-retry": 5 })).toEqual([
      { kind: "yaml", changes: { debug: true, "request-retry": 5 } },
    ]);
  });

  it("carries endpoint, nested and merge-only changes together in one config.yaml write", () => {
    const current = {
      ...original,
      "max-retry-credentials": 7,
      "quota-exceeded": { "switch-project": true, "switch-preview-model": false },
      "oauth-model-alias": { codex: [{ name: "gpt-5", alias: "b" }] },
      streaming: { "keepalive-seconds": 42, "bootstrap-retries": 0 },
    };
    expect(planConfigSave(original, current)).toEqual([
      {
        kind: "yaml",
        changes: {
          "max-retry-credentials": 7,
          "quota-exceeded": { "switch-project": true },
          "oauth-model-alias": { codex: [{ name: "gpt-5", alias: "b" }] },
          streaming: { "keepalive-seconds": 42, "bootstrap-retries": 0 },
        },
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { resolveInheritedModel } from "../config-generators/oh-my-opencode-slim";
import { buildSlimConfigChecked } from "./helpers/slim-schema-guard";

const available = ["model-a"];

describe("resolveInheritedModel", () => {
  it("returns the parent preset's primary model for an agent the child does not set", () => {
    const config = buildSlimConfigChecked(available, {
      preset: "review",
      presets: { base: { agents: {} }, review: { extends: "base", agents: { fixer: { temperature: 0.2 } } } },
      fallback: { chains: { oracle: ["external/x"] } },
    });

    expect(resolveInheritedModel(config!, "review", "oracle")).toBe("cliproxyapi/model-a");
    expect(resolveInheritedModel(config!, "review", "fixer")).toBe("cliproxyapi/model-a");
  });

  it("emits the default preset when another preset extends it, even if it was never stored", () => {
    const config = buildSlimConfigChecked(available, {
      preset: "review",
      presets: { review: { extends: "cliproxyapi", agents: {} } },
    });

    expect(Object.keys(config!.presets as object).sort()).toEqual(["cliproxyapi", "review"]);
    expect(resolveInheritedModel(config!, "review", "oracle")).toBe("cliproxyapi/model-a");
  });

  it("stops at the nearest ancestor that sets the model", () => {
    const config = buildSlimConfigChecked(available, {
      preset: "leaf",
      presets: {
        base: { agents: {} },
        mid: { extends: "base", agents: { oracle: { model: "external/mid" } } },
        leaf: { extends: "mid", agents: {} },
      },
    });

    expect(resolveInheritedModel(config!, "leaf", "oracle")).toBe("external/mid");
  });

  it("returns undefined when the parent is not in the generated config", () => {
    const config = buildSlimConfigChecked(available, {
      preset: "review",
      presets: { review: { extends: "project-only", agents: {} } },
    });

    expect(resolveInheritedModel(config!, "review", "oracle")).toBeUndefined();
  });

  it("returns undefined for an inheritance cycle", () => {
    const config = {
      presets: { a: { extends: "b" }, b: { extends: "a" } },
    };

    expect(resolveInheritedModel(config, "a", "oracle")).toBeUndefined();
  });
});

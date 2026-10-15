import { describe, expect, it } from "vitest";

import { PROVIDER, PROVIDER_CONFIG_KEYS, PROVIDER_ENDPOINT } from "../constants";

describe("API-key providers vs upstream key families", () => {
  it("manages the Vertex, Interactions and Meta key lists", () => {
    expect(PROVIDER_ENDPOINT[PROVIDER.VERTEX]).toBe("/vertex-api-key");
    expect(PROVIDER_ENDPOINT[PROVIDER.INTERACTIONS]).toBe("/interactions-api-key");
    expect(PROVIDER_ENDPOINT[PROVIDER.META]).toBe("/meta-api-key");
  });

  it("counts every managed provider's config list as a configured provider", () => {
    expect([...PROVIDER_CONFIG_KEYS].sort()).toEqual(
      [
        "claude-api-key",
        "codex-api-key",
        "gemini-api-key",
        "interactions-api-key",
        "meta-api-key",
        "openai-compatibility",
        "vertex-api-key",
        "xai-api-key",
      ].sort()
    );
  });
});

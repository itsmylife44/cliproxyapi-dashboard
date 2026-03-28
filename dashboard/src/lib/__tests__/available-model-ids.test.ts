import { describe, expect, it } from "vitest";
import { buildAvailableModelIds, type ProxyModel } from "../config-generators/shared";

describe("buildAvailableModelIds", () => {
  it("deduplicates proxy + oauth IDs and returns sorted model IDs", () => {
    const proxyModels: ProxyModel[] = [
      { id: "claude-opus-4.6", owned_by: "anthropic" },
      { id: "claude-opus-4.6", owned_by: "anthropic" },
      { id: "gemini-2.5-pro", owned_by: "google" },
      { id: "gpt-4.1", owned_by: "openai" },
    ];

    const oauthAliasIds = ["claude-opus-4.6", "gemini-2.5-flash", "gpt-4.1"];

    const result = buildAvailableModelIds(proxyModels, oauthAliasIds);

    expect(result).toEqual([
      "claude-opus-4.6",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gpt-4.1",
    ]);
  });

  it("returns empty list when both sources are empty", () => {
    expect(buildAvailableModelIds([], [])).toEqual([]);
  });

  it("does not mutate input arrays", () => {
    const proxyModels: ProxyModel[] = [
      { id: "model-b", owned_by: "provider-b" },
      { id: "model-a", owned_by: "provider-a" },
    ];
    const oauthAliasIds = ["model-c", "model-a"];

    const proxySnapshot = JSON.parse(JSON.stringify(proxyModels));
    const aliasSnapshot = [...oauthAliasIds];

    void buildAvailableModelIds(proxyModels, oauthAliasIds);

    expect(proxyModels).toEqual(proxySnapshot);
    expect(oauthAliasIds).toEqual(aliasSnapshot);
  });
});

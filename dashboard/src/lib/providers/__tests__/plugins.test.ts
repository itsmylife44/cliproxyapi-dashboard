import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    CLIPROXYAPI_MANAGEMENT_URL: "http://cliproxyapi:8317/v0/management",
    MANAGEMENT_API_KEY: "test-management-key-16",
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { listEnabledPluginOAuthProviders } from "../plugins";

function stubPlugins(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Shape of GET /v0/management/plugins (CLIProxyAPI v8 plugins.go pluginListEntry).
const plugin = (overrides: Record<string, unknown>) => ({
  id: "x",
  configured: true,
  registered: true,
  enabled: true,
  effective_enabled: true,
  supports_oauth: true,
  oauth_provider: "",
  ...overrides,
});

describe("listEnabledPluginOAuthProviders", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the OAuth provider of every effectively enabled plugin", async () => {
    const fetchMock = stubPlugins({
      plugins_enabled: true,
      plugins: [
        plugin({ id: "gemini-cli", oauth_provider: "gemini-cli" }),
        plugin({ id: "github-copilot", oauth_provider: "copilot" }),
        plugin({ id: "kiro", oauth_provider: "kiro", enabled: false, effective_enabled: false }),
        plugin({ id: "quota-center", supports_oauth: false }),
      ],
    });

    await expect(listEnabledPluginOAuthProviders()).resolves.toEqual(["gemini-cli", "copilot"]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://cliproxyapi:8317/v0/management/plugins");
  });

  it("returns nothing when the plugin system is disabled (stock config)", async () => {
    stubPlugins({ plugins_enabled: false, plugins: [plugin({ oauth_provider: "gemini-cli" })] });
    await expect(listEnabledPluginOAuthProviders()).resolves.toEqual([]);
  });

  it("returns nothing when the proxy cannot be read", async () => {
    stubPlugins({ error: "boom" }, 500);
    await expect(listEnabledPluginOAuthProviders()).resolves.toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(listEnabledPluginOAuthProviders()).resolves.toEqual([]);
  });
});

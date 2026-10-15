import { describe, expect, it, vi } from "vitest";
import { parsePluginStore, pluginErrorMessage, pluginsSupported, waitForPluginState, type PluginStoreView } from "@/lib/plugin-store";

// Shape of GET /plugin-store on CLIProxyAPI v8.0.29 (runtime-checked); strings arrive html.EscapeString'd.
const entry = {
  store_id: "official/gemini-cli",
  source_id: "official",
  source_name: "Official",
  id: "gemini-cli",
  name: "Gemini CLI",
  description: "Adds Gemini&#39;s &#34;CLI&#34; &lt;provider&gt; &amp; OAuth",
  author: "Luis Pater",
  version: "1.0.5",
  install_type: "github-release",
  homepage: "https://github.com/x/y?a=1&amp;b=2",
  tags: ["Provider"],
  installed: true,
  installed_version: "1.0.4",
  registered: true,
  enabled: true,
  effective_enabled: true,
  update_available: true,
};

describe("parsePluginStore", () => {
  it("decodes escaped display strings and maps install state", () => {
    const view = parsePluginStore({ plugins_enabled: true, plugins: [entry] });

    expect(view.pluginsEnabled).toBe(true);
    expect(view.rows).toEqual([
      {
        id: "gemini-cli",
        sourceId: "official",
        name: "Gemini CLI",
        description: `Adds Gemini's "CLI" <provider> & OAuth`,
        author: "Luis Pater",
        version: "1.0.5",
        installedVersion: "1.0.4",
        tags: ["Provider"],
        installed: true,
        enabled: true,
        active: true,
        loaded: true,
        updateAvailable: true,
      },
    ]);
  });

  it("keeps a plugin loaded while the global switch turn-off is still unloading it", () => {
    const view = parsePluginStore({ plugins_enabled: false, plugins: [{ ...entry, effective_enabled: false }] });
    expect(view.rows[0]).toMatchObject({ active: false, loaded: true });
  });

  it("decodes &amp;lt; only once", () => {
    const view = parsePluginStore({ plugins: [{ ...entry, name: "a &amp;lt; b" }] });
    expect(view.rows[0]?.name).toBe("a &lt; b");
  });

  it("drops entries without an id and reports partial source failures", () => {
    const view = parsePluginStore({
      plugins_enabled: false,
      plugins: [{ name: "no id" }, null, entry],
      source_errors: [{ source_id: "extra", source_name: "Extra", message: "registry 404" }],
    });

    expect(view.pluginsEnabled).toBe(false);
    expect(view.rows.map((r) => r.id)).toEqual(["gemini-cli"]);
    expect(view.sourceErrors).toEqual(["Extra: registry 404"]);
  });

  it("returns an empty view for a malformed body", () => {
    expect(parsePluginStore("nope")).toEqual({ pluginsEnabled: false, rows: [], sourceErrors: [] });
  });
});

describe("pluginErrorMessage", () => {
  it("prefers the upstream message, which names the missing build", () => {
    const body = { error: "plugin_install_failed", message: "release asset x_0.3.3_linux_arm64.zip not found" };
    expect(pluginErrorMessage(body, "Install failed")).toBe("release asset x_0.3.3_linux_arm64.zip not found");
  });

  it("falls back to the error code, then to the fallback", () => {
    expect(pluginErrorMessage({ error: "plugin_not_found" }, "Failed")).toBe("plugin_not_found");
    expect(pluginErrorMessage(null, "Failed")).toBe("Failed");
  });
});

describe("waitForPluginState", () => {
  // Store snapshots in the order CLIProxyAPI v8.0.29 reports them after a write (runtime-checked).
  const snapshot = (pluginsEnabled: boolean, registered: boolean, enabled = true): PluginStoreView =>
    parsePluginStore({
      plugins_enabled: pluginsEnabled,
      plugins: [{ ...entry, enabled, registered, effective_enabled: pluginsEnabled && enabled && registered }],
    });
  const polls = (...views: PluginStoreView[]) => {
    let i = 0;
    return async () => views[Math.min(i++, views.length - 1)] ?? null;
  };
  const noSleep = async () => {};

  it("keeps polling until the plugin is loaded", async () => {
    const fetchView = polls(snapshot(true, false), snapshot(true, false), snapshot(true, true));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"] }, { sleep: noSleep });

    expect(result.pending).toEqual([]);
    expect(result.view?.rows[0]?.active).toBe(true);
  });

  it("gives up after the timeout and reports the plugins that never loaded", async () => {
    const fetchView = vi.fn(polls(snapshot(true, false)));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"] }, { intervalMs: 1000, timeoutMs: 3000, sleep: noSleep });

    expect(result.pending).toEqual(["gemini-cli"]);
    expect(fetchView).toHaveBeenCalledTimes(3);
  });

  it("waits for the unload after the global switch turns off", async () => {
    // The switch flips in the store at once; the library detaches ~250 ms later.
    const fetchView = vi.fn(polls(snapshot(false, true), snapshot(false, false)));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"], pluginsEnabled: false }, { sleep: noSleep });

    expect(result.pending).toEqual([]);
    expect(fetchView).toHaveBeenCalledTimes(2);
  });

  it("does not count the old switch state as settled", async () => {
    const fetchView = vi.fn(polls(snapshot(false, false), snapshot(true, true)));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"], pluginsEnabled: true }, { sleep: noSleep });

    expect(result.pending).toEqual([]);
    expect(fetchView).toHaveBeenCalledTimes(2);
  });

  it("settles a disabled plugin once it is unloaded", async () => {
    const fetchView = vi.fn(polls(snapshot(true, true, false), snapshot(true, false, false)));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"] }, { sleep: noSleep });

    expect(result.pending).toEqual([]);
    expect(fetchView).toHaveBeenCalledTimes(2);
  });

  it("waits at least one interval before the first read, so the reload can start", async () => {
    const sleep = vi.fn(noSleep);
    await waitForPluginState(polls(snapshot(true, true)), { ids: ["gemini-cli"] }, { intervalMs: 1000, sleep });
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("stays locked for the settle window even when the state is reached at once", async () => {
    // A second write during upstream's async reload can roll back the first (CLIProxyAPI#6631).
    const fetchView = vi.fn(polls(snapshot(true, true)));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"] }, { intervalMs: 500, sleep: noSleep });

    expect(result.pending).toEqual([]);
    // 2 s settle window at 500 ms per poll
    expect(fetchView).toHaveBeenCalledTimes(4);
  });

  it("waits for an update until the installed version is the target version", async () => {
    const at = (installed_version: string) =>
      parsePluginStore({ plugins_enabled: true, plugins: [{ ...entry, installed_version }] });
    const fetchView = vi.fn(polls(at("1.0.4"), at("1.0.4"), at("1.0.4"), at("1.0.5")));
    const result = await waitForPluginState(fetchView, { ids: ["gemini-cli"], installedVersion: "1.0.5" }, { sleep: noSleep });

    expect(result.pending).toEqual([]);
    expect(fetchView).toHaveBeenCalledTimes(4);
  });

  it("reports an update that never reaches the target version", async () => {
    const fetchView = polls(snapshot(true, true));
    const result = await waitForPluginState(
      fetchView,
      { ids: ["gemini-cli"], installedVersion: "1.0.5" },
      { intervalMs: 1000, timeoutMs: 3000, sleep: noSleep }
    );

    expect(result.pending).toEqual(["gemini-cli"]);
  });
});

describe("pluginsSupported", () => {
  it.each([
    ["0", false],
    ["1", true],
    [null, true],
  ] as const)("X-CPA-SUPPORT-PLUGIN %s -> %s", (value, expected) => {
    const headers = new Headers(value === null ? {} : { "X-CPA-SUPPORT-PLUGIN": value });

    expect(pluginsSupported(new Response(null, { headers }))).toBe(expected);
  });
});

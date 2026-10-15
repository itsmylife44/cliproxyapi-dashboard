import { describe, expect, it } from "vitest";
import { parsePluginStore, pluginErrorMessage } from "@/lib/plugin-store";

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
        updateAvailable: true,
      },
    ]);
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

import { describe, expect, it } from "vitest";
import { mergeConfigYaml, parseConfigYaml, readAuthDir } from "@/lib/config-yaml";

describe("readAuthDir", () => {
  it("reads a custom auth-dir from a legacy config.yaml", () => {
    expect(readAuthDir("debug: false\nauth-dir: /root/custom-auths\n")).toBe("/root/custom-auths");
  });

  it("reads oauth.auth-dir from a v8 config.yaml", () => {
    const rawYaml = "config-version: 8\noauth:\n  auth-dir: /data/auths\n";
    expect(readAuthDir(rawYaml)).toBe("/data/auths");
  });

  it("returns an empty string when auth-dir is not set", () => {
    expect(readAuthDir("debug: false\n")).toBe("");
  });
});

describe("parseConfigYaml", () => {
  it("returns empty object for empty/whitespace-only input", () => {
    expect(parseConfigYaml("")).toEqual({});
    expect(parseConfigYaml("   \n  ")).toEqual({});
  });

  it("parses a valid YAML mapping", () => {
    const result = parseConfigYaml("host: localhost\nport: 8317\n");
    expect(result).toEqual({ host: "localhost", port: 8317 });
  });

  it("throws on invalid YAML syntax", () => {
    expect(() => parseConfigYaml(":\n  bad: [unterminated")).toThrow(
      /Invalid current config\.yaml/
    );
  });

  it("throws when YAML root is an array", () => {
    expect(() => parseConfigYaml("- item1\n- item2\n")).toThrow(
      /root value is not a YAML mapping/
    );
  });

  it("throws when YAML root is a scalar", () => {
    expect(() => parseConfigYaml('"just a string"')).toThrow(
      /root value is not a YAML mapping/
    );
  });
});

describe("mergeConfigYaml", () => {
  it("preserves fields omitted from /config JSON such as host and port", () => {
    const rawYaml = [
      "host: ''",
      "port: 8317",
      "auth-dir: ~/.cli-proxy-api",
      "debug: false",
      "pprof:",
      "  enable: false",
      "  addr: 127.0.0.1:8316",
      "",
    ].join("\n");

    const merged = mergeConfigYaml(rawYaml, {
      debug: true,
      pprof: {
        enable: true,
      },
    });

    expect(merged).toContain("host: ''");
    expect(merged).toContain("port: 8317");
    expect(merged).toContain("auth-dir: ~/.cli-proxy-api");
    expect(merged).toContain("debug: true");
    expect(merged).toContain("enable: true");
    expect(merged).toContain("addr: 127.0.0.1:8316");
  });

  it("creates a valid YAML document when the current file is empty", () => {
    const merged = mergeConfigYaml("", {
      "auth-dir": "~/.cli-proxy-api",
      "commercial-mode": true,
    });

    expect(merged).toContain("auth-dir: ~/.cli-proxy-api");
    expect(merged).toContain("commercial-mode: true");
  });

  it("replaces arrays wholesale instead of merging them", () => {
    const rawYaml = "items:\n  - a\n  - b\n  - c\n";
    const merged = mergeConfigYaml(rawYaml, { items: ["x"] });
    expect(merged).toContain("- x");
    expect(merged).not.toContain("- a");
    expect(merged).not.toContain("- b");
  });

  it("handles null values in changes", () => {
    const rawYaml = "debug: true\nhost: localhost\n";
    const merged = mergeConfigYaml(rawYaml, { debug: null });
    expect(merged).toContain("debug: null");
    expect(merged).toContain("host: localhost");
  });

  it("shallow-merges nested objects (1-level deep)", () => {
    const rawYaml = "pprof:\n  enable: false\n  addr: 127.0.0.1:8316\n";
    const merged = mergeConfigYaml(rawYaml, { pprof: { enable: true } });
    expect(merged).toContain("enable: true");
    expect(merged).toContain("addr: 127.0.0.1:8316");
  });

  it("throws on invalid YAML input instead of silently dropping data", () => {
    expect(() =>
      mergeConfigYaml(":\n  bad: [unterminated", { debug: true })
    ).toThrow(/Invalid current config\.yaml/);
  });

  it("throws on non-object YAML root instead of silently dropping data", () => {
    expect(() =>
      mergeConfigYaml("- item1\n- item2\n", { debug: true })
    ).toThrow(/root value is not a YAML mapping/);
  });

  it("flips plugins.enabled without dropping installed plugin configs", () => {
    const yaml = "plugins:\n  enabled: false\n  dir: plugins\n  configs:\n    gemini-cli:\n      enabled: true\n";
    const merged = parseConfigYaml(mergeConfigYaml(yaml, { plugins: { enabled: true } }));
    expect(merged.plugins).toEqual({ enabled: true, dir: "plugins", configs: { "gemini-cli": { enabled: true } } });
  });

  it("adds new keys that did not exist in the original YAML", () => {
    const rawYaml = "debug: false\n";
    const merged = mergeConfigYaml(rawYaml, {
      debug: false,
      "new-field": "new-value",
    });
    expect(merged).toContain("new-field: new-value");
    expect(merged).toContain("debug: false");
  });

  it("persists removal of an oauth-model-alias provider in a multi-field merge", () => {
    const rawYaml = [
      "debug: false",
      "oauth-model-alias:",
      "  gemini-cli:",
      "    - name: gemini-2.5-pro",
      "      alias: g25",
      "  codex:",
      "    - name: gpt-5",
      "      alias: g5",
      "",
    ].join("\n");
    const merged = parseConfigYaml(
      mergeConfigYaml(rawYaml, {
        debug: true,
        "oauth-model-alias": { codex: [{ name: "gpt-5", alias: "g5" }] },
      })
    );
    expect(merged["oauth-model-alias"]).toEqual({ codex: [{ name: "gpt-5", alias: "g5" }] });
    expect(merged.debug).toBe(true);
  });
});

describe("mergeConfigYaml on a v8-layout config.yaml", () => {
  const v8Yaml = [
    "config-version: 8",
    "requests:",
    "  passthrough-headers: false",
    "upstream:",
    "  claude:",
    "    disable-claude-cloak-mode: true",
    "observability:",
    "  pprof:",
    "    enable: false",
    "    addr: 127.0.0.1:8316",
    "",
  ].join("\n");

  it("writes a changed field to its existing v8 path without adding the legacy key", () => {
    const merged = parseConfigYaml(mergeConfigYaml(v8Yaml, { "passthrough-headers": true }));
    expect(merged.requests).toEqual({ "passthrough-headers": true });
    expect(merged).not.toHaveProperty("passthrough-headers");
  });

  it("creates the v8 path when it is absent and keeps sibling keys", () => {
    const merged = parseConfigYaml(
      mergeConfigYaml(v8Yaml, {
        streaming: { "keepalive-seconds": 15 },
        "claude-header-defaults": { "user-agent": "ua" },
        "auth-dir": "/data/auths",
      })
    );
    expect(merged.requests).toEqual({ "passthrough-headers": false, streaming: { "keepalive-seconds": 15 } });
    expect(merged.upstream).toEqual({
      claude: { "disable-claude-cloak-mode": true, "header-defaults": { "user-agent": "ua" } },
    });
    expect(merged.oauth).toEqual({ "auth-dir": "/data/auths" });
    expect(merged).not.toHaveProperty("streaming");
    expect(merged).not.toHaveProperty("claude-header-defaults");
    expect(merged).not.toHaveProperty("auth-dir");
  });

  it("writes nonstream-keepalive-interval to requests on a v8 file", () => {
    const merged = parseConfigYaml(mergeConfigYaml(v8Yaml, { "nonstream-keepalive-interval": 30 }));
    expect(merged.requests).toEqual({ "passthrough-headers": false, "nonstream-keepalive-interval": 30 });
    expect(merged).not.toHaveProperty("nonstream-keepalive-interval");
  });

  it("shallow-merges objects at the v8 path", () => {
    const merged = parseConfigYaml(mergeConfigYaml(v8Yaml, { pprof: { enable: true } }));
    expect(merged.observability).toEqual({ pprof: { enable: true, addr: "127.0.0.1:8316" } });
    expect(merged).not.toHaveProperty("pprof");
  });

  it("maps endpoint-backed fields to their v8 paths and leaves shared roots in place", () => {
    const raw = [
      "config-version: 8",
      "routing:",
      "  strategy: round-robin",
      "  retry:",
      "    request-retry: 3",
      "quota-exceeded:",
      "  switch-project: false",
      "  switch-preview-model: false",
      "",
    ].join("\n");
    const merged = parseConfigYaml(
      mergeConfigYaml(raw, {
        "proxy-url": "",
        debug: true,
        "logging-to-file": true,
        "logs-max-total-size-mb": 10,
        "error-logs-max-files": 5,
        "usage-statistics-enabled": true,
        "request-retry": 5,
        "max-retry-interval": 30,
        "max-retry-credentials": 7,
        "request-log": true,
        "ws-auth": true,
        "force-model-prefix": true,
        "oauth-model-alias": { codex: [{ name: "gpt-5", alias: "x" }] },
        "quota-exceeded": { "switch-project": true },
        routing: { strategy: "fill-first" },
      })
    );
    expect(merged).toEqual({
      "config-version": 8,
      routing: {
        strategy: "fill-first",
        "force-model-prefix": true,
        retry: { "request-retry": 5, "max-retry-interval": 30, "max-retry-credentials": 7 },
      },
      "quota-exceeded": { "switch-project": true, "switch-preview-model": false },
      requests: { "proxy-url": "" },
      observability: {
        logs: {
          debug: true,
          "logging-to-file": true,
          "logs-max-total-size-mb": 10,
          "error-logs-max-files": 5,
          "request-log": true,
        },
        usage: { "usage-statistics-enabled": true },
      },
      oauth: {
        "model-alias": { codex: [{ name: "gpt-5", alias: "x" }] },
        providers: { aistudio: { "ws-auth": true } },
      },
    });
  });

  it("persists removal of an oauth-model-alias provider in a multi-field merge", () => {
    const raw = [
      "config-version: 8",
      "oauth:",
      "  auth-dir: /data/auths",
      "  model-alias:",
      "    gemini-cli:",
      "      - name: gemini-2.5-pro",
      "        alias: g25",
      "    codex:",
      "      - name: gpt-5",
      "        alias: g5",
      "",
    ].join("\n");
    const merged = parseConfigYaml(
      mergeConfigYaml(raw, {
        debug: true,
        "oauth-model-alias": { codex: [{ name: "gpt-5", alias: "g5" }] },
      })
    );
    expect(merged.oauth).toEqual({
      "auth-dir": "/data/auths",
      "model-alias": { codex: [{ name: "gpt-5", alias: "g5" }] },
    });
    expect(merged).not.toHaveProperty("oauth-model-alias");
  });

  it("keeps legacy files on legacy root keys", () => {
    const merged = parseConfigYaml(mergeConfigYaml("passthrough-headers: false\n", { "passthrough-headers": true }));
    expect(merged).toEqual({ "passthrough-headers": true });
  });
});

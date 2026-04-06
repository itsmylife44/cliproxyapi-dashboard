import { describe, expect, it } from "vitest";
import { mergeConfigYaml, parseConfigYaml } from "@/lib/config-yaml";

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
      "incognito-browser": true,
    });

    expect(merged).toContain("auth-dir: ~/.cli-proxy-api");
    expect(merged).toContain("incognito-browser: true");
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

  it("adds new keys that did not exist in the original YAML", () => {
    const rawYaml = "debug: false\n";
    const merged = mergeConfigYaml(rawYaml, {
      debug: false,
      "new-field": "new-value",
    });
    expect(merged).toContain("new-field: new-value");
    expect(merged).toContain("debug: false");
  });
});

import { describe, expect, it } from "vitest";
import { mergeConfigYaml } from "@/lib/config-yaml";

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
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { getManagementUrl, getProxyBaseUrl } from "@/lib/management-url";

describe("getManagementUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns CLIPROXYAPI_MANAGEMENT_URL when set", () => {
    vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "http://proxy.internal:9000/v0/management");
    expect(getManagementUrl()).toBe("http://proxy.internal:9000/v0/management");
  });

  it("falls back to the bundled CLIProxyAPI service URL when unset", () => {
    vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "");
    expect(getManagementUrl()).toBe("http://cliproxyapi:8317/v0/management");
  });
});

describe("getProxyBaseUrl", () => {
  it("strips the v0 management suffix", () => {
    expect(getProxyBaseUrl("http://cliproxyapi:8317/v0/management")).toBe("http://cliproxyapi:8317");
  });

  it("strips any versioned management suffix", () => {
    expect(getProxyBaseUrl("http://cliproxyapi:8317/v8/management")).toBe("http://cliproxyapi:8317");
  });

  it("tolerates a trailing slash", () => {
    expect(getProxyBaseUrl("http://cliproxyapi:8317/v0/management/")).toBe("http://cliproxyapi:8317");
  });

  it("keeps a reverse-proxy path prefix", () => {
    expect(getProxyBaseUrl("https://example.com/cliproxy/v0/management")).toBe("https://example.com/cliproxy");
  });

  it("leaves a URL without a management suffix unchanged", () => {
    expect(getProxyBaseUrl("http://cliproxyapi:8317")).toBe("http://cliproxyapi:8317");
  });
});

import { describe, expect, it } from "vitest";

import { resolveModelPrice } from "@/lib/model-pricing";
import {
  canonicalizeOAuthProvider,
  OAUTH_PROVIDER,
  PROVIDER,
  PROVIDER_ENDPOINT,
} from "../constants";
import {
  groupModelsByProvider,
  MODEL_PROVIDER_ORDER,
  resolveOwnedByDisplay,
  detectModelProvider,
} from "../model-grouping";

describe("xAI credential canonicalization", () => {
  it("canonicalizes the proxy's native `xai` provider", () => {
    // CLIProxyAPI mints `xai-*.json` auth files with provider/type `xai`.
    expect(canonicalizeOAuthProvider("xai")).toBe(OAUTH_PROVIDER.XAI);
    expect(canonicalizeOAuthProvider("XAI")).toBe("xai");
    expect(canonicalizeOAuthProvider(" xai ")).toBe("xai");
  });

  it("keeps canonicalizing the other providers", () => {
    expect(canonicalizeOAuthProvider("anthropic")).toBe("claude");
    expect(canonicalizeOAuthProvider("github-copilot")).toBe("copilot");
    expect(canonicalizeOAuthProvider("unknown-provider")).toBeNull();
  });
});

describe("xAI API key provider entry", () => {
  it("exposes xAI as a first-class key provider on the xai-api-key endpoint", () => {
    expect(PROVIDER.XAI).toBe("xai");
    expect(PROVIDER_ENDPOINT[PROVIDER.XAI]).toBe("/xai-api-key");
  });

  it("keeps an endpoint mapped for every key provider", () => {
    for (const provider of Object.values(PROVIDER)) {
      expect(PROVIDER_ENDPOINT[provider], `${provider} has no endpoint`).toBeTruthy();
    }
  });
});

describe("xAI display and grouping", () => {
  it("renders owned_by `xai` as xAI rather than the title-cased fallback", () => {
    expect(resolveOwnedByDisplay("xai")).toBe("xAI");
  });

  it("groups Grok models under their own xAI bucket", () => {
    expect(detectModelProvider("grok-4.6")).toBe("xAI");
    expect(detectModelProvider("grok-code-fast-1")).toBe("xAI");
    expect(detectModelProvider("xai/grok-4")).toBe("xAI");
  });

  it("no longer lumps xAI into the OpenAI-Compatible catch-all", () => {
    expect(detectModelProvider("xai/grok-4")).not.toBe("OpenAI-Compatible");
    expect(detectModelProvider("grok-4.6")).not.toBe("OpenAI-Compatible");
    // Other pass-through prefixes keep their grouping.
    expect(detectModelProvider("openrouter/foo")).toBe("OpenAI-Compatible");
  });

  it("still prefers ownership source info over the name heuristic", () => {
    const sourceMap = new Map([["grok-4.6", "xAI"]]);
    expect(detectModelProvider("grok-4.6", sourceMap)).toBe("xAI");
  });

  it("orders the xAI bucket before the catch-all group", () => {
    expect(MODEL_PROVIDER_ORDER.indexOf("xAI")).toBeGreaterThan(-1);
    expect(MODEL_PROVIDER_ORDER.indexOf("xAI")).toBeLessThan(
      MODEL_PROVIDER_ORDER.indexOf("OpenAI-Compatible")
    );
  });

  it("collects Grok models into a single group", () => {
    const groups = groupModelsByProvider(["grok-4.6", "grok-code-fast-1", "claude-opus-5"]);
    const xaiGroup = groups.find((group) => group.provider === "xAI");
    expect(xaiGroup?.models).toEqual(["grok-4.6", "grok-code-fast-1"]);
  });
});

describe("xAI pricing", () => {
  it("prices Grok models instead of reporting them unpriced", () => {
    const price = resolveModelPrice("grok-4.6");
    expect(price).not.toBeNull();
    expect(price?.provider).toBe("xAI");
    expect(price?.displayName).toBe("Grok 4.6");
  });

  it("prices the Grok model used by the shipped presets at its official rate", () => {
    // The shipped presets use `grok-code-fast-1`, which xAI retired on
    // 2026-05-15 and now serves as `grok-build-0.1`.
    // https://docs.x.ai/developers/models/grok-build-0.1
    const price = resolveModelPrice("grok-code-fast-1");
    expect(price?.inputPer1M).toBe(1);
    expect(price?.cacheReadPer1M).toBe(0.2);
    expect(price?.outputPer1M).toBe(2);
  });
});

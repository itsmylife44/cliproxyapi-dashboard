import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTING_STRATEGIES } from "../routing-strategies";

const MESSAGES_DIR = fileURLToPath(new URL("../../../messages", import.meta.url));

// Exact set accepted by CLIProxyAPI's `PUT /v0/management/routing/strategy`
// (v7.3.1). Anything else returns 400 `invalid strategy`.
const PROXY_ACCEPTED_STRATEGIES = ["round-robin", "weighted-round-robin", "fill-first"];

describe("routing strategies", () => {
  it("offers exactly the strategies the proxy accepts", () => {
    const values = ROUTING_STRATEGIES.map((strategy) => strategy.value);
    expect(values).toEqual(PROXY_ACCEPTED_STRATEGIES);
  });

  it("does not offer strategies the proxy rejects", () => {
    const values = ROUTING_STRATEGIES.map((strategy) => strategy.value);
    expect(values).not.toContain("random");
    expect(values).not.toContain("least-loaded");
  });

  it("translates every strategy label in every locale and drops retired keys", () => {
    const localeFiles = readdirSync(MESSAGES_DIR).filter((file) => file.endsWith(".json"));
    expect(localeFiles.length).toBeGreaterThan(0);

    for (const localeFile of localeFiles) {
      const messages = JSON.parse(readFileSync(`${MESSAGES_DIR}/${localeFile}`, "utf8")) as {
        agentConfig: Record<string, string>;
      };

      for (const strategy of ROUTING_STRATEGIES) {
        expect(
          messages.agentConfig[strategy.labelKey],
          `${localeFile} is missing agentConfig.${strategy.labelKey}`
        ).toBeTruthy();
      }

      expect(messages.agentConfig.routingRandom, `${localeFile} still has routingRandom`).toBeUndefined();
      expect(messages.agentConfig.routingLeastLoaded, `${localeFile} still has routingLeastLoaded`).toBeUndefined();
    }
  });
});
